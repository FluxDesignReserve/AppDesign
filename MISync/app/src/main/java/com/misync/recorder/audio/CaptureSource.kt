package com.misync.recorder.audio

import android.media.MediaRecorder

/**
 * Audio sources exposed through public Android APIs.
 *
 * [userSelectable] sources may be used for normal recordings. The call sources are listed only
 * so diagnostics can report how the device answers; on stock Android they require the
 * system-only CAPTURE_AUDIO_OUTPUT permission and are expected to fail for a regular app.
 */
enum class CaptureSource(val id: Int, val label: String, val description: String, val userSelectable: Boolean) {
    MIC(MediaRecorder.AudioSource.MIC, "Microphone", "Default microphone with device processing", true),
    VOICE_RECOGNITION(MediaRecorder.AudioSource.VOICE_RECOGNITION, "Voice (clean)", "Tuned for speech, minimal processing", true),
    UNPROCESSED(MediaRecorder.AudioSource.UNPROCESSED, "Unprocessed", "Raw microphone signal if the device supports it", true),
    CAMCORDER(MediaRecorder.AudioSource.CAMCORDER, "Camcorder", "Microphone oriented like the camera", true),
    VOICE_COMMUNICATION(MediaRecorder.AudioSource.VOICE_COMMUNICATION, "Voice call tuned", "Echo cancellation and noise suppression", true),
    VOICE_PERFORMANCE(MediaRecorder.AudioSource.VOICE_PERFORMANCE, "Performance", "Low-latency capture for live audio", true),
    VOICE_CALL(MediaRecorder.AudioSource.VOICE_CALL, "Voice call (both sides)", "Cellular call uplink + downlink — system apps only", false),
    VOICE_UPLINK(MediaRecorder.AudioSource.VOICE_UPLINK, "Voice uplink", "Cellular call, local side — system apps only", false),
    VOICE_DOWNLINK(MediaRecorder.AudioSource.VOICE_DOWNLINK, "Voice downlink", "Cellular call, remote side — system apps only", false),
    REMOTE_SUBMIX(MediaRecorder.AudioSource.REMOTE_SUBMIX, "Remote submix", "Device output mix — system apps only", false);

    companion object {
        val selectable = entries.filter { it.userSelectable }
        fun fromName(name: String?): CaptureSource = entries.firstOrNull { it.name == name } ?: MIC
    }
}
