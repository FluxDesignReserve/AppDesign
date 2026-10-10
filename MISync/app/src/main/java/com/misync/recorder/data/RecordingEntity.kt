package com.misync.recorder.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

enum class RecordingStatus {
    /** Being written right now (or the app died while writing; recovered on next start). */
    RECORDING,
    COMPLETE,
    /** Was interrupted and repaired up to the last intact chunk. */
    RECOVERED,
    /** Cannot be decrypted (missing file, foreign key, corrupt header). */
    DAMAGED,
}

@Entity(tableName = "recordings")
data class RecordingEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    @ColumnInfo(name = "file_name") val fileName: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "duration_ms") val durationMs: Long = 0,
    @ColumnInfo(name = "size_bytes") val sizeBytes: Long = 0,
    @ColumnInfo(name = "sample_rate") val sampleRate: Int,
    val channels: Int,
    @ColumnInfo(name = "audio_source") val audioSource: String,
    val status: RecordingStatus = RecordingStatus.RECORDING,
    /** Human-readable note about how the recording ended, e.g. "Stopped: storage almost full". */
    val note: String? = null,
)
