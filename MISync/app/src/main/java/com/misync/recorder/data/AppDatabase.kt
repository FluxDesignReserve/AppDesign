package com.misync.recorder.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters

class Converters {
    @TypeConverter
    fun statusToString(status: RecordingStatus): String = status.name

    @TypeConverter
    fun stringToStatus(value: String): RecordingStatus =
        RecordingStatus.entries.firstOrNull { it.name == value } ?: RecordingStatus.DAMAGED
}

@Database(entities = [RecordingEntity::class], version = 1, exportSchema = true)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun recordingDao(): RecordingDao

    companion object {
        fun create(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "misync.db").build()
    }
}
