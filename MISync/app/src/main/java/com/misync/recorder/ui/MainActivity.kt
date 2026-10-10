package com.misync.recorder.ui

import android.os.Bundle
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import com.misync.recorder.MISyncApp
import com.misync.recorder.security.SessionKeys
import com.misync.recorder.ui.diagnostics.DiagnosticsScreen
import com.misync.recorder.ui.library.LibraryScreen
import com.misync.recorder.ui.record.RecordScreen
import com.misync.recorder.ui.theme.MISyncColors
import com.misync.recorder.ui.theme.MISyncTheme

/**
 * Single activity. Extends [FragmentActivity] for Compose + fragment interop.
 *
 * The whole app sits behind the six-digit PIN gate ([PinGate]): the library, playback and the
 * record button are all unreachable until the PIN is entered, and the PIN-derived master key is
 * wiped from memory ([SessionKeys.clear]) whenever the app leaves the foreground, so re-opening
 * always prompts again. FLAG_SECURE keeps content out of screenshots and the recents thumbnail.
 */
class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as MISyncApp).container
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        enableEdgeToEdge()
        setContent {
            MISyncTheme {
                val unlocked by SessionKeys.unlocked.collectAsState()
                if (unlocked) {
                    LaunchedEffect(Unit) { container.recoverInterruptedOnce() }
                    MainScaffold()
                } else {
                    PinGate(masterKeyStore = container.masterKeyStore, onUnlocked = { /* SessionKeys drives recomposition */ })
                }
            }
        }
    }

    override fun onStop() {
        super.onStop()
        // Returning to the app must always require the PIN again. Keep the key only across
        // configuration changes (e.g. rotation), which recreate the activity without backgrounding.
        if (!isChangingConfigurations) SessionKeys.clear()
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
