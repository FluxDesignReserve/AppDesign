package com.misync.recorder.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class AesGcmKeyWrapperTest {

    @Test
    fun `wrap then unwrap returns the original data key`() {
        val wrapper = TestKeys.newWrapper()
        val dek = DataKeys.generate()
        assertArrayEquals(dek, wrapper.unwrap(wrapper.wrap(dek)))
    }

    @Test
    fun `wrapped form is iv plus ciphertext plus tag`() {
        val wrapped = TestKeys.newWrapper().wrap(DataKeys.generate())
        assertEquals(AesGcmKeyWrapper.IV_BYTES + DataKeys.KEY_BYTES + AesGcmKeyWrapper.TAG_BYTES, wrapped.size)
    }

    @Test
    fun `wrapping the same key twice uses fresh IVs`() {
        val wrapper = TestKeys.newWrapper()
        val dek = DataKeys.generate()
        assertFalse(wrapper.wrap(dek).contentEquals(wrapper.wrap(dek)))
    }

    @Test(expected = CorruptRecordingException::class)
    fun `tampered wrapped key is rejected`() {
        val wrapper = TestKeys.newWrapper()
        val wrapped = wrapper.wrap(DataKeys.generate())
        wrapped[wrapped.size - 1] = (wrapped[wrapped.size - 1].toInt() xor 1).toByte()
        wrapper.unwrap(wrapped)
    }

    @Test(expected = CorruptRecordingException::class)
    fun `a different key-encryption key cannot unwrap`() {
        val wrapped = TestKeys.newWrapper().wrap(DataKeys.generate())
        TestKeys.newWrapper().unwrap(wrapped)
    }

    @Test(expected = CorruptRecordingException::class)
    fun `truncated wrapped key is rejected`() {
        TestKeys.newWrapper().unwrap(ByteArray(10))
    }
}
