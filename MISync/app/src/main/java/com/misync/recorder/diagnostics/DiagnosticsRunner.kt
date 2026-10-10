package com.misync.recorder.diagnostics

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.AudioRecord
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.misync.recorder.audio.AudioFormatSpec
import com.misync.recorder.audio.CaptureSource
import com.misync.recorder.audio.peakLevel
import com.misync.recorder.audio.rmsDbfs
import com.misync.recorder.data.RecordingRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

enum class ProbeStatus(val label: String) {
    SIGNAL("Signal captured"),
    SILENT("Opened, digital silence"),
    SILENCED("Opened, silenced by system"),
    UNAVAILABLE("Not available"),
    DENIED("Permission missing"),
}

data class SourceProbe(
    val source: CaptureSource,
    val status: ProbeStatus,
    val peak: Float = 0f,
    val rmsDbfs: Double = Double.NEGATIVE_INFINITY,
    val detail: String = "",
    val savedRecordingId: Long? = null,
)

data class DeviceSnapshot(
    val manufacturer: String,
    val model: String,
    val device: String,
    val androidRelease: String,
    val sdkInt: Int,
    val buildDisplay: String,
    val hasMicrophone: Boolean,
    val unprocessedSupported: Boolean,
    val audioMode: Int,
    val recordPermission: Boolean,
    val notificationPermission: Boolean,
    val appLock: String,
) {
    val audioModeLabel: String
        get() = when (audioMode) {
            AudioManager.MODE_NORMAL -> "NORMAL (no call)"
            AudioManager.MODE_RINGTONE -> "RINGTONE"
            AudioManager.MODE_IN_CALL -> "IN_CALL (cellular call active)"
            AudioManager.MODE_IN_COMMUNICATION -> "IN_COMMUNICATION (VoIP call active, e.g. WhatsApp)"
            AudioManager.MODE_CALL_SCREENING -> "CALL_SCREENING"
            else -> "UNKNOWN ($audioMode)"
        }

    val callActive: Boolean
        get() = audioMode == AudioManager.MODE_IN_CALL || audioMode == AudioManager.MODE_IN_COMMUNICATION
}

/**
 * Probes each public capture source the way the recorder would use it, and measures what
 * actually arrives. Results describe what this app can capture on this device — nothing here
 * uses hidden APIs, root, accessibility services or any other way around Android's controls.
 *
 * Note that a "signal captured" result during a call does not prove both call participants
 * are audible: it only means non-silent audio arrived. That must be checked by listening to the
 * saved clip (see docs/DEVICE_COMPATIBILITY_REPORT.md).
 */
