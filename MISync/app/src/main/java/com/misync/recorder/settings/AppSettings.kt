package com.misync.recorder.settings

import android.content.Context
import com.misync.recorder.audio.CaptureSource
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Small, non-sensitive preferences. No recording content or metadata is stored here. */
class AppSettings(context: Context) {
    private val prefs = context.getSharedPreferences("misync_settings", Context.MODE_PRIVATE)

    private val _source = MutableStateFlow(CaptureSource.fromName(prefs.getString(KEY_SOURCE, null)))
    val source: StateFlow<CaptureSource> = _source.asStateFlow()

    private val _biometricUnlock = MutableStateFlow(prefs.getBoolean(KEY_BIOMETRIC_UNLOCK, false))
    /** Optional: allow biometrics to stand in for the PIN. The PIN is always required as a fallback. */
    val biometricUnlockEnabled: StateFlow<Boolean> = _biometricUnlock.asStateFlow()

    fun setSource(source: CaptureSource) {
        require(source.userSelectable)
        prefs.edit().putString(KEY_SOURCE, source.name).apply()
        _source.value = source
    }

    fun setBiometricUnlockEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_BIOMETRIC_UNLOCK, enabled).apply()
        _biometricUnlock.value = enabled
    }

    private companion object {
        const val KEY_SOURCE = "capture_source"
        const val KEY_BIOMETRIC_UNLOCK = "biometric_unlock"
    }
}
