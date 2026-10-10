package com.misync.recorder

import android.app.Application
import android.util.Log
import com.misync.recorder.service.RecordingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class MISyncApp : Application() {

    lateinit var container: AppContainer
        private set

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        RecordingService.ensureChannel(this)
        // Repair recordings interrupted by a crash, reboot or force-stop.
        appScope.launch {
            runCatching {
                val active = container.recordingController.state.value.recordingId
                val repaired = container.repository.recoverInterrupted(activeId = active)
                if (repaired > 0) Log.i(TAG, "Recovered $repaired interrupted recording(s)")
            }.onFailure { Log.e(TAG, "Recovery failed", it) }
        }
    }

    private companion object {
        const val TAG = "MISyncApp"
    }
}
