package com.misync.recorder.security

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.SecureRandom

class PinHasherTest {

    @Test
    fun `accepts only six digit pins`() {
        assertTrue(PinHasher.isValidFormat("123456"))
        assertTrue(PinHasher.isValidFormat("000000"))
        for (bad in listOf("", "12345", "1234567", "12345a", "abcdef", "12 456")) {
            assertFalse(bad, PinHasher.isValidFormat(bad))
        }
    }

    @Test
    fun `correct pin verifies and wrong pin does not`() {
        val stored = PinHasher.create("314159")
        assertTrue(PinHasher.verify("314159", stored))
        assertFalse(PinHasher.verify("314158", stored))
        assertFalse(PinHasher.verify("000000", stored))
    }

    @Test
    fun `malformed pin never verifies`() {
        val stored = PinHasher.create("123456")
        assertFalse(PinHasher.verify("12345", stored))
        assertFalse(PinHasher.verify("1234567", stored))
    }

    @Test
    fun `the pin is not recoverable from stored material`() {
        val stored = PinHasher.create("246810")
        assertFalse(stored.hash.contains("246810"))
        assertFalse(stored.salt.contains("246810"))
    }

    @Test
    fun `same pin yields different hashes under different salts`() {
        val a = PinHasher.create("112233")
        val b = PinHasher.create("112233")
        assertNotEquals(a.salt, b.salt)
        assertNotEquals(a.hash, b.hash)
        // ...yet each still verifies its own.
        assertTrue(PinHasher.verify("112233", a))
        assertTrue(PinHasher.verify("112233", b))
    }

    @Test
    fun `create rejects invalid format`() {
        for (bad in listOf("12345", "abcdef", "")) {
            try {
                PinHasher.create(bad)
                throw AssertionError("expected rejection of '$bad'")
            } catch (expected: IllegalArgumentException) {
            }
        }
    }

    @Test
    fun `salt generation uses the supplied randomness source`() {
        val fixed = object : SecureRandom() {
            override fun nextBytes(bytes: ByteArray) { bytes.fill(7) }
        }
        val a = PinHasher.create("999999", fixed)
        val b = PinHasher.create("999999", fixed)
        // Same salt bytes -> identical stored material for the same pin.
        assertTrue(a == b)
    }
}
