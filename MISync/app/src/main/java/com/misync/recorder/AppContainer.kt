package com.misync.recorder

import android.content.Context
import android.util.Log
import com.misync.recorder.crypto.AesGcmKeyWrapper
import com.misync.recorder.data.AppDatabase
import com.misync.recorder.data.RecordingFileStore
import com.misync.recorder.data.RecordingRepository
import com.misync.recorder.diagnostics.DiagnosticsRunner
import com.misync.recorder.security.MasterKeyStore
import com.misync.recorder.security.SessionKeys
import com.misync.recorder.service.RecordingController
import com.misync.recorder.settings.AppSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/** Manual dependency container; one instance per process, owned by [MISyncApp]. */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val recoveryStarted = AtomicBoolean(false)

    // Recording keys are wrapped with the PIN-derived master key held in SessionKeys. Nothing can
    // encrypt or decrypt until the user has entered their PIN this session.
    val keyWrapper = AesGcmKeyWrapper { SessionKeys.requireKey() }

    val masterKeyStore = MasterKeyStore(appContext)
    val database: AppDatabase by lazy { AppDatabase.create(appContext) }
    val fileStore: RecordingFileStore by lazy { RecordingFileStore(File(appContext.filesDir, "recordings")) }
    val repository: RecordingRepository by lazy { RecordingRepository(database.recordingDao(), fileStore, keyWrapper) }

    val settings = AppSettings(appContext)
    val recordingController = RecordingController(appContext)
    val diagnostics: DiagnosticsRunner by lazy { DiagnosticsRunner(appContext, repository) }

    /**
     * Repairs recordings interrupted by a crash, reboot or force-stop. Must run only after the PIN
     * has been entered (recovery needs the master key), and only once per process.
     */
    fun recoverInterruptedOnce() {
        if (!recoveryStarted.compareAndSet(false, true)) return
        scope.launch {
            runCatching {
                val active = recordingController.state.value.recordingId
                val repaired = repository.recoverInterrupted(activeId = active)
                if (repaired > 0) Log.i("AppContainer", "Recovered $repaired interrupted recording(s)")
            }.onFailure { Log.e("AppContainer", "Recovery failed", it) }
        }
    }
}
