package io.github.polarsync

import android.os.SystemClock
import java.io.File

/** The recorder's state, published by [RecordingManager.state]. */
sealed interface RecordingState {

    data object Idle : RecordingState

    /** A session that owns an open output file, whether it is capturing or paused. */
    sealed interface Active : RecordingState {
        val file: File

        /** Captured audio so far, excluding time spent paused. */
        fun elapsedMs(nowRealtime: Long = SystemClock.elapsedRealtime()): Long
    }

    /**
     * Capturing audio. [segmentStartRealtime] is the [SystemClock.elapsedRealtime] value at
     * which the current (unpaused) segment began; [accumulatedMs] is everything before it.
     */
    data class Recording(
        override val file: File,
        val accumulatedMs: Long,
        val segmentStartRealtime: Long,
    ) : Active {
        override fun elapsedMs(nowRealtime: Long): Long =
            accumulatedMs + (nowRealtime - segmentStartRealtime).coerceAtLeast(0)
    }

    data class Paused(
        override val file: File,
        val accumulatedMs: Long,
    ) : Active {
        override fun elapsedMs(nowRealtime: Long): Long = accumulatedMs
    }
}

/** One-shot outcomes the UI should surface (a toast, a snackbar, a list refresh). */
sealed interface RecordingEvent {
    data class Saved(val file: File) : RecordingEvent
    data class Failed(val message: String, val cause: Throwable? = null) : RecordingEvent
}

/** A finished recording on disk. */
data class VoiceMemo(
    val file: File,
    val sizeBytes: Long,
    val lastModified: Long,
    val durationMs: Long?,
) {
    val name: String get() = file.nameWithoutExtension
}

class RecordingException(message: String, cause: Throwable? = null) : Exception(message, cause)
