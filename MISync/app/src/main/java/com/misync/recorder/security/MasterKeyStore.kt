package com.misync.recorder.security

import android.content.Context
import android.util.Base64
import com.misync.recorder.crypto.DataKeys
import com.misync.recorder.crypto.KeystoreKeyProvider
import com.misync.recorder.crypto.PinCrypto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.SecureRandom

/**
 * Owns the app's master key and the six-digit PIN that protects it.
 *
 * The master key is random, generated once at first launch, and wraps every recording's key. It is
 * stored only in sealed form: `Keystore( PinCrypto.wrap(pin, masterKey) )` — so opening it needs
 * both the device's non-exportable Keystore key and the user's PIN. The PIN is set once and cannot
 * be changed or reset (that would require re-wrapping with a key only the old PIN can produce), and
 * there is no recovery path. On success the plaintext master key is handed to [SessionKeys].
 *
 * Repeated wrong PINs trigger an escalating lockout, since the PIN space is small.
 */
class MasterKeyStore(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences("misync_master", Context.MODE_PRIVATE)
    private val keystore = KeystoreKeyProvider(context)

    private val _initialized = MutableStateFlow(prefs.contains(KEY_BLOB))
    val isInitialized: StateFlow<Boolean> = _initialized.asStateFlow()

    fun isValidFormat(pin: String): Boolean = PinCrypto.isValidFormat(pin)

    /** First-run setup: generate the master key, seal it under [pin], and unlock the session. */
    fun create(pin: String): UnlockResult {
        if (_initialized.value) return UnlockResult.Error("PIN already set")
        if (!isValidFormat(pin)) return UnlockResult.Error("PIN must be ${PinCrypto.PIN_LENGTH} digits")
        return try {
            val random = SecureRandom()
            val salt = PinCrypto.newSalt(random)
            val masterKey = DataKeys.generate(random)
            val inner = PinCrypto.wrap(pin, salt, masterKey, random)
            val sealed = keystore.encrypt(inner)
            prefs.edit()
                .putString(KEY_SALT, encode(salt))
                .putString(KEY_BLOB, encode(sealed))
                .remove(KEY_FAIL_COUNT)
                .remove(KEY_LOCKED_UNTIL)
                .apply()
            _initialized.value = true
            SessionKeys.unlock(masterKey)
            UnlockResult.Success
        } catch (e: Exception) {
            UnlockResult.Error(e.message ?: "Could not create the PIN")
        }
    }

    /** Verifies [pin] and, on success, unlocks the session. */
    fun unlock(pin: String, now: Long = System.currentTimeMillis()): UnlockResult {
        val remaining = lockoutRemainingMs(now)
        if (remaining > 0) return UnlockResult.LockedOut(remaining)

        val salt = prefs.getString(KEY_SALT, null)?.let(::decode)
        val sealed = prefs.getString(KEY_BLOB, null)?.let(::decode)
        if (salt == null || sealed == null) return UnlockResult.Error("No PIN has been set")

        val inner = try {
            keystore.decrypt(sealed)
        } catch (e: Exception) {
            return UnlockResult.Error("Secure key is unavailable on this device")
        }

        val masterKey = PinCrypto.unwrap(pin, salt, inner)
        if (masterKey != null) {
            prefs.edit().remove(KEY_FAIL_COUNT).remove(KEY_LOCKED_UNTIL).apply()
            SessionKeys.unlock(masterKey)
            return UnlockResult.Success
        }

        val fails = prefs.getInt(KEY_FAIL_COUNT, 0) + 1
        val editor = prefs.edit().putInt(KEY_FAIL_COUNT, fails)
        return if (fails % ATTEMPTS_BEFORE_LOCKOUT == 0) {
            val step = (fails / ATTEMPTS_BEFORE_LOCKOUT).coerceAtMost(LOCKOUT_STEPS_MS.size)
            val lockMs = LOCKOUT_STEPS_MS[step - 1]
            editor.putLong(KEY_LOCKED_UNTIL, now + lockMs).apply()
            UnlockResult.LockedOut(lockMs)
        } else {
            editor.apply()
            UnlockResult.Incorrect(ATTEMPTS_BEFORE_LOCKOUT - fails % ATTEMPTS_BEFORE_LOCKOUT)
        }
    }

    fun lockoutRemainingMs(now: Long = System.currentTimeMillis()): Long =
        (prefs.getLong(KEY_LOCKED_UNTIL, 0) - now).coerceAtLeast(0)

    private fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun decode(value: String) = Base64.decode(value, Base64.NO_WRAP)

    companion object {
        const val ATTEMPTS_BEFORE_LOCKOUT = 5
        private const val KEY_SALT = "salt"
        private const val KEY_BLOB = "blob"
        private const val KEY_FAIL_COUNT = "fail_count"
        private const val KEY_LOCKED_UNTIL = "locked_until"
        private val LOCKOUT_STEPS_MS = longArrayOf(30_000, 60_000, 300_000, 900_000, 1_800_000)
    }
}

sealed interface UnlockResult {
    data object Success : UnlockResult
    data class Incorrect(val attemptsRemaining: Int) : UnlockResult
    data class LockedOut(val remainingMs: Long) : UnlockResult
    data class Error(val message: String) : UnlockResult
}
