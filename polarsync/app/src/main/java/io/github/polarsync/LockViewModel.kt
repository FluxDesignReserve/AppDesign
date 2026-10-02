package io.github.polarsync

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import io.github.polarsync.security.PinManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class LockUiState(
    val unlocked: Boolean = false,
    val stage: Stage = Stage.ENTER,
    val digitsEntered: Int = 0,
    val busy: Boolean = false,
    val error: PinError? = null,
    val attemptsLeft: Int = 0,
    /** Wall-clock millis until which entry is blocked, or 0. */
    val lockedUntilMillis: Long = 0,
) {
    enum class Stage { CREATE, CONFIRM, ENTER }
    enum class PinError { MISMATCH, WRONG, LOCKED }
}

/**
 * Gates the app behind the 4-digit PIN. The first launch asks the user to create and confirm
 * one; later launches ask for it. [lock] is called whenever the app leaves the screen.
 * Lives in a ViewModel, so a rotation doesn't re-lock, while process death always does.
 */
class LockViewModel(application: Application) : AndroidViewModel(application) {

    private val pins: PinManager = (application as PolarsyncApp).pinManager

    private val _state = MutableStateFlow(initialState())
    val state: StateFlow<LockUiState> = _state.asStateFlow()

    private val entry = StringBuilder()
    private var pinToConfirm: String? = null

    fun onDigit(digit: Char) {
        val s = _state.value
        if (s.unlocked || s.busy || entry.length >= PinManager.PIN_LENGTH) return
        if (s.lockedUntilMillis > System.currentTimeMillis()) return
        entry.append(digit)
        _state.update { it.copy(digitsEntered = entry.length, error = null) }
        if (entry.length == PinManager.PIN_LENGTH) submit(entry.toString())
    }

    fun onBackspace() {
        if (entry.isEmpty() || _state.value.busy) return
        entry.deleteCharAt(entry.lastIndex)
        _state.update { it.copy(digitsEntered = entry.length) }
    }

    fun lock() {
        clearEntry()
        pinToConfirm = null
        _state.value = initialState()
    }

    private fun submit(pin: String) {
        when (_state.value.stage) {
            LockUiState.Stage.CREATE -> {
                pinToConfirm = pin
                clearEntry()
                _state.update { it.copy(stage = LockUiState.Stage.CONFIRM, digitsEntered = 0) }
            }

            LockUiState.Stage.CONFIRM -> {
                if (pin != pinToConfirm) {
                    pinToConfirm = null
                    clearEntry()
                    _state.update {
                        it.copy(stage = LockUiState.Stage.CREATE, digitsEntered = 0, error = LockUiState.PinError.MISMATCH)
                    }
                    return
                }
                runHashing {
                    pins.setPin(pin)
                    pinToConfirm = null
                    _state.update { it.copy(unlocked = true) }
                }
            }

            LockUiState.Stage.ENTER -> runHashing {
                when (val result = pins.verify(pin)) {
                    PinManager.Result.Success -> _state.update { it.copy(unlocked = true) }
                    is PinManager.Result.Wrong -> _state.update {
                        it.copy(error = LockUiState.PinError.WRONG, attemptsLeft = result.attemptsBeforeLockout)
                    }
                    is PinManager.Result.LockedOut -> _state.update {
                        it.copy(error = LockUiState.PinError.LOCKED, lockedUntilMillis = result.untilMillis)
                    }
                }
            }
        }
    }

    /** PBKDF2 takes a moment; keep it off the main thread and ignore input meanwhile. */
    private fun runHashing(block: () -> Unit) {
        _state.update { it.copy(busy = true) }
        viewModelScope.launch {
            withContext(Dispatchers.Default) { block() }
            clearEntry()
            _state.update { it.copy(busy = false, digitsEntered = 0) }
        }
    }

    private fun clearEntry() {
        entry.setLength(0)
    }

    private fun initialState(): LockUiState {
        val lockedUntil = pins.lockoutRemainingMs().let { if (it > 0) System.currentTimeMillis() + it else 0L }
        return LockUiState(
            stage = if (pins.isPinSet) LockUiState.Stage.ENTER else LockUiState.Stage.CREATE,
            lockedUntilMillis = lockedUntil,
            error = if (lockedUntil > 0) LockUiState.PinError.LOCKED else null,
        )
    }
}
