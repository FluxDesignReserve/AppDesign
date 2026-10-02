package io.github.polarsync.security

import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.EOFException
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.security.GeneralSecurityException
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * On-disk format for encrypted recordings (`.psm`).
 *
 * Each file has its own random AES-256 data key, stored wrapped by the master key (see
 * [KeyWrapper]). The audio is split into fixed-size chunks, each sealed with AES-GCM, so a
 * player can seek and decrypt any part of the file without decrypting the rest.
 *
 * ```
 * header : magic "PSM1" | u16 ivLen | iv | u16 wrappedLen | wrappedKey | i32 chunkSize | i64 plaintextLength
 * chunk i: AES-GCM(dataKey, nonce = i, aad = header ‖ i) → ciphertext ‖ 16-byte tag
 * ```
 *
 * The nonce can be the chunk index because every file has a fresh key. Using the whole header
 * plus the index as associated data means chunks can't be reordered, swapped between files,
 * or truncated without decryption failing.
 */
object EncryptedMemoFormat {

    private const val MAGIC = 0x50534D31 // "PSM1"
    const val CHUNK_SIZE = 64 * 1024
    private const val TAG_BYTES = 16
    private const val KEY_BYTES = 32
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    /** Encrypts [input] into [output]. [output] is written via a temp file and renamed at the end. */
    fun encryptFile(input: File, output: File, wrapper: KeyWrapper, random: SecureRandom = SecureRandom()) {
        val temp = File(output.parentFile, output.name + ".part")
        try {
            input.inputStream().buffered().use { source ->
                temp.outputStream().buffered().use { sink ->
                    encrypt(source, input.length(), sink, wrapper, random)
                }
            }
            if (!temp.renameTo(output)) throw IOException("Could not move ${temp.name} into place")
        } finally {
            temp.delete()
        }
    }

    fun encrypt(
        input: InputStream,
        plaintextLength: Long,
        output: OutputStream,
        wrapper: KeyWrapper,
        random: SecureRandom = SecureRandom(),
    ) {
        val dataKey = ByteArray(KEY_BYTES).also(random::nextBytes)
        try {
            val header = header(wrapper.wrap(dataKey), CHUNK_SIZE, plaintextLength)
            output.write(header)

            val key = SecretKeySpec(dataKey, "AES")
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val buffer = ByteArray(CHUNK_SIZE)
            var remaining = plaintextLength
            var index = 0L
            while (remaining > 0) {
                val length = minOf(CHUNK_SIZE.toLong(), remaining).toInt()
                readFully(input, buffer, length)
                cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_BYTES * 8, nonce(index)))
                cipher.updateAAD(aad(header, index))
                output.write(cipher.doFinal(buffer, 0, length))
                remaining -= length
                index++
            }
            if (input.read() != -1) throw IOException("Input is longer than $plaintextLength bytes")
        } finally {
            dataKey.fill(0)
        }
    }

    /** Random-access decryption of one `.psm` file. Not thread-safe; callers synchronise. */
    class Reader(file: File, wrapper: KeyWrapper) : Closeable {

        private val raf = RandomAccessFile(file, "r")
        private val header: ByteArray
        private val chunkSize: Int
        private val key: SecretKeySpec
        private val cipher = Cipher.getInstance(TRANSFORMATION)

        val plaintextLength: Long

        private var cachedIndex = -1L
        private var cachedChunk = ByteArray(0)

        init {
            try {
                val input = DataInputStream(RandomAccessFileInput(raf))
                if (input.readInt() != MAGIC) throw IOException("Not a Polarsync recording")
                val iv = ByteArray(input.readUnsignedShort()).also(input::readFully)
                val wrapped = ByteArray(input.readUnsignedShort()).also(input::readFully)
                chunkSize = input.readInt()
                plaintextLength = input.readLong()
                if (chunkSize <= 0 || plaintextLength < 0) throw IOException("Corrupt header")

                header = header(WrappedKey(iv, wrapped), chunkSize, plaintextLength)
                val chunks = (plaintextLength + chunkSize - 1) / chunkSize
                val expectedLength = header.size + plaintextLength + chunks * TAG_BYTES
                if (raf.length() != expectedLength) throw IOException("Recording is truncated or corrupt")

                val dataKey = try {
                    wrapper.unwrap(WrappedKey(iv, wrapped))
                } catch (e: GeneralSecurityException) {
                    throw IOException("Could not unlock recording key", e)
                }
                key = SecretKeySpec(dataKey, "AES")
                dataKey.fill(0)
            } catch (e: Exception) {
                raf.close()
                throw if (e is IOException) e else IOException(e)
            }
        }

        /** Same contract as `MediaDataSource.readAt`: returns bytes read, or -1 at end. */
        fun readAt(position: Long, buffer: ByteArray, offset: Int, size: Int): Int {
            if (position >= plaintextLength) return -1
            if (size <= 0) return 0
            var pos = position
            var written = 0
            while (written < size && pos < plaintextLength) {
                val index = pos / chunkSize
                val chunk = chunk(index)
                val within = (pos - index * chunkSize).toInt()
                val count = minOf(size - written, chunk.size - within)
                System.arraycopy(chunk, within, buffer, offset + written, count)
                written += count
                pos += count
            }
            return written
        }

        private fun chunk(index: Long): ByteArray {
            if (index == cachedIndex) return cachedChunk
            val plainLength = minOf(chunkSize.toLong(), plaintextLength - index * chunkSize).toInt()
            val sealed = ByteArray(plainLength + TAG_BYTES)
            raf.seek(header.size + index * (chunkSize + TAG_BYTES))
            raf.readFully(sealed)
            val plain = try {
                cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BYTES * 8, nonce(index)))
                cipher.updateAAD(aad(header, index))
                cipher.doFinal(sealed)
            } catch (e: GeneralSecurityException) {
                throw IOException("Recording has been tampered with or is corrupt", e)
            }
            cachedIndex = index
            cachedChunk = plain
            return plain
        }

        override fun close() {
            cachedChunk.fill(0)
            raf.close()
        }
    }

    private fun header(wrapped: WrappedKey, chunkSize: Int, plaintextLength: Long): ByteArray {
        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).run {
            writeInt(MAGIC)
            writeShort(wrapped.iv.size)
            write(wrapped.iv)
            writeShort(wrapped.bytes.size)
            write(wrapped.bytes)
            writeInt(chunkSize)
            writeLong(plaintextLength)
        }
        return bytes.toByteArray()
    }

    private fun nonce(index: Long): ByteArray = ByteBuffer.allocate(12).putInt(0).putLong(index).array()

    private fun aad(header: ByteArray, index: Long): ByteArray =
        ByteBuffer.allocate(header.size + 8).put(header).putLong(index).array()

    private fun readFully(input: InputStream, buffer: ByteArray, length: Int) {
        var read = 0
        while (read < length) {
            val n = input.read(buffer, read, length - read)
            if (n < 0) throw EOFException("Input ended early")
            read += n
        }
    }

    /** Lets [DataInputStream] read sequentially from a [RandomAccessFile]. */
    private class RandomAccessFileInput(private val raf: RandomAccessFile) : InputStream() {
        override fun read(): Int = raf.read()
        override fun read(b: ByteArray, off: Int, len: Int): Int = raf.read(b, off, len)
    }
}
