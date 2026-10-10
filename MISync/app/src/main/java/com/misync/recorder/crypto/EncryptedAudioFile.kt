package com.misync.recorder.crypto

import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.EOFException
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec

/**
 * MISync encrypted audio container (`.msa`), version 1.
 *
 * ```
 * header := magic "MSA1" | version u8 | sampleRate i32 | channels u8 | bitsPerSample u8
 *           | chunkSize i32 | createdAtMillis i64 | wrappedKeyLen u16 | wrappedKey
 * chunk  := flag u8 (0 = data, 1 = end) | ctLen i32 | nonce[12] | ciphertext+tag[ctLen]
 * ```
 *
 * Audio is raw little-endian PCM, split into fixed-size plaintext chunks that are each sealed
 * with AES-256-GCM under the recording's data key. Every chunk's AAD binds the full header, the
 * chunk index and the flag, so header edits, reordering, splicing between files and silent
 * truncation are all detected. Because every chunk is independently authenticated, a recording
 * interrupted by a crash or power loss can be recovered up to the last complete chunk, and
 * playback can seek without decrypting the whole file.
 */
data class AudioHeader(
    val sampleRate: Int,
    val channels: Int,
    val bitsPerSample: Int,
    val chunkSize: Int,
    val createdAtMillis: Long,
    val wrappedKey: ByteArray,
) {
    val bytesPerSecond: Int get() = sampleRate * channels * bitsPerSample / 8

    fun bytesToMillis(bytes: Long): Long = if (bytesPerSecond == 0) 0 else bytes * 1000 / bytesPerSecond

    fun encode(): ByteArray {
        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { out ->
            out.write(MAGIC)
            out.writeByte(VERSION)
            out.writeInt(sampleRate)
            out.writeByte(channels)
            out.writeByte(bitsPerSample)
            out.writeInt(chunkSize)
            out.writeLong(createdAtMillis)
            out.writeShort(wrappedKey.size)
            out.write(wrappedKey)
        }
        return bytes.toByteArray()
    }

    override fun equals(other: Any?): Boolean =
        other is AudioHeader && encode().contentEquals(other.encode())

    override fun hashCode(): Int = encode().contentHashCode()

    companion object {
        val MAGIC = "MSA1".toByteArray(Charsets.US_ASCII)
        const val VERSION = 1
        const val DEFAULT_CHUNK_SIZE = 64 * 1024
        private const val MAX_CHUNK_SIZE = 4 * 1024 * 1024
        private const val MAX_WRAPPED_KEY = 512

        /** Reads and validates a header, returning it together with its exact encoded bytes. */
        fun read(input: DataInputStream): Pair<AudioHeader, ByteArray> {
            try {
                val magic = ByteArray(4).also { input.readFully(it) }
                if (!magic.contentEquals(MAGIC)) throw CorruptRecordingException("Not a MISync recording")
                val version = input.readUnsignedByte()
                if (version != VERSION) throw CorruptRecordingException("Unsupported format version $version")
                val sampleRate = input.readInt()
                val channels = input.readUnsignedByte()
                val bits = input.readUnsignedByte()
                val chunkSize = input.readInt()
                val createdAt = input.readLong()
                val keyLen = input.readUnsignedShort()
                if (sampleRate !in 8_000..192_000 || channels !in 1..2 || bits != 16 ||
                    chunkSize !in 1..MAX_CHUNK_SIZE || keyLen !in 1..MAX_WRAPPED_KEY
                ) {
                    throw CorruptRecordingException("Header fields out of range")
                }
                val key = ByteArray(keyLen).also { input.readFully(it) }
                val header = AudioHeader(sampleRate, channels, bits, chunkSize, createdAt, key)
                return header to header.encode()
            } catch (e: EOFException) {
                throw CorruptRecordingException("Header truncated", e)
            }
        }
    }
}

internal object ChunkCodec {
    const val FLAG_DATA = 0
    const val FLAG_END = 1
    const val NONCE_BYTES = 12
    const val TAG_BYTES = 16
    const val PREFIX_BYTES = 1 + 4 + NONCE_BYTES

