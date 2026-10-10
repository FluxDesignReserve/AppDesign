package com.misync.recorder.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.misync.recorder.MISyncApp
import com.misync.recorder.R
import com.misync.recorder.audio.AudioFormatSpec
import com.misync.recorder.audio.CaptureSource
import com.misync.recorder.audio.RecorderEngine
import com.misync.recorder.audio.StopReason
import com.misync.recorder.audio.StorageFullException
import com.misync.recorder.data.RecordingRepository
import com.misync.recorder.ui.MainActivity
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Foreground service (type `microphone`) that owns the capture pipeline:
 * [RecorderEngine] → [com.misync.recorder.crypto.EncryptedAudioWriter] → app-private storage.
 *
 * Recording is never covert: it can only be started from the visible UI, the persistent
 * notification is shown for the whole session with explicit Pause/Resume/Stop actions, and
 * Android's own microphone privacy indicator is active while capturing.
 */
class RecordingService : LifecycleService() {

    private val container by lazy { (application as MISyncApp).container }
    private val controller by lazy { container.recordingController }

    private var engine: RecorderEngine? = null
    private var active: RecordingRepository.ActiveRecording? = null
    private var stopRequestedWhileStarting = false
    private var lastSpaceCheck = 0L
    private var lastNotifiedPhase: RecorderPhase? = null
    private var lastNotifiedSilenced = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START -> handleStart(CaptureSource.fromName(intent.getStringExtra(EXTRA_SOURCE)))
            ACTION_PAUSE -> engine?.let {
                it.pause()
                controller.update { s -> s.copy(phase = RecorderPhase.PAUSED, level = 0f) }
                refreshNotification()
            }
            ACTION_RESUME -> engine?.let {
                it.resume()
                controller.update { s -> s.copy(phase = RecorderPhase.RECORDING) }
                refreshNotification()
            }
            ACTION_STOP -> requestStop()
            // Restarted by the system after process death with nothing to resume: the partial
            // file is repaired by RecordingRepository.recoverInterrupted() on next app start.
            null -> stopSelfSafely()
        }
        return START_NOT_STICKY
    }

    private fun handleStart(source: CaptureSource) {
        if (engine != null) return
        try {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(RecorderState(phase = RecorderPhase.STARTING, source = source)),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )
        } catch (e: Exception) {
            // Missing permission, or Android refused a microphone FGS (e.g. app not in foreground).
            Log.e(TAG, "Cannot start foreground recording", e)
            failStart("Recording could not start: ${e.message ?: "not allowed by the system"}")
            return
        }

        lifecycleScope.launch {
            val recording = try {
                container.repository.startRecording(source.name, AudioFormatSpec.SAMPLE_RATE, AudioFormatSpec.CHANNELS)
            } catch (e: Exception) {
                Log.e(TAG, "Cannot create recording", e)
                failStart(e.message ?: "Cannot create recording file")
                return@launch
            }
            active = recording
            val newEngine = RecorderEngine(
                context = this@RecordingService,
                source = source,
                onAudio = { buffer, length -> onAudio(recording, buffer, length) },
                onLevel = { level -> controller.update { it.copy(level = level) } },
                onSilenced = { silenced ->
                    controller.update { it.copy(silenced = silenced) }
                    lifecycleScope.launch { refreshNotification() }
                },
                onStopped = { reason, error -> lifecycleScope.launch { finish(reason, error) } },
            )
            try {
                newEngine.start()
            } catch (e: Exception) {
                Log.e(TAG, "Cannot open audio source", e)
                withContext(NonCancellable) { container.repository.finishRecording(recording, note = "Failed to start") }
                container.repository.delete(recording.entity.id)
                active = null
                failStart(e.message ?: "Microphone unavailable")
                return@launch
            }
            engine = newEngine
            controller.update { it.copy(phase = RecorderPhase.RECORDING, recordingId = recording.entity.id, message = null) }
            refreshNotification()
            if (stopRequestedWhileStarting) requestStop()
        }
    }

    /** Runs on the capture thread. */
    private fun onAudio(recording: RecordingRepository.ActiveRecording, buffer: ByteArray, length: Int) {
        recording.writer.write(buffer, 0, length)
        val bytesPerSecond = AudioFormatSpec.SAMPLE_RATE * AudioFormatSpec.CHANNELS * 2L
        val elapsed = recording.writer.plaintextBytes * 1000 / bytesPerSecond
        controller.update { it.copy(elapsedMs = elapsed) }
        val now = SystemClock.elapsedRealtime()
        if (now - lastSpaceCheck > SPACE_CHECK_INTERVAL_MS) {
            lastSpaceCheck = now
            if (container.fileStore.isCriticallyLow()) throw StorageFullException("Storage almost full")
        }
    }

    private fun requestStop() {
        val current = engine
        if (current == null) {
            // Still setting up: stop as soon as the engine exists.
            stopRequestedWhileStarting = true
            return
        }
        controller.update { it.copy(phase = RecorderPhase.STOPPING) }
        current.stop()
    }

    private suspend fun finish(reason: StopReason, error: Throwable?) {
        val recording = active ?: return
        active = null
        engine = null
        val note = when (reason) {
            StopReason.USER -> null
            StopReason.STORAGE_FULL -> "Stopped: storage almost full"
            StopReason.STORAGE_ERROR -> "Stopped: storage error (${error?.message ?: "I/O"})"
            StopReason.DEVICE_ERROR -> "Stopped: ${error?.message ?: "audio device error"}"
        }
        val finished = withContext(NonCancellable) { container.repository.finishRecording(recording, note) }
        controller.update {
            RecorderState(source = it.source, message = note ?: "Saved “${finished.title}”")
        }
        stopSelfSafely()
    }

    private fun failStart(message: String) {
        controller.update { RecorderState(source = it.source, message = message) }
        stopSelfSafely()
    }

    private fun stopSelfSafely() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        // If the service is torn down mid-recording, stop capture; the engine's onStopped
        // callback finalises the file, and recovery on next start covers anything left over.
        engine?.stop()
        super.onDestroy()
    }

    private fun refreshNotification() {
        val state = controller.state.value
        if (state.phase == lastNotifiedPhase && state.silenced == lastNotifiedSilenced) return
        lastNotifiedPhase = state.phase
        lastNotifiedSilenced = state.silenced
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(state))
    }

    private fun buildNotification(state: RecorderState): Notification {
        ensureChannel(this)
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val title = when {
            state.phase == RecorderPhase.PAUSED -> getString(R.string.notif_paused)
            state.silenced -> getString(R.string.notif_silenced)
            state.phase == RecorderPhase.STARTING -> getString(R.string.notif_starting)
            else -> getString(R.string.notif_recording)
        }
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(getString(R.string.notif_text, state.source.label))
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (state.phase == RecorderPhase.RECORDING) {
            builder.setUsesChronometer(true).setWhen(System.currentTimeMillis() - state.elapsedMs)
            builder.addAction(0, getString(R.string.action_pause), serviceIntent(ACTION_PAUSE, 1))
        } else if (state.phase == RecorderPhase.PAUSED) {
            builder.addAction(0, getString(R.string.action_resume), serviceIntent(ACTION_RESUME, 2))
        }
        builder.addAction(0, getString(R.string.action_stop), serviceIntent(ACTION_STOP, 3))
        return builder.build()
    }

    private fun serviceIntent(action: String, requestCode: Int): PendingIntent =
        PendingIntent.getService(this, requestCode, intent(this, action), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    companion object {
        private const val TAG = "RecordingService"
        const val ACTION_START = "com.misync.recorder.action.START"
        const val ACTION_PAUSE = "com.misync.recorder.action.PAUSE"
        const val ACTION_RESUME = "com.misync.recorder.action.RESUME"
        const val ACTION_STOP = "com.misync.recorder.action.STOP"
        const val EXTRA_SOURCE = "source"
        const val CHANNEL_ID = "recording"
        private const val NOTIFICATION_ID = 1001
        private const val SPACE_CHECK_INTERVAL_MS = 2_000L

        fun intent(context: Context, action: String): Intent =
            Intent(context, RecordingService::class.java).setAction(action)

        fun ensureChannel(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) != null) return
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, context.getString(R.string.channel_recording), NotificationManager.IMPORTANCE_LOW).apply {
                    description = context.getString(R.string.channel_recording_desc)
                    setShowBadge(false)
                },
            )
        }
    }
}
