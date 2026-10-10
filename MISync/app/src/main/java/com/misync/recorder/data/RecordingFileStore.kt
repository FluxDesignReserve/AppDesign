package com.misync.recorder.data

import java.io.File
import java.util.UUID

/**
 * Owns the directory of encrypted recordings in app-private internal storage
 * (`filesDir/recordings`). Plain JVM so it can be unit tested against a temp directory.
 */
class RecordingFileStore(
    private val root: File,
    private val freeSpace: (File) -> Long = { it.usableSpace },
) {
    init {
        ensureRoot()
    }

    private fun ensureRoot() {
        if (!root.isDirectory && !root.mkdirs()) {
            throw StorageException("Cannot create recordings directory")
        }
    }

    fun newFileName(): String = "rec_${UUID.randomUUID()}$EXTENSION"

    fun fileFor(fileName: String): File {
        require(isValidName(fileName)) { "Illegal recording file name" }
        return File(root, fileName)
    }

    fun exists(fileName: String): Boolean = isValidName(fileName) && fileFor(fileName).isFile

    fun sizeOf(fileName: String): Long = if (exists(fileName)) fileFor(fileName).length() else 0L

    /** Returns true if the file is gone afterwards (deleting a missing file is a success). */
    fun delete(fileName: String): Boolean {
        if (!isValidName(fileName)) return false
        val file = fileFor(fileName)
        return !file.exists() || file.delete()
    }

    fun freeBytes(): Long {
        ensureRoot()
        return freeSpace(root)
    }

    /** Whether there is room to start a recording, keeping [MIN_FREE_BYTES] in reserve. */
    fun canStartRecording(): Boolean = freeBytes() > MIN_FREE_BYTES + START_HEADROOM_BYTES

    /** Whether an in-progress recording should stop to avoid filling the device. */
    fun isCriticallyLow(): Boolean = freeBytes() < MIN_FREE_BYTES

    /** Files present on disk that no database row references (e.g. after a crash between steps). */
    fun orphans(known: Set<String>): List<String> =
        root.listFiles { f -> f.isFile && f.name.endsWith(EXTENSION) }
            ?.map { it.name }
            ?.filter { it !in known }
            .orEmpty()

    private fun isValidName(name: String): Boolean = NAME_PATTERN.matches(name)

    companion object {
        const val EXTENSION = ".msa"
        const val MIN_FREE_BYTES = 50L * 1024 * 1024
        const val START_HEADROOM_BYTES = 50L * 1024 * 1024
        private val NAME_PATTERN = Regex("""rec_[0-9a-fA-F-]{36}\.msa""")
    }
}

class StorageException(message: String, cause: Throwable? = null) : java.io.IOException(message, cause)