class DiagnosticsRunner(
    private val context: Context,
    private val repository: RecordingRepository,
) {

    fun snapshot(appLock: String): DeviceSnapshot {
        val audioManager = context.getSystemService(AudioManager::class.java)
        return DeviceSnapshot(
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            device = Build.DEVICE,
            androidRelease = Build.VERSION.RELEASE,
            sdkInt = Build.VERSION.SDK_INT,
            buildDisplay = Build.DISPLAY,
            hasMicrophone = context.packageManager.hasSystemFeature(PackageManager.FEATURE_MICROPHONE),
            unprocessedSupported = audioManager.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) == "true",
            audioMode = audioManager.mode,
            recordPermission = granted(Manifest.permission.RECORD_AUDIO),
            notificationPermission = Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.POST_NOTIFICATIONS),
            appLock = appLock,
        )
    }

    private fun granted(permission: String) =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    suspend fun probe(source: CaptureSource, durationMs: Long, saveClip: Boolean): SourceProbe = withContext(Dispatchers.IO) {
        if (!granted(Manifest.permission.RECORD_AUDIO)) return@withContext SourceProbe(source, ProbeStatus.DENIED, detail = "RECORD_AUDIO not granted")

        val minBuffer = AudioRecord.getMinBufferSize(AudioFormatSpec.SAMPLE_RATE, AudioFormatSpec.CHANNEL_IN, AudioFormatSpec.ENCODING)
        val record = try {
            AudioRecord(source.id, AudioFormatSpec.SAMPLE_RATE, AudioFormatSpec.CHANNEL_IN, AudioFormatSpec.ENCODING, maxOf(minBuffer, 4096) * 2)
        } catch (e: Exception) {
            return@withContext SourceProbe(source, ProbeStatus.UNAVAILABLE, detail = "${e.javaClass.simpleName}: ${e.message}")
        }
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            record.release()
            return@withContext SourceProbe(source, ProbeStatus.UNAVAILABLE, detail = "AudioRecord not initialised (source rejected by audio policy)")
        }

        val clip = if (saveClip) {
            runCatching {
                repository.startRecording(source.name, AudioFormatSpec.SAMPLE_RATE, AudioFormatSpec.CHANNELS, titlePrefix = "Diagnostic · ${source.label} ·")
            }.getOrNull()
        } else {
            null
        }

        var peak = 0f
        var sumSquares = 0.0
        var samples = 0L
        var silencedFlag = false
        var readError: String? = null
        try {
            record.startRecording()
            if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
                return@withContext SourceProbe(source, ProbeStatus.UNAVAILABLE, detail = "startRecording() refused (input busy or blocked)")
            }
            val buffer = ByteArray(maxOf(minBuffer, 4096))
            val end = SystemClock.elapsedRealtime() + durationMs
            while (SystemClock.elapsedRealtime() < end) {
                val n = record.read(buffer, 0, buffer.size)
                if (n < 0) {
                    readError = "read() returned $n"
                    break
                }
                if (n == 0) continue
                clip?.writer?.write(buffer, 0, n)
                peak = maxOf(peak, peakLevel(buffer, n))
                val db = rmsDbfs(buffer, n)
                if (db.isFinite()) {
                    val rms = Math.pow(10.0, db / 20) * 32768
                    sumSquares += rms * rms * (n / 2)
                }
                samples += n / 2
                if (record.activeRecordingConfiguration?.isClientSilenced == true) silencedFlag = true
            }
        } finally {
            runCatching { record.stop() }
            record.release()
            if (clip != null) withContext(NonCancellable) { repository.finishRecording(clip, note = "Diagnostic capture") }
        }

        val rms = if (samples == 0L || sumSquares == 0.0) Double.NEGATIVE_INFINITY else 20 * Math.log10(Math.sqrt(sumSquares / samples) / 32768)
        val status = when {
            readError != null -> ProbeStatus.UNAVAILABLE
            silencedFlag -> ProbeStatus.SILENCED
            peak == 0f -> ProbeStatus.SILENT
            else -> ProbeStatus.SIGNAL
        }
        SourceProbe(
            source = source,
            status = status,
            peak = peak,
            rmsDbfs = rms,
            detail = readError ?: "",
            savedRecordingId = clip?.entity?.id,
        )
    }

    fun buildReport(snapshot: DeviceSnapshot, probes: List<SourceProbe>): String = buildString {
        appendLine("MISync compatibility diagnostics")
        appendLine("Generated: ${LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)}")
        appendLine()
        appendLine("Device: ${snapshot.manufacturer} ${snapshot.model} (${snapshot.device})")
        appendLine("Android: ${snapshot.androidRelease} (API ${snapshot.sdkInt}), build ${snapshot.buildDisplay}")
        appendLine("Microphone feature: ${snapshot.hasMicrophone}")
        appendLine("UNPROCESSED source supported (property): ${snapshot.unprocessedSupported}")
        appendLine("Audio mode during test: ${snapshot.audioModeLabel}")
        appendLine("Permissions: RECORD_AUDIO=${snapshot.recordPermission}, POST_NOTIFICATIONS=${snapshot.notificationPermission}")
        appendLine("Access protection: ${snapshot.appLock}")
        appendLine()
        appendLine("Source probes:")
        for (p in probes) {
            val level = if (p.rmsDbfs.isFinite()) "%.1f dBFS RMS, peak %.0f%%".format(p.rmsDbfs, p.peak * 100) else "no signal"
            append("  ${p.source.name.padEnd(20)} ${p.status.label.padEnd(28)} $level")
            if (p.detail.isNotBlank()) append("  [${p.detail}]")
            if (p.savedRecordingId != null) append("  clip #${p.savedRecordingId}")
            appendLine()
        }
        appendLine()
        appendLine("Playback capture (AudioPlaybackCapture/MediaProjection): not probed. By API contract it can only")
        appendLine("match USAGE_MEDIA, USAGE_GAME and USAGE_UNKNOWN; VoIP call audio (USAGE_VOICE_COMMUNICATION) is excluded.")
        appendLine()
        if (snapshot.callActive) {
            appendLine("A call was active. Listen to each saved clip and record whether the LOCAL and REMOTE voices")
            appendLine("are audible. Only report two-sided support if both voices are clearly heard.")
        } else {
            appendLine("No call was active. To test call capture, start a call, return to MISync and run again.")
        }
    }
}
