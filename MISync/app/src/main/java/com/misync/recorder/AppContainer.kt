package com.misync.recorder

import android.content.Context
import com.misync.recorder.crypto.AesGcmKeyWrapper
import com.misync.recorder.crypto.KeystoreKeyProvider
import com.misync.recorder.data.AppDatabase
import com.misync.recorder.data.RecordingFileStore
import com.misync.recorder.data.RecordingRepository
import com.misync.recorder.diagnostics.DiagnosticsRunner
import com.misync.recorder.service.RecordingController
import com.misync.recorder.settings.AppSettings
import java.io.File

/** Manual dependency container; one instance per process, owned by [MISyncApp]. */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    private val keyProvider = KeystoreKeyProvider(appContext)
    val keyWrapper = AesGcmKeyWrapper { keyProvider.getOrCreateKey() }

    val database: AppDatabase by lazy { AppDatabase.create(appContext) }
    val fileStore: RecordingFileStore by lazy { RecordingFileStore(File(appContext.filesDir, "recordings")) }
    val repository: RecordingRepository by lazy { RecordingRepository(database.recordingDao(), fileStore, keyWrapper) }

    val settings = AppSettings(appContext)
    val recordingController = RecordingController(appContext)
    val diagnostics: DiagnosticsRunner by lazy { DiagnosticsRunner(appContext, repository) }
}
