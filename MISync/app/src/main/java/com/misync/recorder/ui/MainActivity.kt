package com.misync.recorder.ui

import android.os.Bundle
import android.os.SystemClock
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Button
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.misync.recorder.MISyncApp
import com.misync.recorder.security.AppLock
import com.misync.recorder.ui.diagnostics.DiagnosticsScreen
import com.misync.recorder.ui.library.LibraryScreen
import com.misync.recorder.ui.record.RecordScreen
import com.misync.recorder.ui.theme.MISyncColors
import com.misync.recorder.ui.theme.MISyncTheme

/**
 * Single activity. Extends [FragmentActivity] because BiometricPrompt requires it.
 * FLAG_SECURE keeps recording titles out of screenshots and the recents thumbnail.
 */
class MainActivity : FragmentActivity() {

    private val settings by lazy { (application as MISyncApp).container.settings }
    private var locked by mutableStateOf(true)
    private var lockError by mutableStateOf<String?>(null)
    private var backgroundedAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        enableEdgeToEdge()
        locked = lockRequired() && savedInstanceState?.getBoolean(KEY_UNLOCKED) != true
        setContent {
            MISyncTheme {
                if (locked) {
                    LockScreen(error = lockError, onUnlock = ::unlock)
                } else {
                    MainScaffold()
                }
            }
        }
        if (locked) unlock()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_UNLOCKED, !locked)
    }

    override fun onStop() {
        super.onStop()
        backgroundedAt = SystemClock.elapsedRealtime()
    }

    override fun onStart() {
        super.onStart()
        if (!locked && backgroundedAt != 0L && lockRequired() &&
            SystemClock.elapsedRealtime() - backgroundedAt > RELOCK_AFTER_MS
        ) {
            locked = true
            unlock()
        }
    }

    private fun lockRequired(): Boolean = settings.appLockEnabled.value && AppLock.isAvailable(this)

    private fun unlock() {
        if (!lockRequired()) {
            locked = false
            return
        }
        AppLock.authenticate(
            this,
            onSuccess = { locked = false; lockError = null },
            onFailure = { lockError = it },
        )
    }

    private companion object {
        const val KEY_UNLOCKED = "unlocked"
        const val RELOCK_AFTER_MS = 30_000L
    }
}

private enum class Tab(val label: String) { RECORD("Record"), LIBRARY("Library"), DIAGNOSTICS("Diagnostics") }

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

@Composable
private fun LockScreen(error: String?, onUnlock: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Outlined.GraphicEq, contentDescription = null, tint = MISyncColors.Accent, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(16.dp))
        Text("MISync is locked", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text(
            "Recording in progress keeps running. Unlock to view or play recordings.",
            style = MaterialTheme.typography.bodyMedium,
            color = MISyncColors.TextSecondary,
            textAlign = TextAlign.Center,
        )
        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MISyncColors.Error, style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center)
        }
        Spacer(Modifier.height(24.dp))
        Button(onClick = onUnlock) {
            Icon(Icons.Outlined.Fingerprint, contentDescription = null)
            Text("  Unlock")
        }
    }
}
