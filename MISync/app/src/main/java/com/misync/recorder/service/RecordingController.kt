package com.misync.recorder.service

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.misync.recorder.audio.CaptureSource
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class RecorderPhase { IDLE, STARTING, RECORDING, PAUSED, STOPPING }

data class RecorderState(
    val phase: RecorderPhase = RecorderPhase.IDLE,
    val source: CaptureSource = CaptureSource.MIC,
    val recordingId: Long? = null,
    val elapsedMs: Long = 0,
    val level: Float = 0f,
    /** The system is feeding this app silence (call in progress or input taken by another app). */
    val silenced: Boolean = false,
    val message: String? = null,
) {
    val isActive: Boolean get() = phase != RecorderPhase.IDLE
}

/**
 * Process-wide recording state, written by [RecordingService] and observed by the UI.
 * UI requests go through explicit service intents so recording always runs inside the
 * foreground service and is visible in the notification shade.
 */
class RecordingController(private val context: Context) {

    private val _state = MutableStateFlow(RecorderState())
    val state: StateFlow<RecorderState> = _state.asStateFlow()

    fun start(source: CaptureSource) {
        if (_state.value.isActive) return
        _state.value = RecorderState(phase = RecorderPhase.STARTING, source = source)
        val intent = RecordingService.intent(context, RecordingService.ACTION_START).putExtra(RecordingService.EXTRA_SOURCE, source.name)
        ContextCompat.startForegroundService(context, intent)
    }

    fun pause() = send(RecordingService.ACTION_PAUSE)
    fun resume() = send(RecordingService.ACTION_RESUME)
    fun stop() = send(RecordingService.ACTION_STOP)

    fun clearMessage() = _state.update { it.copy(message = null) }

    private fun send(action: String) {
        if (!_state.value.isActive) return
        context.startService(RecordingService.intent(context, action))
    }

    internal fun update(transform: (RecorderState) -> RecorderState) = _state.update(transform)
}