    fun aad(headerBytes: ByteArray, index: Long, flag: Int): ByteArray =
        ByteBuffer.allocate(headerBytes.size + 9).put(headerBytes).putLong(index).put(flag.toByte()).array()

    fun seal(dataKey: ByteArray, headerBytes: ByteArray, index: Long, flag: Int, plain: ByteArray, len: Int, random: SecureRandom): ByteArray {
        val nonce = ByteArray(NONCE_BYTES).also(random::nextBytes)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, DataKeys.toSecretKey(dataKey), GCMParameterSpec(TAG_BYTES * 8, nonce))
        cipher.updateAAD(aad(headerBytes, index, flag))
        val ct = cipher.doFinal(plain, 0, len)
        return ByteBuffer.allocate(PREFIX_BYTES + ct.size)
            .put(flag.toByte()).putInt(ct.size).put(nonce).put(ct).array()
    }

    fun open(dataKey: ByteArray, headerBytes: ByteArray, index: Long, flag: Int, nonce: ByteArray, ct: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, DataKeys.toSecretKey(dataKey), GCMParameterSpec(TAG_BYTES * 8, nonce))
        cipher.updateAAD(aad(headerBytes, index, flag))
        return try {
            cipher.doFinal(ct)
        } catch (e: AEADBadTagException) {
            throw CorruptRecordingException("Chunk $index failed authentication", e)
        }
    }
}

/**
 * Streams PCM into an encrypted `.msa` file. Not thread-safe; owned by the recording thread.
 *
 * Each completed chunk is written with a single `write` call and the file descriptor is synced
 * every [syncEveryChunks] chunks, bounding data loss on sudden power-off to a few seconds.
 */
class EncryptedAudioWriter private constructor(
    private val file: File,
    private val header: AudioHeader,
    private val dataKey: ByteArray,
    private val syncEveryChunks: Int,
    private val random: SecureRandom,
) : Closeable {

    private val headerBytes = header.encode()
    private val out = FileOutputStream(file)
    private val buffer = ByteArray(header.chunkSize)
    private var buffered = 0
    private var chunkIndex = 0L
    private var closed = false

    /** Plaintext PCM bytes accepted so far (including bytes still buffered). */
    var plaintextBytes: Long = 0
        private set

    /** Bytes written to disk so far. */
    var fileBytes: Long = 0
        private set

    init {
        try {
            out.write(headerBytes)
            out.fd.sync()
            fileBytes = headerBytes.size.toLong()
        } catch (e: IOException) {
            out.close()
            throw e
        }
    }

    fun write(data: ByteArray, offset: Int = 0, length: Int = data.size) {
        check(!closed) { "Writer is closed" }
        var pos = offset
        var remaining = length
        while (remaining > 0) {
            val n = minOf(remaining, buffer.size - buffered)
            System.arraycopy(data, pos, buffer, buffered, n)
            buffered += n
            pos += n
            remaining -= n
            plaintextBytes += n
            if (buffered == buffer.size) flushChunk()
        }
    }

    private fun flushChunk() {
        if (buffered == 0) return
        writeRecord(ChunkCodec.FLAG_DATA, buffer, buffered)
        buffered = 0
        if (chunkIndex % syncEveryChunks == 0L) out.fd.sync()
    }

    private fun writeRecord(flag: Int, plain: ByteArray, len: Int) {
        val record = ChunkCodec.seal(dataKey, headerBytes, chunkIndex, flag, plain, len, random)
        out.write(record)
        fileBytes += record.size
        chunkIndex++
    }

    /** Seals any buffered audio, writes the end marker and syncs. Safe to call more than once. */
    override fun close() {
        if (closed) return
        closed = true
        try {
            flushChunk()
            writeRecord(ChunkCodec.FLAG_END, ByteArray(0), 0)
            out.fd.sync()
        } finally {
            out.close()
            dataKey.fill(0)
        }
    }

    /** Closes the file without an end marker, leaving it to [EncryptedAudioRecovery]. Used after I/O errors. */
    fun abandon() {
        if (closed) return
        closed = true
        runCatching { out.close() }
        dataKey.fill(0)
    }

    companion object {
        fun create(
            file: File,
            keyWrapper: KeyWrapper,
            sampleRate: Int,
            channels: Int,
            createdAtMillis: Long = System.currentTimeMillis(),
            chunkSize: Int = AudioHeader.DEFAULT_CHUNK_SIZE,
            syncEveryChunks: Int = 4,
            random: SecureRandom = SecureRandom(),
        ): EncryptedAudioWriter {
            val dataKey = DataKeys.generate(random)
            val header = AudioHeader(sampleRate, channels, 16, chunkSize, createdAtMillis, keyWrapper.wrap(dataKey))
            return EncryptedAudioWriter(file, header, dataKey, syncEveryChunks.coerceAtLeast(1), random)
        }
    }
}

