package io.github.polarsync.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.polarsync.Format
import io.github.polarsync.MainViewModel
import io.github.polarsync.R
import io.github.polarsync.RecordingState
import io.github.polarsync.UiMessage
import io.github.polarsync.VoiceMemo
import kotlinx.coroutines.delay
import java.io.File
import java.text.DateFormat
import java.util.Date

@Composable
fun RecorderScreen(
    viewModel: MainViewModel,
    onRecord: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onStop: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val state by viewModel.recordingState.collectAsStateWithLifecycle()
    val memos by viewModel.memos.collectAsStateWithLifecycle()
    val playing by viewModel.playingFile.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val resources = LocalContext.current.resources
    val settingsLabel = stringResource(R.string.action_settings)
    LaunchedEffect(Unit) {
        viewModel.messages.collect { message ->
            val text = when (message) {
                is UiMessage.Res -> resources.getString(message.id, *message.args.toTypedArray())
                is UiMessage.Text -> message.text
            }
            val offerSettings = message is UiMessage.Res && message.id == R.string.msg_mic_permission_blocked
            val result = snackbarHostState.showSnackbar(
                message = text,
                actionLabel = if (offerSettings) settingsLabel else null,
            )
            if (result == SnackbarResult.ActionPerformed) onOpenSettings()
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            RecorderPanel(state, onRecord, onPause, onResume, onStop)
            HorizontalDivider()
            Text(
                stringResource(R.string.memos_header),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
            if (memos.isEmpty()) {
                Text(
                    stringResource(R.string.memos_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            } else {
                MemoList(
                    memos = memos,
                    playing = playing,
                    onTogglePlay = viewModel::togglePlayback,
                    onDelete = viewModel::delete,
                )
            }
        }
    }
}

@Composable
private fun RecorderPanel(
    state: RecordingState,
    onRecord: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onStop: () -> Unit,
) {
    // Re-reads the elapsed time several times a second while capturing.
    val elapsedMs by produceState(initialValue = 0L, state) {
        while (true) {
            value = (state as? RecordingState.Active)?.elapsedMs() ?: 0L
            if (state !is RecordingState.Recording) break
            delay(200)
        }
    }

    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = when (state) {
                RecordingState.Idle -> stringResource(R.string.status_idle)
                is RecordingState.Recording -> stringResource(R.string.status_recording)
                is RecordingState.Paused -> stringResource(R.string.status_paused)
            },
            style = MaterialTheme.typography.labelLarge,
            color = if (state is RecordingState.Recording) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            Format.duration(elapsedMs),
            style = MaterialTheme.typography.displayMedium,
            fontFamily = FontFamily.Monospace,
        )
        Spacer(Modifier.height(24.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            when (state) {
                RecordingState.Idle -> Button(
                    onClick = onRecord,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                ) {
                    ButtonContent(R.drawable.ic_mic, R.string.action_record)
                }
                is RecordingState.Active -> {
                    if (state is RecordingState.Recording) {
                        FilledTonalButton(onClick = onPause) { ButtonContent(R.drawable.ic_pause, R.string.action_pause) }
                    } else {
                        FilledTonalButton(onClick = onResume) { ButtonContent(R.drawable.ic_mic, R.string.action_resume) }
                    }
                    Button(onClick = onStop) { ButtonContent(R.drawable.ic_stop, R.string.action_stop) }
                }
            }
        }
    }
}

@Composable
private fun ButtonContent(icon: Int, label: Int) {
    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
    Spacer(Modifier.width(ButtonDefaults.IconSpacing))
    Text(stringResource(label))
}

@Composable
private fun MemoList(
    memos: List<VoiceMemo>,
    playing: File?,
    onTogglePlay: (VoiceMemo) -> Unit,
    onDelete: (VoiceMemo) -> Unit,
) {
    val dateFormat = remember { DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT) }
    LazyColumn(contentPadding = PaddingValues(bottom = 16.dp)) {
        items(memos, key = { it.file.path }) { memo ->
            val isPlaying = memo.file == playing
            ListItem(
                headlineContent = { Text(dateFormat.format(Date(memo.lastModified))) },
                supportingContent = {
                    Text(
                        stringResource(
                            R.string.memo_meta,
                            memo.durationMs?.let(Format::duration) ?: "–",
                            Format.size(memo.sizeBytes),
                        ),
                    )
                },
                leadingContent = {
                    IconButton(onClick = { onTogglePlay(memo) }) {
                        Icon(
                            painterResource(if (isPlaying) R.drawable.ic_stop else R.drawable.ic_play),
                            contentDescription = stringResource(if (isPlaying) R.string.cd_stop_playback else R.string.cd_play),
                        )
                    }
                },
                trailingContent = {
                    IconButton(onClick = { onDelete(memo) }) {
                        Icon(painterResource(R.drawable.ic_delete), contentDescription = stringResource(R.string.cd_delete))
                    }
                },
            )
        }
    }
}
