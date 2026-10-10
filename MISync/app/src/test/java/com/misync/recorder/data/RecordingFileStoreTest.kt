package com.misync.recorder.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class RecordingFileStoreTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun store(free: Long = Long.MAX_VALUE, root: File = File(tmp.root, "recordings")) =
        RecordingFileStore(root) { free }

    @Test
    fun `creates its directory`() {
        val root = File(tmp.root, "nested/recordings")
        store(root = root)
        assertTrue(root.isDirectory)
    }

    @Test
    fun `file names are unique and valid`() {
        val s = store()
        val a = s.newFileName()
        val b = s.newFileName()
        assertNotEquals(a, b)
        assertTrue(a.endsWith(RecordingFileStore.EXTENSION))
        s.fileFor(a) // does not throw
    }

    @Test(expected = IllegalArgumentException::class)
    fun `path traversal names are rejected`() {
        store().fileFor("../../databases/misync.db")
    }

    @Test
    fun `invalid names are never deleted`() {
        val victim = tmp.newFile("victim.txt")
        assertFalse(store().delete("../victim.txt"))
        assertTrue(victim.exists())
    }

    @Test
    fun `delete removes files and treats missing files as deleted`() {
        val s = store()
        val name = s.newFileName()
        s.fileFor(name).writeBytes(ByteArray(10))
        assertTrue(s.exists(name))
        assertEquals(10L, s.sizeOf(name))
        assertTrue(s.delete(name))
        assertFalse(s.exists(name))
        assertTrue(s.delete(name))
        assertEquals(0L, s.sizeOf(name))
    }

    @Test
    fun `orphans are files without metadata`() {
        val s = store()
        val known = s.newFileName().also { s.fileFor(it).writeBytes(ByteArray(1)) }
        val orphan = s.newFileName().also { s.fileFor(it).writeBytes(ByteArray(1)) }
        File(tmp.root, "recordings/notes.txt").writeText("ignored")
        assertEquals(listOf(orphan), s.orphans(setOf(known)))
    }

    @Test
    fun `free space thresholds`() {
        val mb = 1024L * 1024
        assertTrue(store(free = 500 * mb).canStartRecording())
        assertFalse(store(free = 80 * mb).canStartRecording())
        assertFalse(store(free = 80 * mb).isCriticallyLow())
        assertTrue(store(free = 10 * mb).isCriticallyLow())
    }
}
