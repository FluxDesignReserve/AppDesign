package com.misync.recorder.data

import com.misync.recorder.crypto.CorruptRecordingException
import com.misync.recorder.crypto.EncryptedAudioReader
import com.misync.recorder.crypto.EncryptedAudioRecovery
import com.misync.recorder.crypto.EncryptedAudioWriter
import com.misync.recorder.crypto.KeyWrapper
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.IOException
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Single source of truth for recordings: metadata lives in Room, audio lives in encrypted
 * `.msa` files managed by [RecordingFileStore].
 */
class RecordingRepository(
    private val dao: RecordingDao,
    private val store: RecordingFileStore,
    private val keyWrapper: KeyWrapper,
    private val io: CoroutineDispatcher = Dispatchers.IO,
    private val clock: () -> Long = System::currentTimeMillis,
    private val zone: ZoneId = ZoneId.systemDefault(),
) {
    /** Serialises recording creation against crash recovery so a new file is never mistaken for an orphan. */
    private val lifecycleLock = Mutex()

    fun observeAll(): Flow<List<RecordingEntity>> = dao.observeAll()

    suspend fun get(id: Long): RecordingEntity? = dao.get(id)

    class ActiveRecording(val entity: RecordingEntity, val writer: EncryptedAudioWriter)

    /** Creates the encrypted file and its metadata row. Throws [StorageException] when space is low. */
    suspend fun startRecording(audioSource: String, sampleRate: Int, channels: Int, titlePrefix: String = "Recording"): ActiveRecording =
        withContext(io) {
            lifecycleLock.withLock { createRecording(audioSource, sampleRate, channels, titlePrefix) }
        }

    private suspend fun createRecording(audioSource: String, sampleRate: Int, channels: Int, titlePrefix: String): ActiveRecording {
        if (!store.canStartRecording()) throw StorageException("Not enough free storage to start recording")
        val now = clock()
        val fileName = store.newFileName()
        val writer = try {
            EncryptedAudioWriter.create(store.fileFor(fileName), keyWrapper, sampleRate, channels, createdAtMillis = now)
        } catch (e: IOException) {
            store.delete(fileName)
            throw StorageException("Cannot create recording file", e)
        }
        val entity = RecordingEntity(
            title = defaultTitle(titlePrefix, now),
            fileName = fileName,
            createdAt = now,
            sampleRate = sampleRate,
            channels = channels,
            audioSource = audioSource,
        )
        val id = try {
            dao.insert(entity)
        } catch (e: Exception) {
            writer.abandon()
            store.delete(fileName)
            throw e
        }
        return ActiveRecording(entity.copy(id = id), writer)
    }

    /**
     * Closes the writer and stores final metadata. If closing fails (e.g. storage full), the file
     * is repaired with [EncryptedAudioRecovery] so the audio captured so far is kept.
     */
    suspend fun finishRecording(active: ActiveRecording, note: String? = null): RecordingEntity = withContext(io) {
        val closeError = runCatching { active.writer.close() }.exceptionOrNull()
        if (closeError != null) active.writer.abandon()
        val finished = if (closeError == null) {
            active.entity.copy(
                durationMs = durationOf(active.writer.plaintextBytes, active.entity),
                sizeBytes = store.sizeOf(active.entity.fileName),
                status = RecordingStatus.COMPLETE,
                note = note,
            )
        } else {
            repairedEntity(active.entity, note ?: "Stopped: ${closeError.message ?: "write error"}")
        }
        dao.update(finished)
        finished
    }

    /**
     * Repairs rows left in [RecordingStatus.RECORDING] by a crash (except [activeId], which is
     * genuinely recording) and adopts orphan files. Returns the number of recordings touched.
     */
    suspend fun recoverInterrupted(activeId: Long? = null): Int = withContext(io) {
        lifecycleLock.withLock { recoverLocked(activeId) }
    }

    private suspend fun recoverLocked(activeId: Long?): Int {
        var touched = 0
        for (entity in dao.withStatus(RecordingStatus.RECORDING)) {
            if (entity.id == activeId) continue
            dao.update(repairedEntity(entity, "Recovered after interruption"))
            touched++
        }
        val known = dao.allFileNames().toSet()
        for (orphan in store.orphans(known)) {
            val file = store.fileFor(orphan)
            val result = try {
                EncryptedAudioRecovery.recover(file, keyWrapper)
            } catch (e: CorruptRecordingException) {
                // Not a valid recording for this device's key: nothing can ever read it.
                store.delete(orphan)
                continue
            }
            val header = EncryptedAudioReader(file, keyWrapper).use { it.header }
            dao.insert(
                RecordingEntity(
                    title = defaultTitle("Recovered", header.createdAtMillis),
                    fileName = orphan,
                    createdAt = header.createdAtMillis,
                    durationMs = result.durationMillis,
                    sizeBytes = result.fileBytes,
                    sampleRate = header.sampleRate,
                    channels = header.channels,
                    audioSource = "unknown",
                    status = RecordingStatus.RECOVERED,
                    note = "Recovered after interruption",
                ),
            )
            touched++
        }
        return touched
    }

    private fun repairedEntity(entity: RecordingEntity, note: String): RecordingEntity {
        if (!store.exists(entity.fileName)) {
            return entity.copy(status = RecordingStatus.DAMAGED, note = "Audio file is missing", sizeBytes = 0)
        }
        return try {
            val result = EncryptedAudioRecovery.recover(store.fileFor(entity.fileName), keyWrapper)
            entity.copy(
                durationMs = result.durationMillis,
                sizeBytes = result.fileBytes,
                status = if (result.repaired) RecordingStatus.RECOVERED else RecordingStatus.COMPLETE,
                note = if (result.repaired) note else entity.note,
            )
        } catch (e: IOException) {
            entity.copy(status = RecordingStatus.DAMAGED, note = e.message ?: "Unreadable", sizeBytes = store.sizeOf(entity.fileName))
        }
    }

    suspend fun rename(id: Long, rawTitle: String) = withContext(io) {
        dao.rename(id, validateTitle(rawTitle))
    }

    suspend fun delete(id: Long) = withContext(io) {
        val entity = dao.get(id) ?: return@withContext
        if (!store.delete(entity.fileName)) throw StorageException("Could not delete audio file")
        dao.delete(id)
    }

    /** Opens a decrypting reader. Marks the row [RecordingStatus.DAMAGED] if the file can't be opened. */
    suspend fun openReader(entity: RecordingEntity): EncryptedAudioReader = withContext(io) {
        try {
            if (!store.exists(entity.fileName)) throw CorruptRecordingException("Audio file is missing")
            EncryptedAudioReader(store.fileFor(entity.fileName), keyWrapper)
        } catch (e: IOException) {
            dao.update(entity.copy(status = RecordingStatus.DAMAGED, note = e.message))
            throw e
        }
    }

    suspend fun markDamaged(entity: RecordingEntity, reason: String) = withContext(io) {
        dao.update(entity.copy(status = RecordingStatus.DAMAGED, note = reason))
    }

    private fun durationOf(bytes: Long, entity: RecordingEntity): Long {
        val bytesPerSecond = entity.sampleRate.toLong() * entity.channels * 2
        return if (bytesPerSecond == 0L) 0 else bytes * 1000 / bytesPerSecond
    }

    private fun defaultTitle(prefix: String, millis: Long): String =
        "$prefix ${TITLE_FORMAT.format(Instant.ofEpochMilli(millis).atZone(zone))}"

    companion object {
        const val MAX_TITLE_LENGTH = 80
        private val TITLE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")

        fun validateTitle(raw: String): String {
            val title = raw.replace(Regex("""\s+"""), " ").trim()
            require(title.isNotEmpty()) { "Name cannot be empty" }
            require(title.length <= MAX_TITLE_LENGTH) { "Name must be at most $MAX_TITLE_LENGTH characters" }
            return title
        }
    }
}
