package com.misync.recorder.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.SecureRandom

class PinCryptoTest {

    private val salt = PinCrypto.newSalt()
    private val master = DataKeys.generate()

    @Test
    fun `accepts only six digit pins`() {
        assertTrue(PinCrypto.isValidFormat("123456"))
        assertTrue(PinCrypto.isValidFormat("000000"))
        for (bad in listOf("", "12345", "1234567", "12345a", "abcdef", "12 456")) {
            assertFalse(bad, PinCrypto.isValidFormat(bad))
        }
    }

    @Test
    fun `correct pin unwraps the master key`() {
        val blob = PinCrypto.wrap("314159", salt, master)
        assertArrayEquals(master, PinCrypto.unwrap("314159", salt, blob))
    }

    @Test
    fun `wrong pin returns null`() {
        val blob = PinCrypto.wrap("314159", salt, master)
        assertNull(PinCrypto.unwrap("314158", salt, blob))
        assertNull(PinCrypto.unwrap("000000", salt, blob))
    }

    @Test
    fun `malformed pin never unwraps`() {
        val blob = PinCrypto.wrap("123456", salt, master)
        assertNull(PinCrypto.unwrap("12345", salt, blob))
        assertNull(PinCrypto.unwrap("1234567", salt, blob))
    }

    @Test
    fun `wrong salt returns null`() {
        val blob = PinCrypto.wrap("246810", salt, master)
        assertNull(PinCrypto.unwrap("246810", PinCrypto.newSalt(), blob))
    }

    @Test
    fun `tampered blob is rejected`() {
        val blob = PinCrypto.wrap("135790", salt, master)
        blob[blob.size - 1] = (blob[blob.size - 1].toInt() xor 1).toByte()
        assertNull(PinCrypto.unwrap("135790", salt, blob))
    }

    @Test
    fun `truncated blob is rejected`() {
        assertNull(PinCrypto.unwrap("111111", salt, ByteArray(8)))
    }

    @Test
    fun `the master key does not appear in the blob`() {
        val blob = PinCrypto.wrap("222222", salt, master)
        // The 32-byte master key must not be present verbatim in the ciphertext.
        assertFalse(blob.toList().windowed(master.size).any { it.toByteArray().contentEquals(master) })
    }

    @Test
    fun `same inputs with same randomness are reproducible, different randomness differs`() {
        val fixed = object : SecureRandom() { override fun nextBytes(b: ByteArray) { b.fill(9) } }
        val a = PinCrypto.wrap("999999", salt, master, fixed)
        val b = PinCrypto.wrap("999999", salt, master, fixed)
        assertArrayEquals(a, b)
        val c = PinCrypto.wrap("999999", salt, master) // real randomness -> different IV
        assertNotEquals(a.toList(), c.toList())
        // ...all still unwrap correctly.
        assertArrayEquals(master, PinCrypto.unwrap("999999", salt, a))
        assertArrayEquals(master, PinCrypto.unwrap("999999", salt, c))
    }

    @Test
    fun `wrap rejects invalid pin format`() {
        try {
            PinCrypto.wrap("12345", salt, master)
            throw AssertionError("expected rejection")
        } catch (expected: IllegalArgumentException) {
        }
    }
}
