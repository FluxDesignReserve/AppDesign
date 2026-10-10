package com.misync.recorder.crypto

import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.SecretKeySpec

/**
 * Derives a key from the six-digit access PIN and uses it to seal the app's master key.
 *
 * The PIN is the root of the app's encryption: the master key (which in turn wraps every
 * recording's own key) is encrypted under a key stretched from the PIN with PBKDF2-HMAC-SHA256
 * over a random per-install salt. Without the exact PIN the master key cannot be recovered, so
 * there is intentionally no reset or backdoor — a forgotten PIN means the recordings are gone.
 *
 * A six-digit PIN is a small space (10^6), so on-device this sealed blob is additionally wrapped
 * by a non-exportable Android Keystore key (see [KeystoreKeyProvider]); that outer layer stops an
 * attacker who copies the files off the device from brute-forcing the PIN offline. This class is
 * the inner, device-independent layer, kept pure so it can be unit tested.
 *
 * Blob layout: `iv(12) || ciphertext || tag(16)`.
 */
object PinCrypto {
    const val PIN_LENGTH = 6
    private const val SALT_BYTES = 16
    private const val KEY_BITS = 256
    private const val ITERATIONS = 120_000
    private const val IV_BYTES = 12
    private const val TAG_BYTES = 16
    private val AAD = "MISync-master-v1".toByteArray()

    fun isValidFormat(pin: String): Boolean = pin.length == PIN_LENGTH && pin.all { it.isDigit() }

    fun newSalt(random: SecureRandom = SecureRandom()): ByteArray =
        ByteArray(SALT_BYTES).also(random::nextBytes)

    /** Seals [plaintext] (the master key) under a key derived from [pin] and [salt]. */
    fun wrap(pin: String, salt: ByteArray, plaintext: ByteArray, random: SecureRandom = SecureRandom()): ByteArray {
        require(isValidFormat(pin)) { "PIN must be $PIN_LENGTH digits" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val iv = ByteArray(IV_BYTES).also(random::nextBytes)
        cipher.init(Cipher.ENCRYPT_MODE, deriveKey(pin, salt), GCMParameterSpec(TAG_BYTES * 8, iv))
        cipher.updateAAD(AAD)
        return iv + cipher.doFinal(plaintext)
    }

    /** Returns the master key if [pin] is correct, or null if it is wrong or the blob is damaged. */
    fun unwrap(pin: String, salt: ByteArray, blob: ByteArray): ByteArray? {
        if (!isValidFormat(pin) || blob.size < IV_BYTES + TAG_BYTES) return null
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, deriveKey(pin, salt), GCMParameterSpec(TAG_BYTES * 8, blob, 0, IV_BYTES))
            cipher.updateAAD(AAD)
            cipher.doFinal(blob, IV_BYTES, blob.size - IV_BYTES)
        } catch (e: javax.crypto.AEADBadTagException) {
            null
        } catch (e: javax.crypto.IllegalBlockSizeException) {
            null
        }
    }

    private fun deriveKey(pin: String, salt: ByteArray): SecretKeySpec {
        val spec = PBEKeySpec(pin.toCharArray(), salt, ITERATIONS, KEY_BITS)
        return try {
            SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded, "AES")
        } finally {
            spec.clearPassword()
        }
    }
}
