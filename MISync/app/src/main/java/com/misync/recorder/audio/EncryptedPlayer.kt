package com.misync.recorder.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import com.misync.recorder.crypto.EncryptedAudioReader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.IOException

/**
 * Plays an encrypted recording by decrypting one chunk at a time straight into an
 * [AudioTrack]. Decrypted audio only ever exists in memory — no plaintext temp files.
 */
class EncryptedPlayer(context: Context, private val scope: CoroutineScope) {

    data class State(
        val recordingId: Long? = null,
        val playing: Boolean = false,
        val positionMs: Long = 0,
        val durationMs: Long = 0,
        val error: String? = null,
    )

    private val audioManager = context.getSystemService(AudioManager::class.java)
    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    private var reader: EncryptedAudioReader? = null
    private var track: AudioTrack? = null
    private var feedJob: Job? = null
    private var tickJob: Job? = null
    private var sessionStartBytes = 0L
    private var focusRequest: AudioFocusRequest? = null

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) pause()
    }

    /** Takes ownership of [newReader]; it is closed by [stop] or when another recording is opened. */
    fun open(recordingId: Long, newReader: EncryptedAudioReader) {
        stop()
        reader = newReader
        _state.value = State(recordingId = recordingId, durationMs = newReader.durationMillis)
        startSession(0)
    }

    fun pause() {
        track?.pause()
        _state.update { it.copy(playing = false) }
    }

    fun resume() {
        val current = _state.value
        if (reader == null) return
        if (track == null || current.positionMs >= current.durationMs) {
            startSession(if (current.positionMs >= current.durationMs) 0 else current.positionMs)
        } else if (requestFocus()) {
            track?.play()
            _state.update { it.copy(playing = true) }
        }
    }

    fun seekTo(positionMs: Long) {
        if (reader == null) return
        val wasPlaying = _state.value.playing
        startSession(positionMs.coerceIn(0, _state.value.durationMs), autoplay = wasPlaying)
    }

    fun stop() {
        endSession()
        reader?.close()
        reader = null
        abandonFocus()
        _state.value = State()
    }

    private fun startSession(positionMs: Long, autoplay: Boolean = true) {
        val r = reader ?: return
        endSession()
        val header = r.header
        val frameBytes = header.channels * 2
        var startBytes = positionMs * header.bytesPerSecond / 1000
        startBytes -= startBytes % frameBytes
        sessionStartBytes = startBytes.coerceIn(0, r.totalPlaintextBytes)

        val channelMask = if (header.channels == 2) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO
        val minBuffer = AudioTrack.getMinBufferSize(header.sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT)
        val audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(header.sampleRate)
                    .setChannelMask(channelMask)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .build(),
            )
            .setBufferSizeInBytes(minBuffer * 4)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        track = audioTrack
        val playing = autoplay && requestFocus()
        if (playing) audioTrack.play()
        _state.update { it.copy(playing = playing, positionMs = header.bytesToMillis(sessionStartBytes), error = null) }

        feedJob = scope.launch(Dispatchers.IO) {
            try {
                if (r.dataChunkCount == 0) return@launch
                var index = r.chunkIndexFor(sessionStartBytes)
                var skip = (sessionStartBytes - index.toLong() * header.chunkSize).toInt()
                while (isActive && index < r.dataChunkCount) {
                    val pcm = r.readChunk(index)
                    var offset = skip.coerceAtMost(pcm.size)
                    skip = 0
                    while (isActive && offset < pcm.size) {
                        val written = audioTrack.write(pcm, offset, pcm.size - offset)
                        if (written <= 0) return@launch // track stopped or released
                        offset += written
                    }
                    index++
                }
            } catch (e: IOException) {
                _state.update { it.copy(playing = false, error = e.message ?: "Recording is damaged") }
                runCatching { audioTrack.pause() }
            } catch (e: IllegalStateException) {
                // Track released during a seek or stop.
            }
        }
        tickJob = scope.launch {
            val total = r.totalPlaintextBytes
            while (isActive) {
                val played = runCatching { audioTrack.playbackHeadPosition.toLong() * frameBytes }.getOrDefault(0L)
                val position = (sessionStartBytes + played).coerceAtMost(total)
                _state.update { it.copy(positionMs = header.bytesToMillis(position)) }
                if (position >= total && feedJob?.isActive != true) {
                    _state.update { it.copy(playing = false, positionMs = it.durationMs) }
                    endSession()
                    abandonFocus()
                    break
                }
                delay(100)
            }
        }
    }

    private fun endSession() {
        tickJob?.cancel()
        tickJob = null
        feedJob?.cancel()
        feedJob = null
        track?.let { t ->
            runCatching { t.pause(); t.flush(); t.stop() }
            t.release()
        }
        track = null
    }

    private fun requestFocus(): Boolean {
        val request = focusRequest ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build(),
            )
            .setOnAudioFocusChangeListener(focusListener)
            .build()
            .also { focusRequest = it }
        return audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonFocus() {
        focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    }
}
