package com.misync.recorder.ui.library

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.misync.recorder.MISyncApp
import com.misync.recorder.audio.EncryptedPlayer
import com.misync.recorder.data.RecordingEntity
import com.misync.recorder.data.RecordingRepository
import com.misync.recorder.data.RecordingStatus
import com.misync.recorder.service.RecordingController
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class LibraryViewModel(
    application: Application,
    private val repository: RecordingRepository,
    controller: RecordingController,
) : ViewModel() {

    private val player = EncryptedPlayer(application, viewModelScope)

    val recordings: StateFlow<List<RecordingEntity>> =
        repository.observeAll().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val playback: StateFlow<EncryptedPlayer.State> = player.state

    /** The recording currently being written, which cannot be played, renamed or deleted yet. */
    val activeRecordingId: StateFlow<Long?> = MutableStateFlow<Long?>(null).also { flow ->
        viewModelScope.launch { controller.state.collect { flow.value = it.recordingId } }
    }

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun togglePlay(entity: RecordingEntity) {
        val current = player.state.value
        if (current.recordingId == entity.id) {
            if (current.playing) player.pause() else player.resume()
            return
        }
        if (entity.status == RecordingStatus.RECORDING) return
        viewModelScope.launch {
            try {
                val reader = repository.openReader(entity)
                if (reader.dataChunkCount == 0) {
                    reader.close()
                    _message.value = "This recording is empty"
                    return@launch
                }
                player.open(entity.id, reader)
            } catch (e: Exception) {
                _message.value = "Cannot play “${entity.title}”: ${e.message ?: "recording is damaged"}"
            }
        }
    }

    fun seekTo(positionMs: Long) = player.seekTo(positionMs)

    fun rename(entity: RecordingEntity, title: String): String? {
        val valid = try {
            RecordingRepository.validateTitle(title)
        } catch (e: IllegalArgumentException) {
            return e.message
        }
        viewModelScope.launch {
            runCatching { repository.rename(entity.id, valid) }
                .onFailure { _message.value = "Rename failed: ${it.message}" }
        }
        return null
    }

    fun delete(entity: RecordingEntity) {
        if (player.state.value.recordingId == entity.id) player.stop()
        viewModelScope.launch {
            runCatching { repository.delete(entity.id) }
                .onSuccess { _message.value = "Deleted “${entity.title}”" }
                .onFailure { _message.value = "Delete failed: ${it.message}" }
        }
    }

    fun dismissMessage() {
        _message.value = null
    }

    override fun onCleared() {
        player.stop()
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as MISyncApp
                LibraryViewModel(app, app.container.repository, app.container.recordingController)
            }
        }
    }
}
