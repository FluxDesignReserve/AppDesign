package io.github.polarsync

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import io.github.polarsync.security.KeystoreKeyWrapper
import io.github.polarsync.security.PinManager
import io.github.polarsync.security.PrefsPinStore

class PolarsyncApp : Application() {

    /** Shared by [AudioRecordingService] and the UI so both see the same recording state. */
    val recordingManager: RecordingManager by lazy { RecordingManager(this, KeystoreKeyWrapper()) }

    val pinManager: PinManager by lazy { PinManager(PrefsPinStore(this)) }

    override fun onCreate() {
        super.onCreate()
        createRecordingChannel()
    }

    private fun createRecordingChannel() {
        // LOW: visible in the shade and status bar, but no sound or heads-up interruption.
        val channel = NotificationChannel(
            RECORDING_CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = getString(R.string.notification_channel_description)
            setShowBadge(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        const val RECORDING_CHANNEL_ID = "recording"
    }
}
