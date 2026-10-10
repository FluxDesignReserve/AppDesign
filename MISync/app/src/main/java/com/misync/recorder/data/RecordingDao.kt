package com.misync.recorder.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface RecordingDao {
    @Query("SELECT * FROM recordings ORDER BY created_at DESC")
    fun observeAll(): Flow<List<RecordingEntity>>

    @Query("SELECT * FROM recordings WHERE id = :id")
    suspend fun get(id: Long): RecordingEntity?

    @Query("SELECT * FROM recordings WHERE status = :status")
    suspend fun withStatus(status: RecordingStatus): List<RecordingEntity>

    @Query("SELECT file_name FROM recordings")
    suspend fun allFileNames(): List<String>

    @Insert
    suspend fun insert(entity: RecordingEntity): Long

    @Update
    suspend fun update(entity: RecordingEntity)

    @Query("UPDATE recordings SET title = :title WHERE id = :id")
    suspend fun rename(id: Long, title: String)

    @Query("DELETE FROM recordings WHERE id = :id")
    suspend fun delete(id: Long)
}
