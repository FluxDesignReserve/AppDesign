package com.misync.recorder.ui.diagnostics

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.misync.recorder.diagnostics.ProbeStatus
import com.misync.recorder.diagnostics.SourceProbe
import com.misync.recorder.ui.components.SectionLabel
import com.misync.recorder.ui.theme.MISyncColors

@Composable
fun DiagnosticsScreen(vm: DiagnosticsViewModel = viewModel(factory = DiagnosticsViewModel.Factory)) {
    val ui by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        Text("Settings & diagnostics", style = MaterialTheme.typography.headlineSmall)

        SectionLabel("Security", Modifier.padding(top = 16.dp))
        Card {
            Text("Access PIN", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(4.dp))
            Text(
                "A six-digit PIN, set once when the app was first installed, is required every time you open MISync. " +
                    "It cannot be changed or reset.",
                style = MaterialTheme.typography.bodyMedium,
                color = MISyncColors.TextSecondary,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                "Your PIN is the encryption key: each recording is sealed with AES-256-GCM under a unique key, which is " +
                    "wrapped by a master key derived from your PIN (PBKDF2) and additionally protected by the device's " +
                    "hardware-backed Keystore. There is no backdoor — if the PIN is forgotten, recordings cannot be " +
                    "recovered. The app has no internet permission.",
                style = MaterialTheme.typography.bodyMedium,
                color = MISyncColors.TextSecondary,
            )
        }

        SectionLabel("Device", Modifier.padding(top = 16.dp))
        ui.snapshot?.let { s ->
            Card {
                KeyValue("Model", "${s.manufacturer} ${s.model} (${s.device})")
                KeyValue("Android", "${s.androidRelease} · API ${s.sdkInt}")
                KeyValue("Build", s.buildDisplay)
                KeyValue("Microphone", if (s.hasMicrophone) "Present" else "Missing")
                KeyValue("Unprocessed source", if (s.unprocessedSupported) "Supported" else "Not reported")
                KeyValue("Audio mode", s.audioModeLabel)
                KeyValue("Mic permission", if (s.recordPermission) "Granted" else "Not granted")
            }
        }

        SectionLabel("Capture sources", Modifier.padding(top = 16.dp))
        Card {
            Text(
                "Opens each audio source through public Android APIs and measures what arrives. To test calls, start the call (speakerphone helps), return here and run the scan with clips enabled, then listen to the clips in the Library.",
                style = MaterialTheme.typography.bodyMedium,
                color = MISyncColors.TextSecondary,
            )
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Save 8 s encrypted clip per source", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                Switch(checked = ui.saveClips, onCheckedChange = vm::setSaveClips, enabled = ui.running == null)
            }
            Spacer(Modifier.height(10.dp))
            Button(onClick = vm::runScan, enabled = ui.running == null, modifier = Modifier.fillMaxWidth()) {
                if (ui.running != null) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(10.dp))
                    Text("Testing ${ui.running!!.label}…")
                } else {
                    Text("Run source scan")
                }
            }
            ui.blockedReason?.let {
                Text(it, color = MISyncColors.Warning, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
            }
            if (ui.probes.isNotEmpty()) Spacer(Modifier.height(12.dp))
            ui.probes.forEach { ProbeRow(it) }
        }

        ui.report?.let { report ->
            SectionLabel("Report", Modifier.padding(top = 16.dp))
            Card {
                Text(report, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.labelSmall, color = MISyncColors.TextSecondary)
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = { copyToClipboard(context, report) }, modifier = Modifier.fillMaxWidth()) {
                    Text("Copy report")
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Card(content: @Composable () -> Unit) {
    Surface(
        color = MISyncColors.Surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MISyncColors.Outline),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) { content() }
    }
}

@Composable
private fun KeyValue(key: String, value: String) {
    Row(Modifier.padding(vertical = 3.dp)) {
        Text(key, style = MaterialTheme.typography.bodyMedium, color = MISyncColors.TextSecondary, modifier = Modifier.width(130.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ProbeRow(probe: SourceProbe) {
    val color: Color = when (probe.status) {
        ProbeStatus.SIGNAL -> MISyncColors.Secure
        ProbeStatus.SILENT, ProbeStatus.SILENCED -> MISyncColors.Warning
        ProbeStatus.UNAVAILABLE, ProbeStatus.DENIED -> MISyncColors.TextSecondary
    }
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Column(Modifier.weight(1f)) {
            Text(probe.source.label, style = MaterialTheme.typography.titleMedium)
            val level = if (probe.rmsDbfs.isFinite()) " · %.0f dBFS".format(probe.rmsDbfs) else ""
            Text("${probe.status.label}$level", style = MaterialTheme.typography.labelMedium, color = color)
            if (probe.detail.isNotBlank()) {
                Text(probe.detail, style = MaterialTheme.typography.labelSmall, color = MISyncColors.TextSecondary)
            }
        }
        if (probe.savedRecordingId != null) {
            Text("clip saved", style = MaterialTheme.typography.labelSmall, color = MISyncColors.Accent)
        }
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(ClipboardManager::class.java)
    clipboard.setPrimaryClip(ClipData.newPlainText("MISync diagnostics", text))
}
