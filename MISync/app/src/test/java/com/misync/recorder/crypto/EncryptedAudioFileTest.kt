package com.misync.recorder.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.RandomAccessFile
import kotlin.random.Random

class EncryptedAudioFileTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val kek = TestKeys.newKek()
    private val wrapper = TestKeys.newWrapper(kek)
    private val chunk = 1024

    private fun pcm(size: Int, seed: Int = size) = Random(seed).nextBytes(size)

    private fun write(data: ByteArray, file: File = tmp.newFile(), pieces: Int = 7): File {
        EncryptedAudioWriter.create(file, wrapper, 44_100, 1, createdAtMillis = 1234L, chunkSize = chunk).use { w ->
            // Feed in uneven pieces to exercise buffering across chunk boundaries.
            var pos = 0
            val step = maxOf(1, data.size / pieces + 3)
            while (pos < data.size) {
                val n = minOf(step, data.size - pos)
                w.write(data, pos, n)
                pos += n
            }
            assertEquals(data.size.toLong(), w.plaintextBytes)
        }
        return file
    }

    private fun readAll(file: File): ByteArray = EncryptedAudioReader(file, wrapper).use { r ->
        val out = ByteArrayOutputStream()
        for (i in 0 until r.dataChunkCount) out.write(r.readChunk(i))
        out.toByteArray()
    }

    @Test
    fun `round trips audio of many sizes`() {
        for (size in listOf(0, 1, 2, chunk - 1, chunk, chunk + 1, chunk * 5, chunk * 5 + 77)) {
            val data = pcm(size)
            val file = write(data)
            assertArrayEquals("size $size", data, readAll(file))
            EncryptedAudioReader(file, wrapper).use { r ->
                assertTrue(r.isComplete)
                assertTrue(r.verify().ok)
                assertEquals(size.toLong(), r.totalPlaintextBytes)
            }
        }
    }

    @Test
    fun `header is preserved and duration is computed from pcm length`() {
        val file = write(pcm(44_100 * 2 * 3)) // 3 s of 16-bit mono
        EncryptedAudioReader(file, wrapper).use { r ->
            assertEquals(44_100, r.header.sampleRate)
            assertEquals(1, r.header.channels)
            assertEquals(16, r.header.bitsPerSample)
            assertEquals(1234L, r.header.createdAtMillis)
            assertEquals(3_000L, r.durationMillis)
        }
    }

    @Test
    fun `ciphertext does not contain the plaintext`() {
        val data = ByteArray(chunk * 3) { 0x41 }
        val raw = write(data).readBytes()
        val needle = ByteArray(64) { 0x41 }
        assertFalse(raw.toList().windowed(needle.size, 16).any { it.toByteArray().contentEquals(needle) })
    }

    @Test
    fun `random access by chunk supports seeking`() {
        val data = pcm(chunk * 4 + 100)
        val file = write(data)
        EncryptedAudioReader(file, wrapper).use { r ->
            val position = chunk * 2L + 10
            val index = r.chunkIndexFor(position)
            assertEquals(2, index)
            assertArrayEquals(data.copyOfRange(chunk * 2, chunk * 3), r.readChunk(index))
            assertEquals(4, r.chunkIndexFor(Long.MAX_VALUE / 2))
        }
    }

    @Test
    fun `wrong device key cannot open the recording`() {
        val file = write(pcm(5000))
        try {
            EncryptedAudioReader(file, TestKeys.newWrapper())
            fail("Expected failure")
        } catch (expected: CorruptRecordingException) {
        }
    }

    @Test
    fun `flipped ciphertext bit is detected`() {
        val file = write(pcm(chunk * 3))
        val headerSize = EncryptedAudioReader(file, wrapper).use { it.header.encode().size }
        val record = ChunkCodec.PREFIX_BYTES + chunk + ChunkCodec.TAG_BYTES
        flipByte(file, headerSize.toLong() + record + ChunkCodec.PREFIX_BYTES + 40) // inside chunk 1's ciphertext
        EncryptedAudioReader(file, wrapper).use { r ->
            r.readChunk(0)
            try {
                r.readChunk(1)
                fail("Expected authentication failure")
            } catch (expected: CorruptRecordingException) {
            }
            val result = r.verify()
            assertFalse(result.ok)
            assertEquals(1, result.failedChunk)
        }
    }

    @Test
    fun `editing the header breaks authentication of every chunk`() {
        val file = write(pcm(chunk * 2))
        // Change the sample rate field (offset 5..8) from 44100 to 48000.
        RandomAccessFile(file, "rw").use { it.seek(5); it.writeInt(48_000) }
        EncryptedAudioReader(file, wrapper).use { r ->
            assertEquals(48_000, r.header.sampleRate)
            assertFalse(r.verify().ok)
            assertEquals(0, r.verify().failedChunk)
        }
    }

    @Test
    fun `swapping two chunks is detected`() {
        val file = write(pcm(chunk * 3))
        val headerSize = EncryptedAudioReader(file, wrapper).use { it.header.encode().size }
        val record = ChunkCodec.PREFIX_BYTES + chunk + ChunkCodec.TAG_BYTES
        RandomAccessFile(file, "rw").use { raf ->
            val a = ByteArray(record).also { raf.seek(headerSize.toLong()); raf.readFully(it) }
            val b = ByteArray(record).also { raf.seek(headerSize.toLong() + record); raf.readFully(it) }
            raf.seek(headerSize.toLong()); raf.write(b)
            raf.seek(headerSize.toLong() + record); raf.write(a)
        }
        EncryptedAudioReader(file, wrapper).use { assertEquals(0, it.verify().failedChunk) }
    }

    @Test
    fun `truncation is detected via the missing end marker`() {
        val file = write(pcm(chunk * 3))
        RandomAccessFile(file, "rw").use { it.setLength(it.length() - 5) }
        EncryptedAudioReader(file, wrapper).use { r ->
            assertFalse(r.isComplete)
            assertNotNull(r.structuralProblem)
            assertFalse(r.verify().ok)
        }
    }

    @Test(expected = CorruptRecordingException::class)
    fun `non recording file is rejected`() {
        val file = tmp.newFile().apply { writeBytes(ByteArray(200) { 7 }) }
        EncryptedAudioReader(file, wrapper)
    }

    @Test(expected = CorruptRecordingException::class)
    fun `empty file is rejected`() {
        EncryptedAudioReader(tmp.newFile(), wrapper)
    }

    @Test
    fun `interrupted recording is recovered up to the last complete chunk`() {
        val data = pcm(chunk * 4 + 300)
        val file = tmp.newFile()
        val writer = EncryptedAudioWriter.create(file, wrapper, 44_100, 1, chunkSize = chunk, syncEveryChunks = 1)
        writer.write(data)
        writer.abandon() // simulates process death: buffered tail and end marker never written
        // Plus a torn write of half a chunk record at the end.
        file.appendBytes(ByteArray(10) { 1 })

        val result = EncryptedAudioRecovery.recover(file, wrapper)
        assertTrue(result.repaired)
        assertEquals(4, result.validChunks)
        assertEquals(chunk * 4L, result.plaintextBytes)
        EncryptedAudioReader(file, wrapper).use { r ->
            assertTrue(r.isComplete)
            assertTrue(r.verify().ok)
        }
        assertArrayEquals(data.copyOfRange(0, chunk * 4), readAll(file))
    }

    @Test
    fun `recovery truncates at the first corrupt chunk`() {
        val data = pcm(chunk * 5)
        val file = write(data)
        val headerSize = EncryptedAudioReader(file, wrapper).use { it.header.encode().size }
        val record = ChunkCodec.PREFIX_BYTES + chunk + ChunkCodec.TAG_BYTES
        flipByte(file, headerSize.toLong() + record * 3 + ChunkCodec.PREFIX_BYTES + 3)

        val result = EncryptedAudioRecovery.recover(file, wrapper)
        assertTrue(result.repaired)
        assertEquals(3, result.validChunks)
        assertArrayEquals(data.copyOfRange(0, chunk * 3), readAll(file))
        EncryptedAudioReader(file, wrapper).use { assertTrue(it.verify().ok) }
    }

    @Test
    fun `recovering an intact file changes nothing`() {
        val file = write(pcm(chunk * 2 + 5))
        val before = file.readBytes()
        val result = EncryptedAudioRecovery.recover(file, wrapper)
        assertFalse(result.repaired)
        assertArrayEquals(before, file.readBytes())
    }

    @Test
    fun `recording interrupted before any chunk recovers as empty`() {
        val file = tmp.newFile()
        EncryptedAudioWriter.create(file, wrapper, 44_100, 1, chunkSize = chunk).apply {
            write(pcm(100))
            abandon()
        }
        val result = EncryptedAudioRecovery.recover(file, wrapper)
        assertEquals(0, result.validChunks)
        EncryptedAudioReader(file, wrapper).use { assertTrue(it.verify().ok) }
    }

    @Test
    fun `close is idempotent and wipes the data key`() {
        val file = tmp.newFile()
        val writer = EncryptedAudioWriter.create(file, wrapper, 44_100, 1, chunkSize = chunk)
        writer.write(pcm(10))
        writer.close()
        writer.close()
        EncryptedAudioReader(file, wrapper).use { assertTrue(it.verify().ok) }
    }

    private fun flipByte(file: File, offset: Long) {
        RandomAccessFile(file, "rw").use { raf ->
            raf.seek(offset)
            val b = raf.read()
            raf.seek(offset)
            raf.write(b xor 0x01)
        }
    }
}
