package io.github.polarsync.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.polarsync.Format
import io.github.polarsync.LockUiState
import io.github.polarsync.R
import io.github.polarsync.security.PinManager
import kotlinx.coroutines.delay

@Composable
fun PinScreen(
    state: LockUiState,
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
) {
    // Live countdown while locked out.
    val lockRemainingMs by produceState(0L, state.lockedUntilMillis) {
        while (true) {
            value = (state.lockedUntilMillis - System.currentTimeMillis()).coerceAtLeast(0)
            if (value == 0L) break
            delay(250)
        }
    }
    val lockedOut = lockRemainingMs > 0

    Surface(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .safeDrawingPadding()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(
                painterResource(R.drawable.ic_lock),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(40.dp),
            )
            Spacer(Modifier.height(16.dp))
            Text(
                stringResource(
                    when (state.stage) {
                        LockUiState.Stage.CREATE -> R.string.pin_title_create
                        LockUiState.Stage.CONFIRM -> R.string.pin_title_confirm
                        LockUiState.Stage.ENTER -> R.string.pin_title_enter
                    },
                ),
                style = MaterialTheme.typography.headlineSmall,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = when {
                    lockedOut -> stringResource(R.string.pin_error_locked, Format.duration(lockRemainingMs + 999))
                    state.error == LockUiState.PinError.WRONG ->
                        pluralStringResource(R.plurals.pin_error_wrong, state.attemptsLeft, state.attemptsLeft)
                    state.error == LockUiState.PinError.MISMATCH -> stringResource(R.string.pin_error_mismatch)
                    state.stage == LockUiState.Stage.CREATE -> stringResource(R.string.pin_hint_create)
                    else -> ""
                },
                style = MaterialTheme.typography.bodyMedium,
                color = if (lockedOut || state.error == LockUiState.PinError.WRONG || state.error == LockUiState.PinError.MISMATCH) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
                textAlign = TextAlign.Center,
                modifier = Modifier.height(40.dp),
            )
            Spacer(Modifier.height(16.dp))
            PinDots(filled = state.digitsEntered)
            Spacer(Modifier.height(32.dp))
            Keypad(enabled = !lockedOut && !state.busy, onDigit = onDigit, onBackspace = onBackspace)
        }
    }
}

@Composable
private fun PinDots(filled: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        repeat(PinManager.PIN_LENGTH) { i ->
            val color = MaterialTheme.colorScheme.primary
            Box(
                Modifier
                    .size(16.dp)
                    .border(2.dp, color, CircleShape)
                    .then(if (i < filled) Modifier.background(color, CircleShape) else Modifier),
            )
        }
    }
}

@Composable
private fun Keypad(enabled: Boolean, onDigit: (Char) -> Unit, onBackspace: () -> Unit) {
    val rows = listOf("123", "456", "789")
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        rows.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { d -> DigitKey(d, enabled, onDigit) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Spacer(Modifier.size(KEY_SIZE))
            DigitKey('0', enabled, onDigit)
            Box(Modifier.size(KEY_SIZE), contentAlignment = Alignment.Center) {
                IconButton(onClick = onBackspace, enabled = enabled) {
                    Icon(painterResource(R.drawable.ic_backspace), contentDescription = stringResource(R.string.cd_backspace))
                }
            }
        }
    }
}

@Composable
private fun DigitKey(digit: Char, enabled: Boolean, onDigit: (Char) -> Unit) {
    FilledTonalButton(
        onClick = { onDigit(digit) },
        enabled = enabled,
        shape = CircleShape,
        modifier = Modifier.size(KEY_SIZE),
    ) {
        Text(digit.toString(), fontSize = 24.sp)
    }
}

private val KEY_SIZE = 72.dp
