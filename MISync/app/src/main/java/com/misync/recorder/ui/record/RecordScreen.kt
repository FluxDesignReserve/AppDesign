package com.misync.recorder.ui.record

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.MicOff
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.misync.recorder.audio.CaptureSource
import com.misync.recorder.service.RecorderPhase
import com.misync.recorder.ui.components.StatusChip
import com.misync.recorder.ui.components.formatBytes
import com.misync.recorder.ui.components.formatDuration
import com.misync.recorder.ui.theme.MISyncColors

@Composable
fun RecordScreen(vm: RecordViewModel = viewModel(factory = RecordViewModel.Factory)) {
    val ui by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val recorder = ui.recorder

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[Manifest.permission.RECORD_AUDIO] == true) vm.start() else vm.reportPermissionDenied()
    }

    fun startWithPermissions() {
        val needed = buildList {
            add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }.filter { ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED }
        if (needed.isEmpty()) vm.start() else permissionLauncher.launch(needed.toTypedArray())
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("MISync", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            StatusChip("Offline", MISyncColors.Secure, Icons.Outlined.CloudOff)
            StatusChip("AES-256", MISyncColors.Secure, Icons.Filled.Lock)
            StatusChip("On device", MISyncColors.Secure, Icons.Outlined.PhoneAndroid)
        }

        Spacer(Modifier.weight(1f))

        PhaseLabel(recorder.phase, recorder.silenced)
        Spacer(Modifier.height(8.dp))
        Text(
            formatDuration(recorder.elapsedMs),
            style = MaterialTheme.typography.displayLarge.copy(fontFeatureSettings = "tnum"),
            color = MISyncColors.TextPrimary,
        )
        Spacer(Modifier.height(20.dp))
        LevelMeter(level = recorder.level, active = recorder.phase == RecorderPhase.RECORDING && !recorder.silenced)

        if (recorder.silenced && recorder.phase == RecorderPhase.RECORDING) {
            Spacer(Modifier.height(20.dp))
            SilencedNotice()
        }

        Spacer(Modifier.weight(1f))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(28.dp)) {
            val paused = recorder.phase == RecorderPhase.PAUSED
            val canPause = recorder.phase == RecorderPhase.RECORDING || paused
            OutlinedIconButton(
                onClick = { if (paused) vm.resume() else vm.pause() },
                enabled = canPause,
                modifier = Modifier.size(56.dp),
                border = BorderStroke(1.dp, if (canPause) MISyncColors.Outline else Color.Transparent),
            ) {
                Icon(if (paused) Icons.Filled.PlayArrow else Icons.Filled.Pause, contentDescription = if (paused) "Resume" else "Pause")
            }
            RecordButton(
                phase = recorder.phase,
                onClick = {
                    when (recorder.phase) {
                        RecorderPhase.IDLE -> startWithPermissions()
                        RecorderPhase.RECORDING, RecorderPhase.PAUSED -> vm.stop()
                        else -> Unit
                    }
                },
            )
            Spacer(Modifier.size(56.dp))
        }

        Spacer(Modifier.height(28.dp))
        SourcePicker(
            selected = if (recorder.isActive) recorder.source else ui.selectedSource,
            enabled = !recorder.isActive,
            onSelect = vm::selectSource,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "${formatBytes(vm.freeBytes())} free · encrypted with a per-recording key",
            style = MaterialTheme.typography.labelMedium,
            color = MISyncColors.TextSecondary,
        )

        recorder.message?.let { message ->
            Spacer(Modifier.height(12.dp))
            Surface(color = MISyncColors.SurfaceRaised, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(message, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f).padding(vertical = 12.dp))
                    TextButton(onClick = vm::dismissMessage) { Text("OK") }
                }
            }
        }
    }
}