/**
 * Random-access reader. Opening indexes chunk boundaries (cheap, no decryption); [readChunk]
 * decrypts and authenticates a single chunk on demand.
 */
class EncryptedAudioReader(file: File, keyWrapper: KeyWrapper) : Closeable {

    private class ChunkRef(val offset: Long, val ctLen: Int, val flag: Int)

    private val raf = RandomAccessFile(file, "r")
    private val dataKey: ByteArray
    private val headerBytes: ByteArray
    private val chunks = ArrayList<ChunkRef>()

    val header: AudioHeader

    /** True if the file ends with an authenticated-structure end marker. */
    val isComplete: Boolean

    /** Non-null if the chunk structure stops making sense before the end marker. */
    val structuralProblem: String?

    val dataChunkCount: Int get() = chunks.size

    val totalPlaintextBytes: Long

    val durationMillis: Long get() = header.bytesToMillis(totalPlaintextBytes)

    init {
        try {
            val prefix = ByteArray(minOf(raf.length(), MAX_HEADER_BYTES.toLong()).toInt())
            raf.readFully(prefix)
            val (h, hb) = AudioHeader.read(DataInputStream(java.io.ByteArrayInputStream(prefix)))
            header = h
            headerBytes = hb
            dataKey = keyWrapper.unwrap(h.wrappedKey)

            var offset = hb.size.toLong()
            val length = raf.length()
            var complete = false
            var problem: String? = null
            val maxCt = h.chunkSize + ChunkCodec.TAG_BYTES
            while (offset < length) {
                if (length - offset < ChunkCodec.PREFIX_BYTES) {
                    problem = "Trailing partial chunk header"; break
                }
                raf.seek(offset)
                val flag = raf.readUnsignedByte()
                val ctLen = raf.readInt()
                if (flag > ChunkCodec.FLAG_END || ctLen < ChunkCodec.TAG_BYTES || ctLen > maxCt) {
                    problem = "Invalid chunk header at byte $offset"; break
                }
                if (offset + ChunkCodec.PREFIX_BYTES + ctLen > length) {
                    problem = "Chunk at byte $offset is truncated"; break
                }
                if (flag == ChunkCodec.FLAG_END) {
                    complete = offset + ChunkCodec.PREFIX_BYTES + ctLen == length
                    if (!complete) problem = "Data after end marker"
                    break
                }
                chunks += ChunkRef(offset, ctLen, flag)
                offset += ChunkCodec.PREFIX_BYTES + ctLen
            }
            isComplete = complete
            structuralProblem = problem ?: if (!complete) "Missing end marker" else null
            totalPlaintextBytes = chunks.sumOf { (it.ctLen - ChunkCodec.TAG_BYTES).toLong() }
        } catch (e: Throwable) {
            raf.close()
            throw e
        }
    }

    /** Index of the chunk containing plaintext byte [position]. All data chunks but the last are full. */
    fun chunkIndexFor(position: Long): Int =
        (position / header.chunkSize).coerceIn(0L, (chunks.size - 1).coerceAtLeast(0).toLong()).toInt()

