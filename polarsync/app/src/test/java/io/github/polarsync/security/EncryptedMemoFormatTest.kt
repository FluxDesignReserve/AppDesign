package io.github.polarsync.security

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class EncryptedMemoFormatTest {

    @get:Rule
    val tmp = TemporaryFolder()

    /** Stands in for Android Keystore: AES-GCM with an in-memory master key. */
    private class SoftwareKeyWrapper(seed: Byte = 7) : KeyWrapper {
        private val master = SecretKeySpec(ByteArray(32) { seed }, "AES")
        private val random = SecureRandom()

        override fun wrap(key: ByteArray): WrappedKey {
            val iv = ByteArray(12).also(random::nextBytes)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, master, GCMParameterSpec(128, iv))
            return WrappedKey(iv, cipher.doFinal(key))
        }

        override fun unwrap(wrapped: WrappedKey): ByteArray {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, master, GCMParameterSpec(128, wrapped.iv))
            return cipher.doFinal(wrapped.bytes)
        }
    }

    private val wrapper = SoftwareKeyWrapper()
    private val chunk = EncryptedMemoFormat.CHUNK_SIZE

    private fun plainFile(size: Int): Pair<File, ByteArray> {
        val data = ByteArray(size).also { SecureRandom().nextBytes(it) }
        val file = tmp.newFile().apply { writeBytes(data) }
        return file to data
    }

    private fun encrypt(size: Int): Triple<File, File, ByteArray> {
        val (plain, data) = plainFile(size)
        val out = File(tmp.root, "out-$size.psm")
        EncryptedMemoFormat.encryptFile(plain, out, wrapper)
        return Triple(plain, out, data)
    }

    private fun decryptAll(file: File, w: KeyWrapper = wrapper): ByteArray =
        EncryptedMemoFormat.Reader(file, w).use { reader ->
            val out = ByteArray(reader.plaintextLength.toInt())
            var pos = 0
            while (pos < out.size) {
                val n = reader.readAt(pos.toLong(), out, pos, 10_000)
                assertTrue(n > 0)
                pos += n
            }
            assertEquals(-1, reader.readAt(out.size.toLong(), ByteArray(1), 0, 1))
            out
        }

    @Test
    fun roundTrip_variousSizes() {
        for (size in listOf(0, 1, chunk - 1, chunk, chunk + 1, chunk * 3 + 12_345)) {
            val (_, out, data) = encrypt(size)
            assertArrayEquals("size $size", data, decryptAll(out))
        }
    }

    @Test
    fun ciphertextDoesNotContainPlaintext() {
        val (_, out, data) = encrypt(chunk * 2)
        val bytes = out.readBytes()
        val probe = data.copyOfRange(1000, 1032)
        assertFalse(bytes.toList().windowed(probe.size).any { it.toByteArray().contentEquals(probe) })
    }

    @Test
    fun randomAccessAcrossChunkBoundaries() {
        val (_, out, data) = encrypt(chunk * 3 + 500)
        EncryptedMemoFormat.Reader(out, wrapper).use { reader ->
            for (start in listOf(0L, chunk - 10L, chunk * 2L - 1, chunk * 3L + 400)) {
                val buf = ByteArray(300)
                val n = reader.readAt(start, buf, 0, buf.size)
                val expected = data.copyOfRange(start.toInt(), minOf(data.size, start.toInt() + 300))
                assertEquals(expected.size, n)
                assertArrayEquals(expected, buf.copyOf(n))
            }
        }
    }

    @Test
    fun tamperedByteIsDetected() {
        val (_, out, _) = encrypt(chunk + 100)
        RandomAccessFile(out, "rw").use { raf ->
            val pos = raf.length() - 50
            raf.seek(pos)
            val b = raf.read()
            raf.seek(pos)
            raf.write(b xor 0x01)
        }
        EncryptedMemoFormat.Reader(out, wrapper).use { reader ->
            reader.readAt(0, ByteArray(10), 0, 10) // First chunk is intact.
            assertThrows(IOException::class.java) { reader.readAt(chunk.toLong(), ByteArray(10), 0, 10) }
        }
    }

    @Test
    fun truncatedFileIsRejected() {
        val (_, out, _) = encrypt(chunk * 2)
        RandomAccessFile(out, "rw").use { it.setLength(it.length() - 1) }
        assertThrows(IOException::class.java) { EncryptedMemoFormat.Reader(out, wrapper) }
    }

    @Test
    fun wrongMasterKeyCannotOpen() {
        val (_, out, _) = encrypt(1000)
        assertThrows(IOException::class.java) { EncryptedMemoFormat.Reader(out, SoftwareKeyWrapper(seed = 9)) }
    }

    @Test
    fun eachFileGetsItsOwnKey() {
        val (plain, _) = plainFile(5000)
        val a = File(tmp.root, "a.psm").also { EncryptedMemoFormat.encryptFile(plain, it, wrapper) }
        val b = File(tmp.root, "b.psm").also { EncryptedMemoFormat.encryptFile(plain, it, wrapper) }
        assertFalse(a.readBytes().contentEquals(b.readBytes()))
    }

    @Test
    fun notAPolarsyncFileIsRejected() {
        val (plain, _) = plainFile(1000)
        assertThrows(IOException::class.java) { EncryptedMemoFormat.Reader(plain, wrapper) }
    }

    @Test
    fun noPartFileLeftBehind() {
        encrypt(chunk + 1)
        assertTrue(tmp.root.listFiles()!!.none { it.name.endsWith(".part") })
    }
}
