package com.misync.recorder.security

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Six-digit access PIN that gates the whole app (viewing recordings and starting a new one).
 *
 * Hashing lives in [PinHasher]; this class owns persistence and brute-force rate limiting.
 * The PIN itself is never stored. Repeated wrong entries trigger an escalating lockout, because a
 * six-digit PIN has only 10^6 combinations.
 *
 * This is independent of the optional biometric quick-unlock: the PIN is the primary secret, and
 * biometrics only stand in for it after it has been set.
 */
class PinManager(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences("misync_pin", Context.MODE_PRIVATE)

    private val _isSet = MutableStateFlow(prefs.contains(KEY_HASH))
    val isSet: StateFlow<Boolean> = _isSet.asStateFlow()

    fun isValidFormat(pin: String): Boolean = PinHasher.isValidFormat(pin)

    /** Sets or replaces the PIN. Clears any lockout state. */
    fun setPin(pin: String) {
        val stored = PinHasher.create(pin)
        prefs.edit()
            .putString(KEY_SALT, stored.salt)
            .putString(KEY_HASH, stored.hash)
            .remove(KEY_FAIL_COUNT)
            .remove(KEY_LOCKED_UNTIL)
            .apply()
        _isSet.value = true
    }

    /** Verifies [pin]. Returns the outcome, including any lockout the attempt triggered. */
    fun verify(pin: String, now: Long = System.currentTimeMillis()): PinResult {
        val remaining = lockoutRemainingMs(now)
        if (remaining > 0) return PinResult.LockedOut(remaining)

        val salt = prefs.getString(KEY_SALT, null)
        val hash = prefs.getString(KEY_HASH, null)
        if (salt == null || hash == null) return PinResult.Incorrect(ATTEMPTS_BEFORE_LOCKOUT)

        if (PinHasher.verify(pin, PinHasher.Stored(salt, hash))) {
            prefs.edit().remove(KEY_FAIL_COUNT).remove(KEY_LOCKED_UNTIL).apply()
            return PinResult.Success
        }

        val fails = prefs.getInt(KEY_FAIL_COUNT, 0) + 1
        val editor = prefs.edit().putInt(KEY_FAIL_COUNT, fails)
        return if (fails % ATTEMPTS_BEFORE_LOCKOUT == 0) {
            val step = (fails / ATTEMPTS_BEFORE_LOCKOUT).coerceAtMost(LOCKOUT_STEPS_MS.size)
            val lockMs = LOCKOUT_STEPS_MS[step - 1]
            editor.putLong(KEY_LOCKED_UNTIL, now + lockMs).apply()
            PinResult.LockedOut(lockMs)
        } else {
            editor.apply()
            PinResult.Incorrect(ATTEMPTS_BEFORE_LOCKOUT - fails % ATTEMPTS_BEFORE_LOCKOUT)
        }
    }

    fun lockoutRemainingMs(now: Long = System.currentTimeMillis()): Long =
        (prefs.getLong(KEY_LOCKED_UNTIL, 0) - now).coerceAtLeast(0)

    companion object {
        const val ATTEMPTS_BEFORE_LOCKOUT = 5
        private const val KEY_SALT = "salt"
        private const val KEY_HASH = "hash"
        private const val KEY_FAIL_COUNT = "fail_count"
        private const val KEY_LOCKED_UNTIL = "locked_until"
        // After each run of 5 wrong entries: 30 s, 1 min, 5 min, 15 min, then 30 min thereafter.
        private val LOCKOUT_STEPS_MS = longArrayOf(30_000, 60_000, 300_000, 900_000, 1_800_000)
    }
}

sealed interface PinResult {
    data object Success : PinResult
    data class Incorrect(val attemptsRemaining: Int) : PinResult
    data class LockedOut(val remainingMs: Long) : PinResult
}
