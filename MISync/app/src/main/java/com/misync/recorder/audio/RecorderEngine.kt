package com.misync.recorder.audio

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import androidx.core.content.ContextCompat
import java.io.IOException
import java.util.concurrent.Executors

enum class StopReason { USER, STORAGE_FULL, STORAGE_ERROR, DEVICE_ERROR }

/**
 * Captures PCM with [AudioRecord] on a dedicated thread and hands each buffer to [onAudio].
 *
 * Interruptions are reported rather than hidden: when Android silences this client (an
 * incoming call, or another app holding a privacy-sensitive input such as a VoIP call),
 * [onSilenced] fires so the UI and notification can say so. If [onAudio] throws an
 * [IOException] (disk full, I/O error) or the audio HAL dies, capture stops and [onStopped]
 * reports why. [onStopped] is always called exactly once, on the capture thread, after the
 * last [onAudio] call — so the consumer can safely close its writer there.
 */
class RecorderEngine(
    private val context: Context,
    private val source: CaptureSource,
    private val onAudio: (ByteArray, Int) -> Unit,
    private val onLevel: (Float) -> Unit,
    private val onSilenced: (Boolean) -> Unit,
    private val onStopped: (StopReason, Throwable?) -> Unit,
) {
    private val lock = Object()
    private var record: AudioRecord? = null
    private var thread: Thread? = null
    @Volatile private var stopRequested = false
    @Volatile private var pauseRequested = false
    @Volatile private var systemSilenced = false
    private var zeroRunBytes = 0L
    private var reportedSilenced = false
    private val callbackExecutor = Executors.newSingleThreadExecutor()

    private val recordingCallback = object : AudioManager.AudioRecordingCallback() {
        override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>) {
            val session = record?.audioSessionId ?: return
            val mine = configs.firstOrNull { it.clientAudioSessionId == session } ?: return
            systemSilenced = mine.isClientSilenced
        }
    }

    /** @throws IllegalStateException if the source cannot be opened; [SecurityException] without permission. */
    @SuppressLint("MissingPermission")
    fun start() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            throw SecurityException("Microphone permission not granted")
        }
        val minBuffer = AudioRecord.getMinBufferSize(AudioFormatSpec.SAMPLE_RATE, AudioFormatSpec.CHANNEL_IN, AudioFormatSpec.ENCODING)
        if (minBuffer <= 0) throw IllegalStateException("Device does not support 44.1 kHz mono capture")
        val bufferBytes = maxOf(minBuffer * 2, AudioFormatSpec.SAMPLE_RATE / 5 * 2) // ≥ 200 ms
        val audioRecord = try {
            AudioRecord(source.id, AudioFormatSpec.SAMPLE_RATE, AudioFormatSpec.CHANNEL_IN, AudioFormatSpec.ENCODING, bufferBytes)
        } catch (e: IllegalArgumentException) {
            throw IllegalStateException("${source.label} is not available on this device", e)
        }
        if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
            audioRecord.release()
            throw IllegalStateException("${source.label} could not be initialised")
        }
        audioRecord.registerAudioRecordingCallback(callbackExecutor, recordingCallback)
        audioRecord.startRecording()
        if (audioRecord.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
            audioRecord.release()
            throw IllegalStateException("Microphone is in use by another app or blocked by the system")
        }
        record = audioRecord
        thread = Thread({ loop(audioRecord, minBuffer.coerceAtLeast(4096)) }, "MISync-capture").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    fun pause() {
        pauseRequested = true
    }

    fun resume() {
        synchronized(lock) {
            pauseRequested = false
            lock.notifyAll()
        }
    }

    fun stop() {
        synchronized(lock) {
            stopRequested = true
            lock.notifyAll()
        }
    }

    private fun loop(audioRecord: AudioRecord, readBytes: Int) {
        val buffer = ByteArray(readBytes)
        var reason = StopReason.USER
        var error: Throwable? = null
        var isRecording = true
        try {
            while (!stopRequested) {
                if (pauseRequested) {
                    if (isRecording) {
                        audioRecord.stop()
                        isRecording = false
                        onLevel(0f)
                    }
                    synchronized(lock) {
                        while (pauseRequested && !stopRequested) lock.wait()
                    }
                    continue
                }
                if (!isRecording) {
                    audioRecord.startRecording()
                    isRecording = true
                }
                val n = audioRecord.read(buffer, 0, buffer.size)
                when {
                    n > 0 -> {
                        onAudio(buffer, n)
                        onLevel(peakLevel(buffer, n))
                        updateSilenced(buffer, n)
                    }
                    n == AudioRecord.ERROR_DEAD_OBJECT -> {
                        reason = StopReason.DEVICE_ERROR
                        error = IllegalStateException("Audio input was lost (device error)")
                        break
                    }
                    n < 0 -> {
                        reason = StopReason.DEVICE_ERROR
                        error = IllegalStateException("Audio read failed ($n)")
                        break
                    }
                }
            }
        } catch (e: StorageFullException) {
            reason = StopReason.STORAGE_FULL
            error = e
        } catch (e: IOException) {
            reason = StopReason.STORAGE_ERROR
            error = e
        } catch (e: RuntimeException) {
            reason = StopReason.DEVICE_ERROR
            error = e
        } finally {
            runCatching { audioRecord.unregisterAudioRecordingCallback(recordingCallback) }
            runCatching { audioRecord.stop() }
            audioRecord.release()
            record = null
            callbackExecutor.shutdown()
            onStopped(reason, error)
        }
    }

    private fun updateSilenced(buffer: ByteArray, n: Int) {
        // Some HALs deliver zeros without flagging the client as silenced; treat >2 s of pure
        // digital silence as silenced too.
        val allZero = (0 until n).all { buffer[it].toInt() == 0 }
        zeroRunBytes = if (allZero) zeroRunBytes + n else 0
        val silenced = systemSilenced || zeroRunBytes > AudioFormatSpec.SAMPLE_RATE * 2L * 2
        if (silenced != reportedSilenced) {
            reportedSilenced = silenced
            onSilenced(silenced)
        }
    }
}

/** Thrown by an [RecorderEngine] consumer to stop capture because free space is critically low. */
class StorageFullException(message: String) : IOException(message)
