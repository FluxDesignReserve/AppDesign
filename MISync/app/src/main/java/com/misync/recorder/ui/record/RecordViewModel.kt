package com.misync.recorder.ui.record

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.misync.recorder.MISyncApp
import com.misync.recorder.audio.CaptureSource
import com.misync.recorder.data.RecordingFileStore
import com.misync.recorder.service.RecorderState
import com.misync.recorder.service.RecordingController
import com.misync.recorder.settings.AppSettings
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

data class RecordUiState(
    val recorder: RecorderState = RecorderState(),
    val selectedSource: CaptureSource = CaptureSource.MIC,
)

class RecordViewModel(
    private val controller: RecordingController,
    private val settings: AppSettings,
    private val fileStore: RecordingFileStore,
) : ViewModel() {

    val state: StateFlow<RecordUiState> = combine(controller.state, settings.source) { recorder, source ->
        RecordUiState(recorder, source)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), RecordUiState())

    fun freeBytes(): Long = runCatching { fileStore.freeBytes() }.getOrDefault(0L)

    fun start() {
        if (!fileStore.canStartRecording()) {
            controller.update { it.copy(message = "Not enough free storage to start recording") }
            return
        }
        controller.start(settings.source.value)
    }

    fun pause() = controller.pause()
    fun resume() = controller.resume()
    fun stop() = controller.stop()
    fun dismissMessage() = controller.clearMessage()
    fun selectSource(source: CaptureSource) = settings.setSource(source)

    fun reportPermissionDenied() =
        controller.update { it.copy(message = "Microphone permission is required to record") }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val c = (this[APPLICATION_KEY] as MISyncApp).container
                RecordViewModel(c.recordingController, c.settings, c.fileStore)
            }
        }
    }
}
