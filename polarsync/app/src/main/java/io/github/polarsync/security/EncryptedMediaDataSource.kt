package io.github.polarsync.security

import android.media.MediaDataSource

/** Feeds a decrypted view of a `.psm` file to MediaPlayer / MediaMetadataRetriever, in memory only. */
class EncryptedMediaDataSource(private val reader: EncryptedMemoFormat.Reader) : MediaDataSource() {

    @Synchronized
    override fun readAt(position: Long, buffer: ByteArray, offset: Int, size: Int): Int =
        reader.readAt(position, buffer, offset, size)

    override fun getSize(): Long = reader.plaintextLength

    @Synchronized
    override fun close() = reader.close()
}
