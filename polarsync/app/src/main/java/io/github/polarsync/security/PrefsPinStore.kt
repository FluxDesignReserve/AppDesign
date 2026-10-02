package io.github.polarsync.security

import android.content.Context
import android.util.Base64
import androidx.core.content.edit

/** [PinStore] backed by private SharedPreferences (excluded from backup and device transfer). */
class PrefsPinStore(context: Context) : PinStore {

    private val prefs = context.applicationContext.getSharedPreferences("pin", Context.MODE_PRIVATE)

    override var salt: ByteArray?
        get() = prefs.getString(KEY_SALT, null)?.let { Base64.decode(it, Base64.NO_WRAP) }
        set(value) = prefs.edit(commit = true) { putString(KEY_SALT, value?.let { Base64.encodeToString(it, Base64.NO_WRAP) }) }

    override var hash: ByteArray?
        get() = prefs.getString(KEY_HASH, null)?.let { Base64.decode(it, Base64.NO_WRAP) }
        set(value) = prefs.edit(commit = true) { putString(KEY_HASH, value?.let { Base64.encodeToString(it, Base64.NO_WRAP) }) }

    override var failedAttempts: Int
        get() = prefs.getInt(KEY_FAILURES, 0)
        set(value) = prefs.edit(commit = true) { putInt(KEY_FAILURES, value) }

    override var lockedUntilMillis: Long
        get() = prefs.getLong(KEY_LOCKED_UNTIL, 0)
        set(value) = prefs.edit(commit = true) { putLong(KEY_LOCKED_UNTIL, value) }

    private companion object {
        const val KEY_SALT = "salt"
        const val KEY_HASH = "hash"
        const val KEY_FAILURES = "failures"
        const val KEY_LOCKED_UNTIL = "locked_until"
    }
}
