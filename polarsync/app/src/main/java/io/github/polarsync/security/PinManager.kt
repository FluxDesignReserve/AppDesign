package io.github.polarsync.security

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/** Where [PinManager] persists its state. */
interface PinStore {
    var salt: ByteArray?
    var hash: ByteArray?
    var failedAttempts: Int
    var lockedUntilMillis: Long
}

/**
 * The 4-digit app PIN. Only a salted PBKDF2 hash is stored; checks use a constant-time
 * comparison. After [FREE_ATTEMPTS] wrong guesses, each further wrong guess locks entry for
 * longer (30 s, 1 min, 2 min … up to 1 h), so all 10,000 PINs can't be tried quickly.
 *
 * Calls hash the PIN, which takes noticeable time: run them off the main thread.
 */
class PinManager(
    private val store: PinStore,
    private val clock: () -> Long = System::currentTimeMillis,
    private val iterations: Int = DEFAULT_ITERATIONS,
    private val random: SecureRandom = SecureRandom(),
) {

    sealed interface Result {
        data object Success : Result
        data class Wrong(val attemptsBeforeLockout: Int) : Result
        data class LockedOut(val untilMillis: Long) : Result
    }

    val isPinSet: Boolean get() = store.hash != null && store.salt != null

    /** Millis until another guess is allowed, or 0. */
    fun lockoutRemainingMs(): Long = (store.lockedUntilMillis - clock()).coerceAtLeast(0)

    fun setPin(pin: String) {
        require(isValidPin(pin)) { "PIN must be $PIN_LENGTH digits" }
        val salt = ByteArray(SALT_BYTES).also(random::nextBytes)
        store.salt = salt
        store.hash = hash(pin, salt)
        store.failedAttempts = 0
        store.lockedUntilMillis = 0
    }

    fun verify(pin: String): Result {
        val now = clock()
        if (now < store.lockedUntilMillis) return Result.LockedOut(store.lockedUntilMillis)
        val salt = store.salt
        val expected = store.hash
        check(salt != null && expected != null) { "No PIN has been set" }

        if (isValidPin(pin) && MessageDigest.isEqual(hash(pin, salt), expected)) {
            store.failedAttempts = 0
            store.lockedUntilMillis = 0
            return Result.Success
        }

        val failures = store.failedAttempts + 1
        store.failedAttempts = failures
        val lockout = lockoutDurationMs(failures)
        return if (lockout > 0) {
            store.lockedUntilMillis = now + lockout
            Result.LockedOut(now + lockout)
        } else {
            Result.Wrong(FREE_ATTEMPTS - failures)
        }
    }

    private fun hash(pin: String, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(pin.toCharArray(), salt, iterations, HASH_BITS)
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    companion object {
        const val PIN_LENGTH = 4
        const val FREE_ATTEMPTS = 5
        private const val SALT_BYTES = 16
        private const val HASH_BITS = 256
        private const val DEFAULT_ITERATIONS = 120_000
        private const val FIRST_LOCKOUT_MS = 30_000L
        private const val MAX_LOCKOUT_MS = 60 * 60 * 1000L

        fun isValidPin(pin: String): Boolean = pin.length == PIN_LENGTH && pin.all { it in '0'..'9' }

        /** 0 for the first [FREE_ATTEMPTS] failures, then 30 s doubling per failure, capped at 1 h. */
        fun lockoutDurationMs(failures: Int): Long {
            if (failures < FREE_ATTEMPTS) return 0
            val doublings = (failures - FREE_ATTEMPTS).coerceAtMost(7)
            return (FIRST_LOCKOUT_MS shl doublings).coerceAtMost(MAX_LOCKOUT_MS)
        }
    }
}
