package io.github.polarsync

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaCodecList
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaRecorder
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import io.github.polarsync.security.EncryptedMediaDataSource
import io.github.polarsync.security.EncryptedMemoFormat
import io.github.polarsync.security.KeyWrapper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException
import java.time.LocalDateTime

/**
 * Owns the [MediaRecorder] and the recordings directory. There is one instance per process
 * (see [PolarsyncApp.recordingManager]) so the service, which drives recording, and the
 * activity, which displays it, observe the same [state].
 *
 * Audio is tuned for speech at the smallest size (see [AudioProfile]): Opus in Ogg, mono,
 * 16 kHz, 12 kbps — about 90 KB per minute — falling back to AMR-WB at 12.65 kbps on devices
 * without an Opus encoder. MediaRecorder needs a seekable plain file, so a session is written to `noBackupFilesDir/pending`
 * (app-private). When it stops, the file is encrypted into `filesDir/recordings/<name>.psm`
 * (see [EncryptedMemoFormat]) and the plain copy is deleted. A pending file left behind by a
 * crash is encrypted the next time recordings are listed.
 *
 * Call from the main thread. [MediaRecorder] posts its callbacks to the looper of the thread
 * that created it, so keeping everything on the main thread avoids racing those callbacks.
 */
class RecordingManager(context: Context, private val keyWrapper: KeyWrapper) {

    private val appContext = context.applicationContext

    val recordingsDir: File = File(appContext.filesDir, RECORDINGS_DIR)
    private val pendingDir: File = File(appContext.noBackupFilesDir, PENDING_DIR)

    /** Outlives any screen, so encryption finishes even if the UI goes away. */
    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val encrypting = mutableSetOf<File>()

    private val _state = MutableStateFlow<RecordingState>(RecordingState.Idle)
    val state: StateFlow<RecordingState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<RecordingEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<RecordingEvent> = _events.asSharedFlow()

    private var recorder: MediaRecorder? = null

    /**
     * Opens a new output file and starts capturing.
     *
     * @throws RecordingException if a session is already active, the microphone permission is
     *   missing, storage is low, or the recorder could not be started (for example because
     *   another app holds the microphone).
     */
    @SuppressLint("MissingPermission") // Checked explicitly via hasRecordPermission() below.
    @Throws(RecordingException::class)
    fun start(): File {
        if (_state.value !is RecordingState.Idle) {
            throw RecordingException("A recording is already in progress.")
        }
        if (!hasRecordPermission()) {
            throw RecordingException("Microphone permission has not been granted.")
        }
        for (dir in listOf(recordingsDir, pendingDir)) {
            if (!dir.isDirectory && !dir.mkdirs()) {
                throw RecordingException("Could not create the recordings folder.")
            }
        }
        val freeBytes = recordingsDir.usableSpace
        if (freeBytes < MIN_FREE_BYTES) {
            throw RecordingException("Not enough free storage to start recording.")
        }

        // Opus first when the device has an encoder for it; AMR-WB if not, or if Opus won't start.
        val profiles = if (hasOpusEncoder) listOf(AudioProfile.OPUS, AudioProfile.AMR_WB) else listOf(AudioProfile.AMR_WB)
        var lastError: RuntimeException? = null
        var started: Pair<MediaRecorder, File>? = null
        for (profile in profiles) {
            try {
                started = startRecorder(profile, freeBytes)
                break
            } catch (e: RuntimeException) {
                // IllegalStateException / RuntimeException("start failed"): an unsupported
                // encoder, or the mic is busy (in which case the fallback fails too).
                Log.w(TAG, "Could not start ${profile.name} recording", e)
                lastError = e
            }
        }
        val (mediaRecorder, file) = started
            ?: throw RecordingException("Could not start the microphone. Is another app using it?", lastError)

        recorder = mediaRecorder
        _state.value = RecordingState.Recording(
            file = file,
            accumulatedMs = 0,
            segmentStartRealtime = SystemClock.elapsedRealtime(),
        )
        Log.i(TAG, "Recording started: ${file.name}")
        return file
    }

