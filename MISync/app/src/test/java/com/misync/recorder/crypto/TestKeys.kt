package com.misync.recorder.crypto

import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/** Software stand-in for the Android Keystore key-encryption key. */
object TestKeys {
    fun newKek(): SecretKey = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
    fun newWrapper(kek: SecretKey = newKek()): KeyWrapper = AesGcmKeyWrapper { kek }
}
