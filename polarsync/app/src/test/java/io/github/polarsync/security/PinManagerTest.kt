package io.github.polarsync.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PinManagerTest {

    private class MemoryStore : PinStore {
        override var salt: ByteArray? = null
        override var hash: ByteArray? = null
        override var failedAttempts: Int = 0
        override var lockedUntilMillis: Long = 0
    }

    private var now = 1_000_000L
    private val store = MemoryStore()
    private val pins = PinManager(store, clock = { now }, iterations = 1_000)

    @Test
    fun correctPinUnlocks() {
        assertFalse(pins.isPinSet)
        pins.setPin("4821")
        assertTrue(pins.isPinSet)
        assertEquals(PinManager.Result.Success, pins.verify("4821"))
    }

    @Test
    fun pinIsNotStoredInPlainText() {
        pins.setPin("4821")
        assertNotEquals("4821", String(store.hash!!, Charsets.ISO_8859_1))
        assertEquals(32, store.hash!!.size)
    }

    @Test
    fun wrongPinCountsDownThenLocksOut() {
        pins.setPin("4821")
        for (left in 4 downTo 1) {
            assertEquals(PinManager.Result.Wrong(left), pins.verify("0000"))
        }
        val locked = pins.verify("0000")
        assertEquals(PinManager.Result.LockedOut(now + 30_000), locked)
        // Even the right PIN is refused during the lockout.
        assertEquals(PinManager.Result.LockedOut(now + 30_000), pins.verify("4821"))

        now += 30_000
        assertEquals(PinManager.Result.Success, pins.verify("4821"))
        assertEquals(0, store.failedAttempts)
    }

    @Test
    fun lockoutDoublesAndCaps() {
        assertEquals(0, PinManager.lockoutDurationMs(4))
        assertEquals(30_000, PinManager.lockoutDurationMs(5))
        assertEquals(60_000, PinManager.lockoutDurationMs(6))
        assertEquals(120_000, PinManager.lockoutDurationMs(7))
        assertEquals(3_600_000, PinManager.lockoutDurationMs(20))
        assertEquals(3_600_000, PinManager.lockoutDurationMs(Int.MAX_VALUE))
    }

    @Test
    fun malformedPinsAreRejected() {
        assertTrue(PinManager.isValidPin("0000"))
        assertFalse(PinManager.isValidPin("123"))
        assertFalse(PinManager.isValidPin("12345"))
        assertFalse(PinManager.isValidPin("12a4"))
    }

    @Test
    fun resettingPinChangesSalt() {
        pins.setPin("1111")
        val first = store.salt!!.copyOf()
        pins.setPin("1111")
        assertFalse(first.contentEquals(store.salt))
    }
}
