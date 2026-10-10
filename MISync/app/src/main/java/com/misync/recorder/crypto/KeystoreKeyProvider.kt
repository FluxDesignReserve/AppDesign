package com.misync.recorder.crypto

import android.content.Context
import android.content.pm.PackageManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.Log
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/**
 * Owns the app's AES-256-GCM key-encryption key inside the Android Keystore.
 *
 * The key is non-exportable, hardware-backed where the device supports it (TEE on the
 * Redmi 14C 5G; StrongBox is used if present), and usable only while the device is unlocked.
 *
 * The key deliberately does not require per-use biometric authentication: recording runs in a
 * foreground service that must keep working with the screen off. Biometric authentication
 * instead gates the UI (library, playback, rename, delete) — see `security/AppLock`.
 */
class KeystoreKeyProvider(private val context: Context) {

    @Synchronized
    fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(ALIAS, null) as? SecretKey)?.let { return it }

        val wantStrongBox = context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)
        return try {
            generate(strongBox = wantStrongBox)
        } catch (e: StrongBoxUnavailableException) {
            Log.w(TAG, "StrongBox unavailable, falling back to TEE", e)
            generate(strongBox = false)
        }
    }

    private fun generate(strongBox: Boolean): SecretKey {
        val spec = KeyGenParameterSpec.Builder(
            ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .setUnlockedDeviceRequired(true)
            .setIsStrongBoxBacked(strongBox)
            .build()
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(spec)
        return generator.generateKey()
    }

    companion object {
        private const val TAG = "KeystoreKeyProvider"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val ALIAS = "misync_kek_v1"
    }
}
