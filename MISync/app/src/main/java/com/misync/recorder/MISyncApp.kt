package com.misync.recorder

import android.app.Application
import com.misync.recorder.service.RecordingService

class MISyncApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        RecordingService.ensureChannel(this)
        // Interrupted-recording recovery needs the PIN-derived key, so it runs after unlock
        // (see AppContainer.recoverInterruptedOnce()), not here.
    }
}
