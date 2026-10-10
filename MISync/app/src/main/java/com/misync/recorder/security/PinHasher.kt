package com.misync.recorder.security

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Pure PIN hashing and verification, with no Android dependencies so it can be unit tested.
 *
 * The PIN is stretched with PBKDF2-HMAC-SHA256 over a random per-install salt; only the salt and
 * the derived hash are ever persisted. Verification is constant-time.
 */
object PinHasher {
    const val PIN_LENGTH = 6
    private const val SALT_BYTES = 16
    private const val KEY_BITS = 256
    private const val ITERATIONS = 120_000

    data class Stored(val salt: String, val hash: String)

    fun isValidFormat(pin: String): Boolean = pin.length == PIN_LENGTH && pin.all { it.isDigit() }

    fun create(pin: String, random: SecureRandom = SecureRandom()): Stored {
        require(isValidFormat(pin)) { "PIN must be $PIN_LENGTH digits" }
        val salt = ByteArray(SALT_BYTES).also(random::nextBytes)
        return Stored(encode(salt), encode(hash(pin, salt)))
    }

    fun verify(pin: String, stored: Stored): Boolean =
        isValidFormat(pin) && MessageDigest.isEqual(hash(pin, decode(stored.salt)), decode(stored.hash))

    private fun hash(pin: String, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(pin.toCharArray(), salt, ITERATIONS, KEY_BITS)
        return try {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun encode(bytes: ByteArray): String = Base64.getEncoder().encodeToString(bytes)
    private fun decode(value: String): ByteArray = Base64.getDecoder().decode(value)
}
