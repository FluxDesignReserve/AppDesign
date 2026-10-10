package com.misync.recorder.ui.library

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.misync.recorder.audio.EncryptedPlayer
import com.misync.recorder.data.RecordingEntity
import com.misync.recorder.data.RecordingStatus
import com.misync.recorder.ui.components.StatusChip
import com.misync.recorder.ui.components.formatBytes
import com.misync.recorder.ui.components.formatDuration
import com.misync.recorder.ui.theme.MISyncColors
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM yyyy · HH:mm")

@Composable
fun LibraryScreen(vm: LibraryViewModel = viewModel(factory = LibraryViewModel.Factory)) {
    val recordings by vm.recordings.collectAsStateWithLifecycle()
    val playback by vm.playback.collectAsStateWithLifecycle()
    val activeId by vm.activeRecordingId.collectAsStateWithLifecycle()
    val message by vm.message.collectAsStateWithLifecycle()

    var renaming by remember { mutableStateOf<RecordingEntity?>(null) }
    var deleting by remember { mutableStateOf<RecordingEntity?>(null) }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(horizontal = 24.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Library", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
            StatusChip("Encrypted", MISyncColors.Secure, Icons.Outlined.Lock)
        }
        message?.let {
            Surface(
                color = MISyncColors.SurfaceRaised,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
            ) {
                Row(Modifier.padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f).padding(vertical = 12.dp))
                    TextButton(onClick = vm::dismissMessage) { Text("OK") }
                }
            }
            Spacer(Modifier.height(8.dp))
        }
        if (recordings.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No recordings yet", color = MISyncColors.TextSecondary)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(recordings, key = { it.id }) { entity ->
                    RecordingCard(
                        entity = entity,
                        isBeingRecorded = entity.id == activeId,
                        playback = playback.takeIf { it.recordingId == entity.id },
                        onTogglePlay = { vm.togglePlay(entity) },
                        onSeek = vm::seekTo,
                        onRename = { renaming = entity },
                        onDelete = { deleting = entity },
                    )
                }
            }
        }
    }

    renaming?.let { entity ->
        RenameDialog(
            initial = entity.title,
            onDismiss = { renaming = null },
            onConfirm = { title -> vm.rename(entity, title).also { if (it == null) renaming = null } },
        )
    }
    deleting?.let { entity ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete recording?") },
            text = { Text("“${entity.title}” and its encryption key will be permanently erased from this device. This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = { vm.delete(entity); deleting = null }) { Text("Delete", color = MISyncColors.Error) }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun RecordingCard(
    entity: RecordingEntity,
    isBeingRecorded: Boolean,
    playback: EncryptedPlayer.State?,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    val playable = !isBeingRecorded && entity.status != RecordingStatus.DAMAGED && entity.status != RecordingStatus.RECORDING
    Surface(
        color = MISyncColors.Surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, if (playback != null) MISyncColors.Accent.copy(alpha = 0.4f) else MISyncColors.Outline),
    ) {
        Column(Modifier.padding(start = 16.dp, end = 4.dp, top = 12.dp, bottom = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                FilledTonalIconButton(onClick = onTogglePlay, enabled = playable) {
                    Icon(
                        if (playback?.playing == true) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (playback?.playing == true) "Pause" else "Play",
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(entity.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        "${DATE_FORMAT.format(Instant.ofEpochMilli(entity.createdAt).atZone(ZoneId.systemDefault()))} · " +
                            "${formatDuration(entity.durationMs)} · ${formatBytes(entity.sizeBytes)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MISyncColors.TextSecondary,
                    )
                }
                Box {
                    IconButton(onClick = { menu = true }, enabled = !isBeingRecorded) {
                        Icon(Icons.Filled.MoreVert, contentDescription = "More")
                    }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(text = { Text("Rename") }, onClick = { menu = false; onRename() })
                        DropdownMenuItem(text = { Text("Delete", color = MISyncColors.Error) }, onClick = { menu = false; onDelete() })
                    }
                }
            }
            val badge = when {
                isBeingRecorded -> "Recording now" to MISyncColors.Recording
                entity.status == RecordingStatus.RECOVERED -> "Recovered" to MISyncColors.Warning
                entity.status == RecordingStatus.DAMAGED -> "Damaged" to MISyncColors.Error
                else -> null
            }
            if (badge != null || entity.note != null) {
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    badge?.let { StatusChip(it.first, it.second) }
                    entity.note?.let {
                        Spacer(Modifier.width(8.dp))
                        Text(it, style = MaterialTheme.typography.labelMedium, color = MISyncColors.TextSecondary, maxLines = 2)
                    }
                }
            }
            AnimatedVisibility(visible = playback != null) {
                playback?.let { state -> PlaybackBar(state, onSeek) }
            }
            playback?.error?.let {
                Text(it, color = MISyncColors.Error, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}

@Composable
private fun PlaybackBar(state: EncryptedPlayer.State, onSeek: (Long) -> Unit) {
    var dragging by remember { mutableStateOf(false) }
    var dragValue by remember { mutableFloatStateOf(0f) }
    val duration = state.durationMs.coerceAtLeast(1)
    Column(Modifier.padding(end = 12.dp, top = 6.dp)) {
        Slider(
            value = if (dragging) dragValue else state.positionMs.toFloat() / duration,
            onValueChange = { dragging = true; dragValue = it },
            onValueChangeFinished = { onSeek((dragValue * duration).toLong()); dragging = false },
            colors = SliderDefaults.colors(thumbColor = MISyncColors.Accent, activeTrackColor = MISyncColors.Accent),
        )
        Row {
            Text(formatDuration(state.positionMs), style = MaterialTheme.typography.labelSmall, color = MISyncColors.TextSecondary, modifier = Modifier.weight(1f))
            Text(formatDuration(state.durationMs), style = MaterialTheme.typography.labelSmall, color = MISyncColors.TextSecondary)
        }
    }
}

@Composable
private fun RenameDialog(initial: String, onDismiss: () -> Unit, onConfirm: (String) -> String?) {
    var text by remember { mutableStateOf(initial) }
    var error by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rename") },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.take(80); error = null },
                singleLine = true,
                isError = error != null,
                supportingText = { error?.let { Text(it) } },
            )
        },
        confirmButton = { TextButton(onClick = { error = onConfirm(text) }) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
