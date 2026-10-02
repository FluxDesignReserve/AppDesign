package io.github.polarsync

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.time.LocalDateTime

class FormatTest {

    @Test
    fun recordingFileName_isSortableAndM4a() {
        val name = Format.recordingFileName(LocalDateTime.of(2026, 10, 2, 14, 30, 5))
        assertEquals("memo_20261002_143005.m4a", name)
    }

    @Test
    fun duration_formatsMinutesAndHours() {
        assertEquals("0:00", Format.duration(0))
        assertEquals("0:07", Format.duration(7_999))
        assertEquals("12:34", Format.duration((12 * 60 + 34) * 1000L))
        assertEquals("1:02:03", Format.duration((3600 + 2 * 60 + 3) * 1000L))
        assertEquals("0:00", Format.duration(-5_000))
    }

    @Test
    fun size_picksUnit() {
        assertEquals("512 B", Format.size(512))
        assertEquals("48 KB", Format.size(48 * 1024L))
        assertEquals("3.5 MB", Format.size((3.5 * 1024 * 1024).toLong()))
    }
}

class RecordingStateTest {

    private val file = File("memo.m4a")

    @Test
    fun recording_elapsedIncludesAccumulatedAndCurrentSegment() {
        val state = RecordingState.Recording(file, accumulatedMs = 5_000, segmentStartRealtime = 100_000)
        assertEquals(8_000, state.elapsedMs(nowRealtime = 103_000))
    }

    @Test
    fun recording_elapsedNeverGoesBelowAccumulated() {
        val state = RecordingState.Recording(file, accumulatedMs = 5_000, segmentStartRealtime = 100_000)
        assertEquals(5_000, state.elapsedMs(nowRealtime = 99_000))
    }

    @Test
    fun paused_elapsedIsFrozen() {
        val state = RecordingState.Paused(file, accumulatedMs = 42_000)
        assertEquals(42_000, state.elapsedMs(nowRealtime = 1))
        assertEquals(42_000, state.elapsedMs(nowRealtime = 10_000_000))
    }
}
