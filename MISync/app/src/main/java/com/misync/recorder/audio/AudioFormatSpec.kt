package com.misync.recorder.audio

import android.media.AudioFormat

/** MISync records 16-bit mono PCM at 44.1 kHz, the only rate every Android device must support. */
object AudioFormatSpec {
    const val SAMPLE_RATE = 44_100
    const val CHANNELS = 1
    const val CHANNEL_IN = AudioFormat.CHANNEL_IN_MONO
    const val CHANNEL_OUT = AudioFormat.CHANNEL_OUT_MONO
    const val ENCODING = AudioFormat.ENCODING_PCM_16BIT
}

/** Peak level of 16-bit little-endian PCM, 0..1. */
fun peakLevel(buffer: ByteArray, length: Int): Float {
    var peak = 0
    var i = 0
    while (i + 1 < length) {
        val sample = (buffer[i].toInt() and 0xFF) or (buffer[i + 1].toInt() shl 8)
        val abs = if (sample < 0) -sample else sample
        if (abs > peak) peak = abs
        i += 2
    }
    return (peak / 32768f).coerceIn(0f, 1f)
}

/** RMS of 16-bit little-endian PCM in dBFS (−∞ for digital silence). */
fun rmsDbfs(buffer: ByteArray, length: Int): Double {
    var sum = 0.0
    var count = 0
    var i = 0
    while (i + 1 < length) {
        val sample = ((buffer[i].toInt() and 0xFF) or (buffer[i + 1].toInt() shl 8)).toShort().toDouble()
        sum += sample * sample
        count++
        i += 2
    }
    if (count == 0 || sum == 0.0) return Double.NEGATIVE_INFINITY
    return 20 * kotlin.math.log10(kotlin.math.sqrt(sum / count) / 32768.0)
}