    /** Configures and starts a recorder for [profile]; cleans up and rethrows on failure. */
    @SuppressLint("MissingPermission") // Only called from start(), after the permission check.
    @Throws(RecordingException::class)
    private fun startRecorder(profile: AudioProfile, freeBytes: Long): Pair<MediaRecorder, File> {
        val file = uniqueFile(LocalDateTime.now(), profile.extension)
        val mediaRecorder = MediaRecorder(appContext)
        try {
            mediaRecorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(profile.outputFormat)
                setAudioEncoder(profile.audioEncoder)
                setAudioChannels(1)
                setAudioSamplingRate(profile.sampleRateHz)
                setAudioEncodingBitRate(profile.bitRateBps)
                // Leave headroom so a long session can't fill the device completely.
                setMaxFileSize(freeBytes - STORAGE_RESERVE_BYTES)
                setOutputFile(file)
                setOnErrorListener { _, what, extra -> onRecorderError(what, extra) }
                setOnInfoListener { _, what, _ -> onRecorderInfo(what) }
                prepare()
                start()
            }
        } catch (e: IOException) {
            discard(mediaRecorder, file)
            throw RecordingException("Could not open the output file.", e)
        } catch (e: RuntimeException) {
            discard(mediaRecorder, file)
            throw e
        }
        return mediaRecorder to file
    }

    /** True if the device has any Opus encoder MediaRecorder can use (software counts). */
    private val hasOpusEncoder: Boolean by lazy {
        MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.any { info ->
            info.isEncoder && info.supportedTypes.any { it.equals(MediaFormat.MIMETYPE_AUDIO_OPUS, ignoreCase = true) }
        }
    }

    /** Pauses capture, keeping the file open. No-op unless currently recording. */
    fun pause() {
        val current = _state.value as? RecordingState.Recording ?: return
        val mediaRecorder = recorder ?: return
        try {
            mediaRecorder.pause()
        } catch (e: IllegalStateException) {
            fail("Could not pause the recording.", e)
            return
        }
        _state.value = RecordingState.Paused(current.file, current.elapsedMs())
    }

    /** Resumes a paused session. No-op unless currently paused. */
    fun resume() {
        val current = _state.value as? RecordingState.Paused ?: return
        val mediaRecorder = recorder ?: return
        try {
            mediaRecorder.resume()
        } catch (e: IllegalStateException) {
            fail("Could not resume the recording.", e)
            return
        }
        _state.value = RecordingState.Recording(
            file = current.file,
            accumulatedMs = current.accumulatedMs,
            segmentStartRealtime = SystemClock.elapsedRealtime(),
        )
    }

    /**
     * Finalises the session and starts encrypting it in the background; [events] reports
     * [RecordingEvent.Saved] once the encrypted file is in place. Returns false if nothing
     * usable was captured (the partial file is then deleted). Safe to call in any state.
     */
    fun stop(): Boolean {
        val current = _state.value as? RecordingState.Active ?: return false
        val mediaRecorder = recorder
        recorder = null

        var saved: File? = current.file
        try {
            mediaRecorder?.stop()
        } catch (e: RuntimeException) {
            // Thrown when stop() is called before any valid audio was encoded (e.g. an
            // immediate stop). The container has no index, so the file is unplayable.
            Log.w(TAG, "stop() failed; discarding ${current.file.name}", e)
            current.file.delete()
            saved = null
        } finally {
            mediaRecorder?.release()
        }
        // Only now is the file complete; until here recoverPending() must treat it as active.
        _state.value = RecordingState.Idle

        if (saved == null) {
            _events.tryEmit(RecordingEvent.Failed("The recording was too short to save."))
            return false
        }
        Log.i(TAG, "Recording finished: ${saved.name} (${saved.length()} bytes); encrypting")
        ioScope.launch { encryptPending(saved) }
        return true
    }

    /** Lets other components (e.g. the service) report failures through the same channel. */
    fun reportError(message: String, cause: Throwable? = null) {
        Log.e(TAG, message, cause)
        _events.tryEmit(RecordingEvent.Failed(message, cause))
    }

    /**
     * Finished (encrypted) recordings, newest first. Also encrypts any pending file left by a
     * crash. Decrypts each file's header to read its duration, so call it off the main thread.
     */
    fun listRecordings(): List<VoiceMemo> {
        recoverPending()
        val files = recordingsDir.listFiles { f -> f.isFile && f.extension == ENCRYPTED_EXTENSION }
            ?: return emptyList()
        return files
            .sortedByDescending { it.lastModified() }
            .map { f -> VoiceMemo(f, f.length(), f.lastModified(), readDurationMs(f)) }
    }

    /** Opens an encrypted recording for playback. Decrypted audio stays in memory. */
    @Throws(IOException::class)
    fun openForPlayback(file: File): EncryptedMediaDataSource {
        require(isInRecordingsDir(file)) { "Not a recording: $file" }
        return EncryptedMediaDataSource(EncryptedMemoFormat.Reader(file, keyWrapper))
    }

    /** Deletes a finished recording. Refuses files outside [recordingsDir]. */
    fun delete(file: File): Boolean = isInRecordingsDir(file) && file.delete()

    private fun isInRecordingsDir(file: File): Boolean =
        file.canonicalFile.parentFile == recordingsDir.canonicalFile

    private fun encryptPending(plain: File) {
        synchronized(encrypting) { if (!encrypting.add(plain)) return }
        val target = File(recordingsDir, plain.nameWithoutExtension + ".$ENCRYPTED_EXTENSION")
        try {
            if (!plain.exists()) return
            if (!recordingsDir.isDirectory) recordingsDir.mkdirs()
            EncryptedMemoFormat.encryptFile(plain, target, keyWrapper)
            target.setLastModified(plain.lastModified())
            plain.delete()
            Log.i(TAG, "Encrypted ${target.name}")
            _events.tryEmit(RecordingEvent.Saved(target))
        } catch (e: Exception) {
            // Keep the plain file so a later recoverPending() can retry.
            reportError("Could not encrypt ${plain.nameWithoutExtension}.", e)
        } finally {
            synchronized(encrypting) { encrypting.remove(plain) }
        }
    }

    private fun recoverPending() {
        val active = (_state.value as? RecordingState.Active)?.file
        pendingDir.listFiles { f -> f.isFile && f.extension in PLAIN_EXTENSIONS }
            ?.filter { it != active }
            ?.forEach(::encryptPending)
    }

    fun hasRecordPermission(): Boolean =
        ContextCompat.checkSelfPermission(appContext, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    private fun onRecorderError(what: Int, extra: Int) {
        Log.e(TAG, "MediaRecorder error what=$what extra=$extra")
        // Try to salvage what was captured; stop() deletes the file if that fails.
        stop()
        _events.tryEmit(RecordingEvent.Failed("Recording was interrupted (error $what)."))
    }

    private fun onRecorderInfo(what: Int) {
        when (what) {
            MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED -> {
                stop()
                _events.tryEmit(RecordingEvent.Failed("Storage is almost full; recording stopped."))
            }
            MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED -> stop()
        }
    }

    /** Ends the session after a pause/resume failure, keeping whatever was captured. */
    private fun fail(message: String, cause: Throwable) {
        reportError(message, cause)
        stop()
    }

    private fun discard(mediaRecorder: MediaRecorder, file: File) {
        mediaRecorder.release()
        file.delete()
    }

    /** A pending file whose name is free both in [pendingDir] and, once encrypted, in [recordingsDir]. */
    private fun uniqueFile(now: LocalDateTime, extension: String): File {
        val base = Format.recordingBaseName(now)
        var name = base
        var n = 1
        while (File(pendingDir, "$name.$extension").exists() ||
            File(recordingsDir, "$name.$ENCRYPTED_EXTENSION").exists()
        ) {
            name = "${base}_$n"
            n++
        }
        return File(pendingDir, "$name.$extension")
    }

    private fun readDurationMs(file: File): Long? = try {
        openForPlayback(file).use { source ->
            MediaMetadataRetriever().use { retriever ->
                retriever.setDataSource(source)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
            }
        }
    } catch (e: Exception) {
        Log.w(TAG, "Could not read duration of ${file.name}", e)
        null
    }

    companion object {
        private const val TAG = "RecordingManager"
        private const val RECORDINGS_DIR = "recordings"
        private const val PENDING_DIR = "pending"
        /** Pending formats to recover after a crash; m4a is from builds before the Opus switch. */
        private val PLAIN_EXTENSIONS = setOf("ogg", "awb", "m4a")
        private const val ENCRYPTED_EXTENSION = "psm"
        private const val MIN_FREE_BYTES = 50L * 1024 * 1024
        private const val STORAGE_RESERVE_BYTES = 20L * 1024 * 1024
    }
}

/**
 * Speech-oriented encoder settings, smallest first. Both are 16 kHz mono ("wideband"), which
 * covers the frequencies that matter for intelligible speech.
 */
internal enum class AudioProfile(
    val outputFormat: Int,
    val audioEncoder: Int,
    val sampleRateHz: Int,
    val bitRateBps: Int,
    val extension: String,
) {
    /** Opus in Ogg, 12 kbps (~90 KB/min). Android ships a software Opus encoder from API 29. */
    OPUS(MediaRecorder.OutputFormat.OGG, MediaRecorder.AudioEncoder.OPUS, 16_000, 12_000, "ogg"),

    /** AMR-WB at its 12.65 kbps mode (~95 KB/min), for devices without an Opus encoder. */
    AMR_WB(MediaRecorder.OutputFormat.AMR_WB, MediaRecorder.AudioEncoder.AMR_WB, 16_000, 12_650, "awb"),
}