@Composable
private fun PhaseLabel(phase: RecorderPhase, silenced: Boolean) {
    val (text, color) = when {
        phase == RecorderPhase.RECORDING && silenced -> "Silenced by system" to MISyncColors.Warning
        phase == RecorderPhase.RECORDING -> "Recording" to MISyncColors.Recording
        phase == RecorderPhase.PAUSED -> "Paused" to MISyncColors.Paused
        phase == RecorderPhase.STARTING -> "Starting…" to MISyncColors.TextSecondary
        phase == RecorderPhase.STOPPING -> "Saving…" to MISyncColors.TextSecondary
        else -> "Ready" to MISyncColors.TextSecondary
    }
    val pulse = rememberInfiniteTransition(label = "pulse")
    val alpha by pulse.animateFloat(1f, 0.25f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "alpha")
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = if (phase == RecorderPhase.RECORDING) alpha else 1f)),
        )
        Spacer(Modifier.width(8.dp))
        Text(text.uppercase(), style = MaterialTheme.typography.labelMedium, color = color)
    }
}

@Composable
private fun LevelMeter(level: Float, active: Boolean) {
    val animated by animateFloatAsState(if (active) level else 0f, tween(90), label = "level")
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.height(40.dp)) {
        val bars = 24
        for (i in 0 until bars) {
            val threshold = (i + 1f) / bars
            val center = 1f - kotlin.math.abs(i - (bars - 1) / 2f) / (bars / 2f)
            val lit = animated * 1.6f >= threshold * 0.9f
            Box(
                Modifier
                    .width(4.dp)
                    .height((8 + 32 * center * (0.25f + animated.coerceAtMost(1f) * 0.75f)).dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(if (lit && active) MISyncColors.Accent else MISyncColors.Outline),
            )
        }
    }
}

@Composable
private fun SilencedNotice() {
    Surface(
        color = MISyncColors.Warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, MISyncColors.Warning.copy(alpha = 0.3f)),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.MicOff, contentDescription = null, tint = MISyncColors.Warning)
            Spacer(Modifier.width(10.dp))
            Text(
                "Android is sending silence to MISync — usually because a call or another app is using the microphone. Recording continues and resumes capturing when the input is released.",
                style = MaterialTheme.typography.bodyMedium,
                color = MISyncColors.TextPrimary,
            )
        }
    }
}

@Composable
private fun RecordButton(phase: RecorderPhase, onClick: () -> Unit) {
    val recording = phase == RecorderPhase.RECORDING || phase == RecorderPhase.PAUSED
    val busy = phase == RecorderPhase.STARTING || phase == RecorderPhase.STOPPING
    val ring by animateColorAsState(if (recording) MISyncColors.Recording else MISyncColors.Outline, label = "ring")
    val innerScale by animateFloatAsState(if (recording) 0.45f else 1f, label = "inner")
    val corner by animateFloatAsState(if (recording) 8f else 50f, label = "corner")
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(88.dp)
            .border(2.dp, ring, CircleShape)
            .padding(8.dp)
            .clip(CircleShape)
            .clickable(enabled = !busy, onClick = onClick)
            .semantics { contentDescription = if (recording) "Stop recording" else "Start recording" },
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .scale(innerScale)
                .clip(RoundedCornerShape(corner.toInt()))
                .background(if (busy) MISyncColors.Recording.copy(alpha = 0.4f) else MISyncColors.Recording),
        )
    }
}

@Composable
private fun SourcePicker(selected: CaptureSource, enabled: Boolean, onSelect: (CaptureSource) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .clickable(enabled = enabled) { expanded = true }
                .padding(horizontal = 14.dp, vertical = 8.dp),
        ) {
            Text("Input: ${selected.label}", style = MaterialTheme.typography.titleMedium, color = if (enabled) MISyncColors.TextPrimary else MISyncColors.TextSecondary)
            if (enabled) Icon(Icons.Filled.ExpandMore, contentDescription = "Choose input", tint = MISyncColors.TextSecondary)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            CaptureSource.selectable.forEach { source ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(source.label, style = MaterialTheme.typography.titleMedium)
                            Text(source.description, style = MaterialTheme.typography.labelMedium, color = MISyncColors.TextSecondary)
                        }
                    },
                    onClick = {
                        onSelect(source)
                        expanded = false
                    },
                )
            }
        }
    }
}
