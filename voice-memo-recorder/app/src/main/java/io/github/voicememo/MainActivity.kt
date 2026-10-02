package io.github.voicememo

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import io.github.voicememo.ui.RecorderScreen
import io.github.voicememo.ui.VoiceMemoTheme

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { results -> onPermissionResult(results) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            VoiceMemoTheme {
                RecorderScreen(
                    viewModel = viewModel,
                    onRecord = ::requestRecording,
                    onPause = { AudioRecordingService.pause(this) },
                    onResume = { AudioRecordingService.resume(this) },
                    onStop = { AudioRecordingService.stop(this) },
                    onOpenSettings = ::openAppSettings,
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Picks up files changed while we were away (e.g. a session stopped from the notification).
        viewModel.refresh()
    }

    /** Checks permissions, asking for any that are missing, then starts the service. */
    private fun requestRecording() {
        val missing = buildList {
            if (!isGranted(Manifest.permission.RECORD_AUDIO)) add(Manifest.permission.RECORD_AUDIO)
            if (needsNotificationPermission() && !isGranted(Manifest.permission.POST_NOTIFICATIONS)) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (missing.isEmpty()) {
            AudioRecordingService.start(this)
        } else {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun onPermissionResult(results: Map<String, Boolean>) {
        val micGranted = results[Manifest.permission.RECORD_AUDIO] ?: isGranted(Manifest.permission.RECORD_AUDIO)
        if (!micGranted) {
            // No rationale to show after a denial means "don't ask again" (or a policy block):
            // the only way forward is the settings screen.
            val blocked = !shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)
            viewModel.showMessage(
                UiMessage.Res(if (blocked) R.string.msg_mic_permission_blocked else R.string.msg_mic_permission_needed),
            )
            return
        }

        // Notifications are not required to record — the system still surfaces the session in
        // its active-apps list and shows the microphone privacy indicator — but say so.
        val notificationsGranted = results[Manifest.permission.POST_NOTIFICATIONS]
            ?: (!needsNotificationPermission() || isGranted(Manifest.permission.POST_NOTIFICATIONS))
        if (!notificationsGranted) viewModel.showMessage(UiMessage.Res(R.string.msg_notifications_off))

        AudioRecordingService.start(this)
    }

    private fun openAppSettings() {
        startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    private fun isGranted(permission: String) =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun needsNotificationPermission() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
}