    fun readChunk(index: Int): ByteArray {
        val ref = chunks[index]
        val nonce = ByteArray(ChunkCodec.NONCE_BYTES)
        val ct = ByteArray(ref.ctLen)
        synchronized(raf) {
            raf.seek(ref.offset + 5)
            raf.readFully(nonce)
            raf.readFully(ct)
        }
        return ChunkCodec.open(dataKey, headerBytes, index.toLong(), ref.flag, nonce, ct)
    }

    /** Authenticates every chunk including the end marker. */
    fun verify(): VerifyResult {
        for (i in chunks.indices) {
            try {
                readChunk(i)
            } catch (e: CorruptRecordingException) {
                return VerifyResult(false, i, e.message)
            }
        }
        if (!isComplete) return VerifyResult(false, chunks.size, structuralProblem)
        val endOffset = chunks.lastOrNull()?.let { it.offset + ChunkCodec.PREFIX_BYTES + it.ctLen } ?: headerBytes.size.toLong()
        return try {
            val nonce = ByteArray(ChunkCodec.NONCE_BYTES)
            val ct = ByteArray(ChunkCodec.TAG_BYTES)
            synchronized(raf) {
                raf.seek(endOffset + 5)
                raf.readFully(nonce)
                raf.readFully(ct)
            }
            ChunkCodec.open(dataKey, headerBytes, chunks.size.toLong(), ChunkCodec.FLAG_END, nonce, ct)
            VerifyResult(true, null, null)
        } catch (e: CorruptRecordingException) {
            VerifyResult(false, chunks.size, "End marker failed authentication")
        }
    }

    override fun close() {
        dataKey.fill(0)
        raf.close()
    }

    private companion object {
        const val MAX_HEADER_BYTES = 1024
    }
}

data class VerifyResult(val ok: Boolean, val failedChunk: Int?, val reason: String?)

data class RecoveryResult(
    /** True if the file needed repair (missing end marker, partial or corrupt tail). */
    val repaired: Boolean,
    val validChunks: Int,
    val plaintextBytes: Long,
    val durationMillis: Long,
    val fileBytes: Long,
)

/**
 * Repairs recordings that were interrupted (process death, power loss, storage full) or whose
 * tail is damaged: keeps every leading chunk that authenticates, truncates the rest and appends
 * a fresh end marker so the file becomes a normal, complete recording.
 */
object EncryptedAudioRecovery {

    fun recover(file: File, keyWrapper: KeyWrapper, random: SecureRandom = SecureRandom()): RecoveryResult {
        val validChunks: Int
        val plaintext: Long
        val header: AudioHeader
        val alreadyOk: Boolean
        EncryptedAudioReader(file, keyWrapper).use { reader ->
            header = reader.header
            val verify = reader.verify()
            alreadyOk = verify.ok
            validChunks = if (verify.ok) reader.dataChunkCount else (verify.failedChunk ?: 0).coerceAtMost(reader.dataChunkCount)
            var bytes = 0L
            for (i in 0 until validChunks) bytes += reader.readChunk(i).size
            plaintext = bytes
        }
        if (alreadyOk) {
            return RecoveryResult(false, validChunks, plaintext, header.bytesToMillis(plaintext), file.length())
        }

        val headerBytes = header.encode()
        // Every chunk before validChunks is a full chunk except possibly the last one.
        var end = headerBytes.size.toLong()
        RandomAccessFile(file, "rw").use { raf ->
            for (i in 0 until validChunks) {
                raf.seek(end + 1)
                end += ChunkCodec.PREFIX_BYTES + raf.readInt()
            }
            raf.setLength(end)
            val dataKey = keyWrapper.unwrap(header.wrappedKey)
            try {
                val marker = ChunkCodec.seal(dataKey, headerBytes, validChunks.toLong(), ChunkCodec.FLAG_END, ByteArray(0), 0, random)
                raf.seek(end)
                raf.write(marker)
                raf.fd.sync()
            } finally {
                dataKey.fill(0)
            }
        }
        return RecoveryResult(true, validChunks, plaintext, header.bytesToMillis(plaintext), file.length())
    }
}
