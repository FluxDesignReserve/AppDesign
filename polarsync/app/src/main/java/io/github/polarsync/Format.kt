package io.github.polarsync

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

internal object Format {

    private val fileStamp = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss", Locale.US)

    /** `memo_20261002_143005.m4a` — sortable, filesystem-safe, locale-independent. */
    fun recordingFileName(time: LocalDateTime): String = "memo_${fileStamp.format(time)}.m4a"

    /** `0:07`, `12:34`, `1:02:03`. */
    fun duration(ms: Long): String {
        val totalSeconds = ms.coerceAtLeast(0) / 1000
        val hours = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        val seconds = totalSeconds % 60
        return if (hours > 0) {
            String.format(Locale.US, "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            String.format(Locale.US, "%d:%02d", minutes, seconds)
        }
    }

    /** `512 B`, `48 KB`, `3.2 MB`. */
    fun size(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
    }
}
