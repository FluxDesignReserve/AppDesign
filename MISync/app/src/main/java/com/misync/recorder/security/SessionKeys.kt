package com.misync.recorder.security

import com.misync.recorder.crypto.DataKeys
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.crypto.SecretKey

/**
 * Holds the decrypted master key in memory for the current unlocked session only.
 *
 * The key exists in memory solely between a successful PIN entry and the app going to the
 * background (or the process dying). It is never written to disk in plaintext. Everything that
 * encrypts or decrypts recordings reads the key through [requireKey], so when the app is locked
 * those operations are simply unavailable.
 */
object SessionKeys {

    private val _unlocked = MutableStateFlow(false)
    val unlocked: StateFlow<Boolean> = _unlocked.asStateFlow()

    @Volatile
    private var master: ByteArray? = null

    fun unlock(masterKey: ByteArray) {
        master = masterKey
        _unlocked.value = true
    }

    /** Wipes the key from memory and locks the app. */
    fun clear() {
        master?.fill(0)
        master = null
        _unlocked.value = false
    }

    fun requireKey(): SecretKey =
        DataKeys.toSecretKey(master ?: error("App is locked; no master key available"))
}
