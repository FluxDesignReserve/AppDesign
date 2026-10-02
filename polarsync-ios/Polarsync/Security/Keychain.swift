import CryptoKit
import Foundation
import os
import PolarsyncCore
import Security

struct KeychainError: LocalizedError {
    let status: OSStatus

    var errorDescription: String? {
        let message = SecCopyErrorMessageString(status, nil) as String? ?? "unknown error"
        return "Keychain error \(status): \(message)"
    }
}

/// Minimal generic-password storage. Every item is `AfterFirstUnlockThisDeviceOnly`: readable
/// while the phone is locked (so a recording stopped from the Lock Screen can still be encrypted),
/// never synced to iCloud Keychain and never restored onto another device.
enum Keychain {
    static let service = "io.github.polarsync"

    /// The item's data, nil if there is no such item. Throws on any other failure: callers must
    /// not mistake "Keychain unavailable" for "not set yet".
    static func read(_ account: String) throws -> Data? {
        var query = baseQuery(account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        switch status {
        case errSecSuccess: return result as? Data
        case errSecItemNotFound: return nil
        default: throw KeychainError(status: status)
        }
    }

    static func write(_ data: Data, account: String) throws {
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(baseQuery(account) as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            try add(data, account: account)
        } else if status != errSecSuccess {
            throw KeychainError(status: status)
        }
    }

    /// Adds a new item; throws `errSecDuplicateItem` if it already exists.
    static func add(_ data: Data, account: String) throws {
        var query = baseQuery(account)
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError(status: status) }
    }

    /// Removes every Polarsync item (PIN hash and master key).
    static func deleteAll() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        SecItemDelete(query as CFDictionary)
    }

    private static func baseQuery(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false,
        ]
    }
}

/// Wraps per-file keys with a random AES-256 master key kept in the Keychain.
///
/// iOS has no hardware-bound *symmetric* key like Android Keystore's: the Secure Enclave only holds
/// P-256 keys. The Keychain is itself encrypted with a device key derived inside the Secure Enclave,
/// and `ThisDeviceOnly` stops the item from leaving the phone, so a `.psm` copied elsewhere can't be
/// decrypted. The key is read into memory while the app runs.
final class KeychainKeyWrapper: KeyWrapper {
    private static let account = "master-key-v1"
    private let lock = NSLock()
    private var cached: AESGCMKeyWrapper?

    func wrap(_ key: SymmetricKey) throws -> WrappedKey {
        try wrapper().wrap(key)
    }

    func unwrap(_ wrapped: WrappedKey) throws -> SymmetricKey {
        try wrapper().unwrap(wrapped)
    }

    private func wrapper() throws -> AESGCMKeyWrapper {
        lock.lock()
        defer { lock.unlock() }
        if let cached { return cached }
        let wrapper = AESGCMKeyWrapper(masterKey: try loadOrCreateMasterKey())
        cached = wrapper
        return wrapper
    }

    private func loadOrCreateMasterKey() throws -> SymmetricKey {
        if let data = try Keychain.read(Self.account) {
            guard data.count == 32 else { throw KeychainError(status: errSecDecode) }
            return SymmetricKey(data: data)
        }
        // Only reached when the item genuinely doesn't exist (read() throws on other errors), so an
        // unavailable Keychain can never cause a new key to replace the one existing files need.
        let key = SymmetricKey(size: .bits256)
        do {
            try Keychain.add(key.withUnsafeBytes { Data($0) }, account: Self.account)
            Logger.security.info("Created a new master key")
            return key
        } catch let error as KeychainError where error.status == errSecDuplicateItem {
            guard let data = try Keychain.read(Self.account), data.count == 32 else { throw error }
            return SymmetricKey(data: data)
        }
    }
}

/// Keeps the PIN record (salt, hash, failed attempts, lockout) as a single Keychain item.
final class KeychainPinStore: PinStore {
    private static let account = "pin-v1"

    func load() throws -> PinRecord {
        guard let data = try Keychain.read(Self.account) else { return PinRecord() }
        return try JSONDecoder().decode(PinRecord.self, from: data)
    }

    func save(_ record: PinRecord) throws {
        try Keychain.write(JSONEncoder().encode(record), account: Self.account)
    }
}

extension Logger {
    static let security = Logger(subsystem: "io.github.polarsync", category: "Security")
    static let recording = Logger(subsystem: "io.github.polarsync", category: "Recording")
    static let library = Logger(subsystem: "io.github.polarsync", category: "Library")
}
