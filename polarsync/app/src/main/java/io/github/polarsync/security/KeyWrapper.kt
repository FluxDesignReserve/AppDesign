package io.github.polarsync.security

/** A per-file data key, encrypted ("wrapped") by a long-lived master key. */
class WrappedKey(val iv: ByteArray, val bytes: ByteArray)

/** Encrypts and decrypts per-file data keys with a master key the app never sees in plain form. */
interface KeyWrapper {
    fun wrap(key: ByteArray): WrappedKey
    fun unwrap(wrapped: WrappedKey): ByteArray
}
