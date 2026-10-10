package com.misync.recorder.data

import com.misync.recorder.crypto.EncryptedAudioReader
import com.misync.recorder.crypto.EncryptedAudioWriter
import com.misync.recorder.crypto.TestKeys
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.time.ZoneOffset

class RecordingRepositoryTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val dao = FakeRecordingDao()
    private val wrapper = TestKeys.newWrapper()
    private var freeBytes = Long.MAX_VALUE
    private val store by lazy { RecordingFileStore(File(tmp.root, "recordings")) { freeBytes } }

    private fun repository() = RecordingRepository(
        dao, store, wrapper,
        io = Dispatchers.Unconfined,
        clock = { 1_700_000_000_000L },
        zone = ZoneOffset.UTC,
    )

    @Test
    fun `start write finish produces a complete encrypted recording`() = runTest {
        val repo = repository()
        val active = repo.startRecording("MIC", 44_100, 1)
        assertEquals(RecordingStatus.RECORDING, dao.get(active.entity.id)!!.status)
        assertEquals("Recording 2023-11-14 22:13", active.entity.title)

        active.writer.write(ByteArray(44_100 * 2) { (it % 251).toByte() }) // 1 second
        val finished = repo.finishRecording(active)

        assertEquals(RecordingStatus.COMPLETE, finished.status)
        assertEquals(1_000L, finished.durationMs)
        assertTrue(finished.sizeBytes > 44_100 * 2)
        repo.openReader(finished).use { assertTrue(it.verify().ok) }
    }

    @Test
    fun `refuses to start when storage is low`() = runTest {
        freeBytes = 60L * 1024 * 1024
        try {
            repository().startRecording("MIC", 44_100, 1)
            fail("Expected StorageException")
        } catch (expected: StorageException) {
        }
        assertTrue(dao.rows.isEmpty())
        assertTrue(store.orphans(emptySet()).isEmpty())
    }

    @Test
    fun `interrupted recording rows are repaired on recovery`() = runTest {
        val repo = repository()
        val active = repo.startRecording("MIC", 44_100, 1)
        active.writer.write(ByteArray(64 * 1024 * 3 + 100))
        active.writer.abandon() // process died mid-recording

        assertEquals(1, repo.recoverInterrupted())
        val row = dao.get(active.entity.id)!!
        assertEquals(RecordingStatus.RECOVERED, row.status)
        assertEquals(64L * 1024 * 3 * 1000 / (44_100 * 2), row.durationMs)
        repo.openReader(row).use { assertTrue(it.verify().ok) }
    }

    @Test
    fun `active recording is left alone by recovery`() = runTest {
        val repo = repository()
        val active = repo.startRecording("MIC", 44_100, 1)
        assertEquals(0, repo.recoverInterrupted(activeId = active.entity.id))
        assertEquals(RecordingStatus.RECORDING, dao.get(active.entity.id)!!.status)
        repo.finishRecording(active)
    }

    @Test
    fun `missing audio file marks the row damaged`() = runTest {
        val repo = repository()
        val active = repo.startRecording("MIC", 44_100, 1)
        active.writer.abandon()
        store.delete(active.entity.fileName)
        repo.recoverInterrupted()
        assertEquals(RecordingStatus.DAMAGED, dao.get(active.entity.id)!!.status)
    }

    @Test
    fun `orphan files are adopted or discarded`() = runTest {
        val repo = repository()
        val good = store.newFileName()
        EncryptedAudioWriter.create(store.fileFor(good), wrapper, 44_100, 1).use { it.write(ByteArray(70_000)) }
        val foreign = store.newFileName()
        EncryptedAudioWriter.create(store.fileFor(foreign), TestKeys.newWrapper(), 44_100, 1).use { it.write(ByteArray(10)) }

        assertEquals(1, repo.recoverInterrupted())
        val adopted = dao.rows.values.single()
        assertEquals(good, adopted.fileName)
        assertFalse(store.exists(foreign))
    }

    @Test
    fun `rename validates and trims`() = runTest {
        val repo = repository()
        val active = repo.startRecording("MIC", 44_100, 1)
        repo.finishRecording(active)
        repo.rename(active.entity.id, "  Team   sync  ")
        assertEquals("Team sync", dao.get(active.entity.id)!!.title)
        for (bad in listOf("", "   ", "x".repeat(81))) {
            try {
                repo.rename(active.entity.id, bad)
                fail("Expected rejection of '$bad'")
            } catch (expected: IllegalArgumentException) {
            }
        }
    }

    @Test
    fun `delete removes metadata and the encrypted file`() = runTest {
        val repo = repository()
        val active = repo.startRecording("MIC", 44_100, 1)
        repo.finishRecording(active)
        assertTrue(store.exists(active.entity.fileName))
        repo.delete(active.entity.id)
        assertNull(dao.get(active.entity.id))
        assertFalse(store.exists(active.entity.fileName))
    }

    @Test
    fun `opening a corrupt file marks it damaged`() = runTest {
        val repo = repository()
        val active = repo.startRecording("MIC", 44_100, 1)
        val finished = repo.finishRecording(active)
        store.fileFor(finished.fileName).writeBytes(ByteArray(8))
        try {
            repo.openReader(finished).close()
            fail("Expected failure")
        } catch (expected: java.io.IOException) {
        }
        assertEquals(RecordingStatus.DAMAGED, dao.get(finished.id)!!.status)
    }
}

private class FakeRecordingDao : RecordingDao {
    val rows = linkedMapOf<Long, RecordingEntity>()
    private var nextId = 1L
    private val flow = MutableStateFlow<List<RecordingEntity>>(emptyList())

    private fun publish() {
        flow.value = rows.values.sortedByDescending { it.createdAt }
    }

    override fun observeAll(): Flow<List<RecordingEntity>> = flow
    override suspend fun get(id: Long) = rows[id]
    override suspend fun withStatus(status: RecordingStatus) = rows.values.filter { it.status == status }
    override suspend fun allFileNames() = rows.values.map { it.fileName }
    override suspend fun insert(entity: RecordingEntity): Long {
        val id = nextId++
        rows[id] = entity.copy(id = id)
        publish()
        return id
    }
    override suspend fun update(entity: RecordingEntity) {
        rows[entity.id] = entity
        publish()
    }
    override suspend fun rename(id: Long, title: String) {
        rows[id]?.let { rows[id] = it.copy(title = title) }
        publish()
    }
    override suspend fun delete(id: Long) {
        rows.remove(id)
        publish()
    }
}
