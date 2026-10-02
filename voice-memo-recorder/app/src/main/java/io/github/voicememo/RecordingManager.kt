package io.github.voicememo

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.media.MediaRecorder
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.io.IOException
import java.time.LocalDateTime

/**
 * Owns the [MediaRecorder] and the recordings directory. There is one instance per process
 * (see [VoiceMemoApp.recordingManager]) so the service, which drives recording, and the
 * activity, which displays it, observe the same [state].
 *
 * Output: AAC-LC in an MPEG-4 container (`.m4a`), mono, 44.1 kHz, 128 kbps — roughly
 * 1 MB per minute — written to `filesDir/recordings`, which is private to the app.
 *
 * Call from the main thread. [MediaRecorder] posts its callbacks to the looper of the thread
 * that created it, so keeping everything on the main thread avoids racing those callbacks.
 */
class RecordingManager(context: Context) {

    private val appContext = context.applicationContext

    val recordingsDir: File = File(appContext.filesDir, RECORDINGS_DIR)

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
        if (!recordingsDir.isDirectory && !recordingsDir.mkdirs()) {
            throw RecordingException("Could not create the recordings folder.")
        }
        val freeBytes = recordingsDir.usableSpace
        if (freeBytes < MIN_FREE_BYTES) {
            throw RecordingException("Not enough free storage to start recording.")
        }

        val file = uniqueFile(LocalDateTime.now())
        val mediaRecorder = MediaRecorder(appContext)
        try {
            mediaRecorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioChannels(1)
                setAudioSamplingRate(SAMPLE_RATE_HZ)
                setAudioEncodingBitRate(BIT_RATE_BPS)
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
            // IllegalStateException / RuntimeException("start failed"): usually the mic is busy.
            discard(mediaRecorder, file)
            throw RecordingException("Could not start the microphone. Is another app using it?", e)
        }

        recorder = mediaRecorder
        _state.value = RecordingState.Recording(
            file = file,
            accumulatedMs = 0,
            segmentStartRealtime = SystemClock.elapsedRealtime(),
        )
        Log.i(TAG, "Recording started: ${file.name}")
        return file
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
     * Finalises the file and returns it, or returns null if nothing usable was captured
     * (in which case the partial file is deleted). Safe to call in any state.
     */
    fun stop(): File? {
        val current = _state.value as? RecordingState.Active ?: return null
        val mediaRecorder = recorder
        recorder = null
        _state.value = RecordingState.Idle

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

        if (saved != null) {
            Log.i(TAG, "Recording saved: ${saved.name} (${saved.length()} bytes)")
            _events.tryEmit(RecordingEvent.Saved(saved))
        } else {
            _events.tryEmit(RecordingEvent.Failed("The recording was too short to save."))
        }
        return saved
    }

    /** Lets other components (e.g. the service) report failures through the same channel. */
    fun reportError(message: String, cause: Throwable? = null) {
        Log.e(TAG, message, cause)
        _events.tryEmit(RecordingEvent.Failed(message, cause))
    }

    /**
     * Finished recordings, newest first. Reads each file's duration, so call it off the
     * main thread.
     */
    fun listRecordings(): List<VoiceMemo> {
        val activeFile = (_state.value as? RecordingState.Active)?.file
        val files = recordingsDir.listFiles { f -> f.isFile && f.extension == EXTENSION }
            ?: return emptyList()
        return files
            .filter { it != activeFile }
            .sortedByDescending { it.lastModified() }
            .map { f -> VoiceMemo(f, f.length(), f.lastModified(), readDurationMs(f)) }
    }

    /** Deletes a finished recording. Refuses files outside [recordingsDir] or in use. */
    fun delete(file: File): Boolean {
        if (file.canonicalFile.parentFile != recordingsDir.canonicalFile) return false
        if ((_state.value as? RecordingState.Active)?.file == file) return false
        return file.delete()
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

    private fun uniqueFile(now: LocalDateTime): File {
        val base = Format.recordingFileName(now)
        var candidate = File(recordingsDir, base)
        var n = 1
        while (candidate.exists()) {
            candidate = File(recordingsDir, base.removeSuffix(".$EXTENSION") + "_$n.$EXTENSION")
            n++
        }
        return candidate
    }

    private fun readDurationMs(file: File): Long? = try {
        MediaMetadataRetriever().use { retriever ->
            retriever.setDataSource(file.absolutePath)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
        }
    } catch (e: RuntimeException) {
        Log.w(TAG, "Could not read duration of ${file.name}", e)
        null
    }

    companion object {
        private const val TAG = "RecordingManager"
        private const val RECORDINGS_DIR = "recordings"
        private const val EXTENSION = "m4a"
        private const val SAMPLE_RATE_HZ = 44_100
        private const val BIT_RATE_BPS = 128_000
        private const val MIN_FREE_BYTES = 50L * 1024 * 1024
        private const val STORAGE_RESERVE_BYTES = 20L * 1024 * 1024
    }
}
