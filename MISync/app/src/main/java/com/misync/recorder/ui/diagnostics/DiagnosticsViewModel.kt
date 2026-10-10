package com.misync.recorder.ui.diagnostics

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.misync.recorder.MISyncApp
import com.misync.recorder.audio.CaptureSource
import com.misync.recorder.diagnostics.DeviceSnapshot
import com.misync.recorder.diagnostics.DiagnosticsRunner
import com.misync.recorder.diagnostics.SourceProbe
import com.misync.recorder.security.AppLock
import com.misync.recorder.service.RecordingController
import com.misync.recorder.settings.AppSettings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DiagnosticsUiState(
    val snapshot: DeviceSnapshot? = null,
    val probes: List<SourceProbe> = emptyList(),
    val running: CaptureSource? = null,
    val saveClips: Boolean = false,
    val report: String? = null,
    val blockedReason: String? = null,
)

class DiagnosticsViewModel(
    private val app: Application,
    private val runner: DiagnosticsRunner,
    private val controller: RecordingController,
    val settings: AppSettings,
) : ViewModel() {

    private val _state = MutableStateFlow(DiagnosticsUiState())
    val state: StateFlow<DiagnosticsUiState> = _state.asStateFlow()

    val appLockAvailable: Boolean get() = AppLock.isAvailable(app)

    init {
        refreshSnapshot()
    }

    fun refreshSnapshot() {
        _state.update { it.copy(snapshot = runner.snapshot(AppLock.describe(app))) }
    }

    fun setSaveClips(save: Boolean) = _state.update { it.copy(saveClips = save) }

    fun runScan() {
        if (_state.value.running != null) return
        if (controller.state.value.isActive) {
            _state.update { it.copy(blockedReason = "Stop the current recording before running diagnostics.") }
            return
        }
        viewModelScope.launch {
            refreshSnapshot()
            _state.update { it.copy(probes = emptyList(), report = null, blockedReason = null) }
            val saveClips = _state.value.saveClips
            val durationMs = if (saveClips) 8_000L else 1_500L
            for (source in CaptureSource.entries) {
                _state.update { it.copy(running = source) }
                // Only save clips for sources that can actually be used for recordings.
                val probe = runner.probe(source, durationMs, saveClip = saveClips && source.userSelectable)
                _state.update { it.copy(probes = it.probes + probe) }
            }
            val snapshot = _state.value.snapshot ?: runner.snapshot(AppLock.describe(app))
            _state.update { it.copy(running = null, report = runner.buildReport(snapshot, it.probes)) }
        }
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as MISyncApp
                val c = app.container
                DiagnosticsViewModel(app, c.diagnostics, c.recordingController, c.settings)
            }
        }
    }
}
