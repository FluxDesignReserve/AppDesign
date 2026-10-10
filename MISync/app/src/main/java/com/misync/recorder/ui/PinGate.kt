package com.misync.recorder.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Backspace
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.misync.recorder.crypto.PinCrypto
import com.misync.recorder.security.MasterKeyStore
import com.misync.recorder.security.UnlockResult
import com.misync.recorder.ui.theme.MISyncColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Full-screen PIN gate shown every time the app opens or returns from the background. When no PIN
 * exists it runs one-time setup (enter, then confirm); otherwise it verifies entry against the
 * PIN-derived encryption. Nothing behind this gate — recordings or the record button — is
 * reachable until it reports success. There is no biometric bypass and no way to change or reset
 * the PIN once set.
 */
@Composable
fun PinGate(masterKeyStore: MasterKeyStore, onUnlocked: () -> Unit) {
    val initialized by masterKeyStore.isInitialized.collectAsState()
    if (initialized) {
        PinEntry(masterKeyStore, onUnlocked)
    } else {
        PinSetup(masterKeyStore, onUnlocked)
    }
}

@Composable
private fun PinSetup(masterKeyStore: MasterKeyStore, onDone: () -> Unit) {
    var first by remember { mutableStateOf<String?>(null) }
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    PinPad(
        title = if (first == null) "Create your 6-digit PIN" else "Confirm your PIN",
        subtitle = "This PIN encrypts your recordings. You'll enter it every time you open MISync. " +
            "It can't be changed or reset later, and recordings can't be recovered without it.",
        pin = pin,
        error = error,
        enabled = !working,
        onDigit = { digit ->
            if (pin.length < PinCrypto.PIN_LENGTH) pin += digit
            error = null
            if (pin.length == PinCrypto.PIN_LENGTH) {
                val entered = pin
                pin = ""
                if (first == null) {
                    first = entered
                } else if (first == entered) {
                    working = true
                    scope.launch {
                        val result = withContext(Dispatchers.Default) { masterKeyStore.create(entered) }
                        working = false
                        when (result) {
                            is UnlockResult.Success -> onDone()
                            is UnlockResult.Error -> { first = null; error = result.message }
                            else -> { first = null; error = "Could not set the PIN." }
                        }
                    }
                } else {
                    first = null
                    error = "PINs didn't match. Start again."
                }
            }
        },
        onBackspace = { if (pin.isNotEmpty()) pin = pin.dropLast(1) },
    )
}

@Composable
private fun PinEntry(masterKeyStore: MasterKeyStore, onUnlocked: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var lockedRemaining by remember { mutableLongStateOf(masterKeyStore.lockoutRemainingMs()) }
    var verifying by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(lockedRemaining > 0) {
        while (lockedRemaining > 0) {
            delay(500)
            lockedRemaining = masterKeyStore.lockoutRemainingMs()
        }
    }

    PinPad(
        title = "Enter your PIN",
        subtitle = null,
        pin = pin,
        error = if (lockedRemaining > 0) "Too many attempts. Try again in ${(lockedRemaining / 1000) + 1}s." else error,
        enabled = lockedRemaining == 0L && !verifying,
        onDigit = { digit ->
            if (pin.length < PinCrypto.PIN_LENGTH) pin += digit
            error = null
            if (pin.length == PinCrypto.PIN_LENGTH) {
                val entered = pin
                verifying = true
                scope.launch {
                    val result = withContext(Dispatchers.Default) { masterKeyStore.unlock(entered) }
                    pin = ""
                    verifying = false
                    when (result) {
                        is UnlockResult.Success -> onUnlocked()
                        is UnlockResult.Incorrect -> error = "Incorrect PIN. ${result.attemptsRemaining} attempt(s) left."
                        is UnlockResult.LockedOut -> lockedRemaining = result.remainingMs
                        is UnlockResult.Error -> error = result.message
                    }
                }
            }
        },
        onBackspace = { if (pin.isNotEmpty()) pin = pin.dropLast(1) },
    )
}

@Composable
private fun PinPad(
    title: String,
    subtitle: String?,
    pin: String,
    error: String?,
    enabled: Boolean = true,
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Outlined.Lock, contentDescription = null, tint = MISyncColors.Accent, modifier = Modifier.size(36.dp))
        Spacer(Modifier.height(16.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        if (subtitle != null) {
            Spacer(Modifier.height(8.dp))
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MISyncColors.TextSecondary, textAlign = TextAlign.Center)
        }
        Spacer(Modifier.height(28.dp))
        PinDots(filled = pin.length)
        Spacer(Modifier.height(12.dp))
        Text(
            error ?: " ",
            style = MaterialTheme.typography.labelMedium,
            color = MISyncColors.Error,
            textAlign = TextAlign.Center,
            modifier = Modifier.height(20.dp),
        )
        Spacer(Modifier.height(16.dp))
        Keypad(enabled = enabled, onDigit = onDigit, onBackspace = onBackspace)
    }
}

@Composable
private fun PinDots(filled: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        repeat(PinCrypto.PIN_LENGTH) { i ->
            Box(
                Modifier
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(if (i < filled) MISyncColors.Accent else Color.Transparent)
                    .border(1.5.dp, if (i < filled) MISyncColors.Accent else MISyncColors.Outline, CircleShape),
            )
        }
    }
}

@Composable
private fun Keypad(enabled: Boolean, onDigit: (Char) -> Unit, onBackspace: () -> Unit) {
    Column(Modifier.widthIn(max = 300.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        listOf(listOf('1', '2', '3'), listOf('4', '5', '6'), listOf('7', '8', '9')).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { digit ->
                    Key(Modifier.weight(1f), enabled = enabled, onClick = { onDigit(digit) }) {
                        Text(digit.toString(), style = MaterialTheme.typography.headlineSmall)
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Spacer(Modifier.weight(1f))
            Key(Modifier.weight(1f), enabled = enabled, onClick = { onDigit('0') }) {
                Text("0", style = MaterialTheme.typography.headlineSmall)
            }
            Key(Modifier.weight(1f), enabled = enabled, onClick = onBackspace) {
                Icon(Icons.AutoMirrored.Outlined.Backspace, contentDescription = "Delete")
            }
        }
    }
}

@Composable
private fun Key(modifier: Modifier, enabled: Boolean, onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        modifier
            .aspectRatio(1.6f)
            .clip(CircleShape)
            .background(MISyncColors.Surface)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}
