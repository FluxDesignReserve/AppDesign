package io.github.voicememo

import android.annotation.SuppressLint
import android.app.ForegroundServiceStartNotAllowedException
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Foreground service that keeps the microphone open while the app is in the background.
 *
 * The service holds no recording logic of its own: it promotes itself to the foreground
 * (which, for type "microphone", is what grants background capture), forwards commands to
 * [RecordingManager], and mirrors the manager's state into an ongoing notification with
 * Pause/Resume and Stop actions. When the session ends for any reason — the user pressing
 * Stop, an encoder error, a full disk — it removes the notification and stops itself.
 *
 * Commands arrive as intents; use the helpers in the companion object.
 */
class AudioRecordingService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var manager: RecordingManager
    private lateinit var notificationManager: NotificationManager

    /** Set once a session has been seen, so the initial Idle state doesn't stop the service. */
    private var sessionSeen = false

    override fun onCreate() {
        super.onCreate()
        manager = (application as VoiceMemoApp).recordingManager
        notificationManager = getSystemService(NotificationManager::class.java)

        scope.launch {
            manager.state.collect { state ->
                when (state) {
                    is RecordingState.Active -> {
                        sessionSeen = true
                        updateNotification(state)
                    }
                    RecordingState.Idle -> if (sessionSeen) shutDown()
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> handleStart()
            ACTION_PAUSE -> manager.pause()
            ACTION_RESUME -> manager.resume()
            ACTION_STOP -> handleStop()
            else -> {
                // A null intent means the system restarted us. An interrupted MediaRecorder
                // session can't be resumed, so there is nothing to do.
                if (manager.state.value is RecordingState.Idle) stopSelf(startId)
            }
        }
        // Never restart automatically: recording must only ever begin from a user action.
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        // Covers the system tearing the service down: finalise the file rather than lose it.
        if (manager.state.value is RecordingState.Active) manager.stop()
        scope.cancel()
        super.onDestroy()
    }

    private fun handleStart() {
        val current = manager.state.value
        if (current is RecordingState.Active) {
            // Already recording (e.g. a double tap). Re-assert foreground with the real state.
            enterForeground(buildNotification(current))
            return
        }

        // startForegroundService() requires startForeground() within a few seconds, and the
        // microphone FGS type must be in place before capture begins.
        if (!enterForeground(buildStartingNotification())) {
            stopSelf()
            return
        }

        try {
            manager.start()
        } catch (e: RecordingException) {
            manager.reportError(e.message ?: "Could not start recording.", e)
            shutDown()
        }
    }

    private fun handleStop() {
        if (manager.state.value is RecordingState.Active) {
            manager.stop() // The state collector sees Idle and shuts the service down.
        } else {
            shutDown()
        }
    }

    /** Returns false if the system refused to promote the service to the foreground. */
    private fun enterForeground(notification: Notification): Boolean = try {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
        )
        true
    } catch (e: ForegroundServiceStartNotAllowedException) {
        // Android 12+: the app tried to start a foreground service from the background.
        manager.reportError("Recording can only be started while the app is open.", e)
        false
    } catch (e: SecurityException) {
        // Android 14+: RECORD_AUDIO not granted, or the app isn't eligible for a mic FGS.
        manager.reportError("Microphone permission is required to record.", e)
        false
    }

    private fun shutDown() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // The foreground-service notification is exempt from the POST_NOTIFICATIONS requirement:
    // if the user denied notifications, the system still lists it in the active-apps
    // (Task Manager) drawer, and posting the update is harmless.
    @SuppressLint("MissingPermission")
    private fun updateNotification(state: RecordingState.Active) {
        notificationManager.notify(NOTIFICATION_ID, buildNotification(state))
    }

    private fun baseNotification(): NotificationCompat.Builder {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, VoiceMemoApp.RECORDING_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentIntent(openApp)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // Android 12 may defer FGS notifications by up to 10 s; a mic indicator must not wait.
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
    }

    private fun buildStartingNotification(): Notification =
        baseNotification()
            .setContentTitle(getString(R.string.notification_title_recording))
            .setContentText(getString(R.string.notification_text_recording))
            .build()

    private fun buildNotification(state: RecordingState.Active): Notification {
        val builder = baseNotification()
        when (state) {
            is RecordingState.Recording -> builder
                .setContentTitle(getString(R.string.notification_title_recording))
                .setContentText(getString(R.string.notification_text_recording))
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setWhen(System.currentTimeMillis() - state.elapsedMs())
                .addAction(R.drawable.ic_pause, getString(R.string.action_pause), servicePendingIntent(ACTION_PAUSE))

            is RecordingState.Paused -> builder
                .setContentTitle(getString(R.string.notification_title_paused))
                .setContentText(getString(R.string.notification_text_paused, Format.duration(state.elapsedMs())))
                .setShowWhen(false)
                .addAction(R.drawable.ic_mic, getString(R.string.action_resume), servicePendingIntent(ACTION_RESUME))
        }
        builder.addAction(R.drawable.ic_stop, getString(R.string.action_stop), servicePendingIntent(ACTION_STOP))
        return builder.build()
    }

    private fun servicePendingIntent(action: String): PendingIntent = PendingIntent.getService(
        this,
        action.hashCode(),
        Intent(this, AudioRecordingService::class.java).setAction(action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    companion object {
        private const val TAG = "AudioRecordingService"
        private const val NOTIFICATION_ID = 1001

        private const val ACTION_START = "io.github.voicememo.action.START"
        private const val ACTION_PAUSE = "io.github.voicememo.action.PAUSE"
        private const val ACTION_RESUME = "io.github.voicememo.action.RESUME"
        private const val ACTION_STOP = "io.github.voicememo.action.STOP"

        /** Starts a new session. Call from a visible activity, after RECORD_AUDIO is granted. */
        fun start(context: Context) {
            try {
                ContextCompat.startForegroundService(context, intent(context, ACTION_START))
            } catch (e: IllegalStateException) {
                // ForegroundServiceStartNotAllowedException extends IllegalStateException.
                Log.e(TAG, "Could not start the recording service", e)
                (context.applicationContext as VoiceMemoApp).recordingManager
                    .reportError("Recording can only be started while the app is open.", e)
            }
        }

        fun pause(context: Context) = send(context, ACTION_PAUSE)
        fun resume(context: Context) = send(context, ACTION_RESUME)
        fun stop(context: Context) = send(context, ACTION_STOP)

        // The service is already in the foreground for these, so a plain startService() is
        // allowed and must not be startForegroundService() (which would demand a new
        // startForeground() call even when there is nothing to stop).
        private fun send(context: Context, action: String) {
            try {
                context.startService(intent(context, action))
            } catch (e: IllegalStateException) {
                Log.w(TAG, "Could not deliver $action", e)
            }
        }

        private fun intent(context: Context, action: String) =
            Intent(context, AudioRecordingService::class.java).setAction(action)
    }
}
