package com.misync.recorder.ui

import android.os.Bundle
import android.os.SystemClock
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import com.misync.recorder.MISyncApp
import com.misync.recorder.security.AppLock
import com.misync.recorder.security.PinManager
import com.misync.recorder.settings.AppSettings
import com.misync.recorder.ui.diagnostics.DiagnosticsScreen
import com.misync.recorder.ui.library.LibraryScreen
import com.misync.recorder.ui.record.RecordScreen
import com.misync.recorder.ui.theme.MISyncColors
import com.misync.recorder.ui.theme.MISyncTheme

/**
 * Single activity. Extends [FragmentActivity] because BiometricPrompt requires it.
 *
 * The whole app sits behind a six-digit PIN gate ([PinGate]): the library, playback, and the
 * record button are all unreachable until the PIN is entered (or, if the user turned it on,
 * biometrics stand in for it). FLAG_SECURE keeps content out of screenshots and the recents
 * thumbnail, and the app re-locks after a short time in the background.
 */
class MainActivity : FragmentActivity() {

    private lateinit var settings: AppSettings
    private lateinit var pinManager: PinManager
    private var unlocked by mutableStateOf(false)
    private var backgroundedAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as MISyncApp).container
        settings = container.settings
        pinManager = container.pinManager
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        enableEdgeToEdge()
        unlocked = savedInstanceState?.getBoolean(KEY_UNLOCKED) == true
        setContent {
            MISyncTheme {
                if (unlocked) {
                    MainScaffold()
                } else {
                    PinGate(
                        pinManager = pinManager,
                        biometricOffered = biometricOffered(),
                        onBiometric = ::tryBiometric,
                        onUnlocked = { unlocked = true },
                    )
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_UNLOCKED, unlocked)
    }

    override fun onStop() {
        super.onStop()
        backgroundedAt = SystemClock.elapsedRealtime()
    }

    override fun onStart() {
        super.onStart()
        if (unlocked && backgroundedAt != 0L && SystemClock.elapsedRealtime() - backgroundedAt > RELOCK_AFTER_MS) {
            unlocked = false
        }
    }

    private fun biometricOffered(): Boolean =
        pinManager.isSet.value && settings.biometricUnlockEnabled.value && AppLock.isAvailable(this)

    private fun tryBiometric() {
        if (!biometricOffered()) return
        AppLock.authenticate(this, onSuccess = { unlocked = true }, onFailure = { /* fall back to PIN */ })
    }

    private companion object {
        const val KEY_UNLOCKED = "unlocked"
        const val RELOCK_AFTER_MS = 30_000L
    }
}

private enum class Tab(val label: String) { RECORD("Record"), LIBRARY("Library"), DIAGNOSTICS("Settings") }

@Composable
private fun MainScaffold() {
    var tab by rememberSaveable { mutableStateOf(Tab.RECORD) }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = MISyncColors.Surface) {
                Tab.entries.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t,
                        onClick = { tab = t },
                        icon = {
                            Icon(
                                when (t) {
                                    Tab.RECORD -> Icons.Outlined.Mic
                                    Tab.LIBRARY -> Icons.Outlined.LibraryMusic
                                    Tab.DIAGNOSTICS -> Icons.Outlined.Tune
                                },
                                contentDescription = null,
                            )
                        },
                        label = { Text(t.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MISyncColors.Accent,
                            selectedTextColor = MISyncColors.Accent,
                            indicatorColor = MISyncColors.SurfaceRaised,
                        ),
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                Tab.RECORD -> RecordScreen()
                Tab.LIBRARY -> LibraryScreen()
                Tab.DIAGNOSTICS -> DiagnosticsScreen()
            }
        }
    }
}
