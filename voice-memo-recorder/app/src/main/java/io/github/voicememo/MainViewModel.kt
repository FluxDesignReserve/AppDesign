package io.github.voicememo

import android.app.Application
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.util.Log
import androidx.annotation.StringRes
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

/** A message for the snackbar: either a resource with args, or literal text from the recorder. */
sealed interface UiMessage {
    data class Res(@StringRes val id: Int, val args: List<Any> = emptyList()) : UiMessage
    data class Text(val text: String) : UiMessage
}

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val manager = (application as VoiceMemoApp).recordingManager

    val recordingState: StateFlow<RecordingState> = manager.state

    private val _memos = MutableStateFlow<List<VoiceMemo>>(emptyList())
    val memos: StateFlow<List<VoiceMemo>> = _memos.asStateFlow()

    private val _playingFile = MutableStateFlow<File?>(null)
    val playingFile: StateFlow<File?> = _playingFile.asStateFlow()

    private val _messages = Channel<UiMessage>(Channel.BUFFERED)
    val messages: Flow<UiMessage> = _messages.receiveAsFlow()

    private var player: MediaPlayer? = null

    init {
        refresh()
        viewModelScope.launch {
            manager.events.collect { event ->
                when (event) {
                    is RecordingEvent.Saved -> {
                        refresh()
                        _messages.send(UiMessage.Res(R.string.msg_saved, listOf(event.file.nameWithoutExtension)))
                    }
                    is RecordingEvent.Failed -> _messages.send(UiMessage.Text(event.message))
                }
            }
        }
        viewModelScope.launch {
            // Don't play back through the speaker while the mic is capturing.
            manager.state.collect { if (it is RecordingState.Active) stopPlayback() }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _memos.value = withContext(Dispatchers.IO) { manager.listRecordings() }
        }
    }

    fun togglePlayback(memo: VoiceMemo) {
        if (_playingFile.value == memo.file) {
            stopPlayback()
            return
        }
        stopPlayback()
        val mediaPlayer = MediaPlayer()
        try {
            mediaPlayer.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            mediaPlayer.setDataSource(memo.file.absolutePath)
            mediaPlayer.setOnCompletionListener { stopPlayback() }
            mediaPlayer.prepare() // Local file: synchronous prepare is fast enough.
            mediaPlayer.start()
        } catch (e: IOException) {
            onPlaybackFailed(mediaPlayer, memo, e)
            return
        } catch (e: RuntimeException) {
            onPlaybackFailed(mediaPlayer, memo, e)
            return
        }
        player = mediaPlayer
        _playingFile.value = memo.file
    }

    fun stopPlayback() {
        player?.run {
            try {
                stop()
            } catch (_: IllegalStateException) {
            }
            release()
        }
        player = null
        _playingFile.value = null
    }

    fun delete(memo: VoiceMemo) {
        if (_playingFile.value == memo.file) stopPlayback()
        viewModelScope.launch {
            val deleted = withContext(Dispatchers.IO) { manager.delete(memo.file) }
            val msg = if (deleted) R.string.msg_deleted else R.string.msg_delete_failed
            _messages.send(UiMessage.Res(msg, listOf(memo.name)))
            refresh()
        }
    }

    fun showMessage(message: UiMessage) {
        _messages.trySend(message)
    }

    private fun onPlaybackFailed(mediaPlayer: MediaPlayer, memo: VoiceMemo, e: Exception) {
        Log.w("MainViewModel", "Playback failed for ${memo.file.name}", e)
        mediaPlayer.release()
        _messages.trySend(UiMessage.Res(R.string.msg_playback_failed, listOf(memo.name)))
    }

    override fun onCleared() {
        stopPlayback()
    }
}
