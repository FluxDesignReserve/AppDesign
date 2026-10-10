package com.misync.recorder.ui

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
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Backspace
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.misync.recorder.security.PinHasher
import com.misync.recorder.security.PinManager
import com.misync.recorder.security.PinResult
import com.misync.recorder.ui.theme.MISyncColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Full-screen PIN gate. When no PIN exists it runs first-time setup (enter, then confirm);
 * otherwise it verifies entry. Nothing behind this gate — recordings or the record button — is
 * reachable until it reports success. [onBiometric] is shown only when offered.
 */
@Composable
fun PinGate(
    pinManager: PinManager,
    biometricOffered: Boolean,
    onBiometric: () -> Unit,
    onUnlocked: () -> Unit,
) {
    val isSet by pinManager.isSet.collectAsState()
    if (isSet) {
        PinEntry(pinManager, biometricOffered, onBiometric, onUnlocked)
    } else {
        PinSetup(pinManager, onUnlocked)
    }
}

/**
 * Changes the PIN from Settings: verify the current PIN, then enter the new one twice. Honors the
 * same lockout as the entry gate so this cannot be used to brute-force the current PIN.
 */
@Composable
fun ChangePinFlow(pinManager: PinManager, onDone: () -> Unit) {
    var currentVerified by remember { mutableStateOf(false) }
    var newFirst by remember { mutableStateOf<String?>(null) }
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var lockedRemaining by remember { mutableLongStateOf(pinManager.lockoutRemainingMs()) }
    var verifying by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(lockedRemaining > 0) {
        while (lockedRemaining > 0) {
            delay(500)
            lockedRemaining = pinManager.lockoutRemainingMs()
        }
    }

    PinPad(
        title = when {
            !currentVerified -> "Enter current PIN"
            newFirst == null -> "Enter new PIN"
            else -> "Confirm new PIN"
        },
        subtitle = "Changing your PIN does not affect existing recordings.",
        pin = pin,
        error = if (lockedRemaining > 0) "Too many attempts. Try again in ${(lockedRemaining / 1000) + 1}s." else error,
        enabled = lockedRemaining == 0L && !verifying,
        cancel = onDone,
        onDigit = { digit ->
            if (pin.length < PinHasher.PIN_LENGTH) pin += digit
            error = null
            if (pin.length == PinHasher.PIN_LENGTH) {
                val entered = pin
                if (!currentVerified) {
                    verifying = true
                    scope.launch {
                        val result = withContext(Dispatchers.Default) { pinManager.verify(entered) }
                        pin = ""
                        verifying = false
                        when (result) {
                            is PinResult.Success -> currentVerified = true
                            is PinResult.Incorrect -> error = "Incorrect PIN. ${result.attemptsRemaining} attempt(s) left."
                            is PinResult.LockedOut -> lockedRemaining = result.remainingMs
                        }
                    }
                } else {
                    pin = ""
                    if (newFirst == null) {
                        newFirst = entered
                    } else if (newFirst == entered) {
                        pinManager.setPin(entered)
                        onDone()
                    } else {
                        newFirst = null
                        error = "PINs didn't match. Enter the new PIN again."
                    }
                }
            }
        },
        onBackspace = { if (pin.isNotEmpty()) pin = pin.dropLast(1) },
    )
}

@Composable
private fun PinSetup(pinManager: PinManager, onDone: () -> Unit) {
    var first by remember { mutableStateOf<String?>(null) }
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    PinPad(
        title = if (first == null) "Create a 6-digit PIN" else "Confirm your PIN",
        subtitle = "You'll need this PIN every time to open MISync and to start recording. It can't be recovered if forgotten.",
        pin = pin,
        error = error,
        onDigit = {
            if (pin.length < PinHasher.PIN_LENGTH) pin += it
            error = null
            if (pin.length == PinHasher.PIN_LENGTH) {
                val entered = pin
                pin = ""
                if (first == null) {
                    first = entered
                } else if (first == entered) {
                    pinManager.setPin(entered)
                    onDone()
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
private fun PinEntry(
    pinManager: PinManager,
    biometricOffered: Boolean,
    onBiometric: () -> Unit,
    onUnlocked: () -> Unit,
) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var lockedUntilRemaining by remember { mutableLongStateOf(pinManager.lockoutRemainingMs()) }
    var verifying by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(lockedUntilRemaining > 0) {
        while (lockedUntilRemaining > 0) {
            delay(500)
            lockedUntilRemaining = pinManager.lockoutRemainingMs()
        }
    }

    PinPad(
        title = "Enter your PIN",
        subtitle = null,
        pin = pin,
        error = when {
            lockedUntilRemaining > 0 -> "Too many attempts. Try again in ${(lockedUntilRemaining / 1000) + 1}s."
            else -> error
        },
        enabled = lockedUntilRemaining == 0L && !verifying,
        biometric = biometricOffered && lockedUntilRemaining == 0L,
        onBiometric = onBiometric,
        onDigit = { digit ->
            if (pin.length < PinHasher.PIN_LENGTH) pin += digit
            error = null
            if (pin.length == PinHasher.PIN_LENGTH) {
                val entered = pin
                verifying = true
                scope.launch {
                    val result = withContext(Dispatchers.Default) { pinManager.verify(entered) }
                    pin = ""
                    verifying = false
                    when (result) {
                        is PinResult.Success -> onUnlocked()
                        is PinResult.Incorrect -> error = "Incorrect PIN. ${result.attemptsRemaining} attempt(s) left."
                        is PinResult.LockedOut -> lockedUntilRemaining = result.remainingMs
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
    biometric: Boolean = false,
    onBiometric: () -> Unit = {},
    cancel: (() -> Unit)? = null,
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
        Keypad(enabled = enabled, biometric = biometric, onBiometric = onBiometric, onDigit = onDigit, onBackspace = onBackspace)
        if (cancel != null) {
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = cancel) { Text("Cancel") }
        }
    }
}

@Composable
private fun PinDots(filled: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        repeat(PinHasher.PIN_LENGTH) { i ->
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
private fun Keypad(
    enabled: Boolean,
    biometric: Boolean,
    onBiometric: () -> Unit,
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
) {
    Column(
        Modifier.widthIn(max = 300.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val rows = listOf(listOf('1', '2', '3'), listOf('4', '5', '6'), listOf('7', '8', '9'))
        rows.forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { digit -> Key(Modifier.weight(1f), enabled = enabled, onClick = { onDigit(digit) }) { Text(digit.toString(), style = MaterialTheme.typography.headlineSmall) } }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (biometric) {
                Key(Modifier.weight(1f), enabled = true, onClick = onBiometric) {
                    Icon(Icons.Outlined.Fingerprint, contentDescription = "Unlock with biometrics", tint = MISyncColors.Accent)
                }
            } else {
                Spacer(Modifier.weight(1f))
            }
            Key(Modifier.weight(1f), enabled = enabled, onClick = { onDigit('0') }) { Text("0", style = MaterialTheme.typography.headlineSmall) }
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
