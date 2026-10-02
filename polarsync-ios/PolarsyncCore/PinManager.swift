import CommonCrypto
import Foundation
import Security

/// Everything ``PinManager`` persists. Saved as one item so updates are atomic.
public struct PinRecord: Codable, Equatable {
    public var salt: Data?
    public var hash: Data?
    public var failedAttempts: Int
    /// Seconds since 1970 until which guesses are refused, or 0.
    public var lockedUntil: TimeInterval

    public init(salt: Data? = nil, hash: Data? = nil, failedAttempts: Int = 0, lockedUntil: TimeInterval = 0) {
        self.salt = salt
        self.hash = hash
        self.failedAttempts = failedAttempts
        self.lockedUntil = lockedUntil
    }
}

/// Where ``PinManager`` keeps its state (the Keychain in the app, memory in tests).
public protocol PinStore: AnyObject {
    func load() throws -> PinRecord
    func save(_ record: PinRecord) throws
}

public final class InMemoryPinStore: PinStore {
    public var record: PinRecord

    public init(record: PinRecord = PinRecord()) {
        self.record = record
    }

    public func load() throws -> PinRecord { record }
    public func save(_ record: PinRecord) throws { self.record = record }
}

public enum PinError: Error, Equatable {
    case invalidFormat
    case notSet
    case hashingFailed
}

/// The 4-digit app PIN. Only a salted PBKDF2-HMAC-SHA256 hash is stored, and checks use a
/// constant-time comparison. After ``freeAttempts`` wrong guesses, each further wrong guess locks
/// entry for longer (30 s, 1 min, 2 min … up to 1 h), so all 10,000 PINs can't be tried quickly.
///
/// Hashing takes noticeable time: call ``setPin(_:)`` and ``verify(_:)`` off the main thread.
public final class PinManager {

    public enum Result: Equatable {
        case success
        case wrong(attemptsBeforeLockout: Int)
        case lockedOut(until: TimeInterval)
    }

    public static let pinLength = 4
    public static let freeAttempts = 5
    public static let defaultIterations = 120_000
    static let saltBytes = 16
    static let hashBytes = 32
    static let firstLockout: TimeInterval = 30
    static let maxLockout: TimeInterval = 60 * 60

    private let store: PinStore
    private let clock: () -> TimeInterval
    private let iterations: Int
    private let lock = NSLock()

    public init(
        store: PinStore,
        iterations: Int = PinManager.defaultIterations,
        clock: @escaping () -> TimeInterval = { Date().timeIntervalSince1970 }
    ) {
        self.store = store
        self.iterations = iterations
        self.clock = clock
    }

    /// Throws if the store can't be read: callers must not treat that as "no PIN yet".
    public func isPinSet() throws -> Bool {
        let record = try store.load()
        return record.salt != nil && record.hash != nil
    }

    /// Seconds until another guess is allowed, or 0.
    public func lockoutRemaining() throws -> TimeInterval {
        max(0, try store.load().lockedUntil - clock())
    }

    public func setPin(_ pin: String) throws {
        guard Self.isValidPin(pin) else { throw PinError.invalidFormat }
        let salt = try Self.randomBytes(Self.saltBytes)
        let hash = try Self.hash(pin, salt: salt, iterations: iterations)
        lock.lock()
        defer { lock.unlock() }
        try store.save(PinRecord(salt: salt, hash: hash))
    }

    public func verify(_ pin: String) throws -> Result {
        lock.lock()
        defer { lock.unlock() }
        var record = try store.load()
        let now = clock()
        if now < record.lockedUntil { return .lockedOut(until: record.lockedUntil) }
        guard let salt = record.salt, let expected = record.hash else { throw PinError.notSet }

        if Self.isValidPin(pin), Self.constantTimeEquals(try Self.hash(pin, salt: salt, iterations: iterations), expected) {
            record.failedAttempts = 0
            record.lockedUntil = 0
            try store.save(record)
            return .success
        }

        record.failedAttempts += 1
        let lockout = Self.lockoutDuration(failures: record.failedAttempts)
        if lockout > 0 {
            record.lockedUntil = now + lockout
            try store.save(record)
            return .lockedOut(until: record.lockedUntil)
        }
        try store.save(record)
        return .wrong(attemptsBeforeLockout: Self.freeAttempts - record.failedAttempts)
    }

    // MARK: Pure helpers

    public static func isValidPin(_ pin: String) -> Bool {
        pin.count == pinLength && pin.allSatisfy { ("0"..."9").contains($0) }
    }

    /// 0 for the first ``freeAttempts`` − 1 failures, then 30 s doubling per failure, capped at 1 h.
    public static func lockoutDuration(failures: Int) -> TimeInterval {
        guard failures >= freeAttempts else { return 0 }
        let doublings = min(failures - freeAttempts, 7)
        return min(firstLockout * Double(1 << doublings), maxLockout)
    }

    static func hash(_ pin: String, salt: Data, iterations: Int) throws -> Data {
        guard let hash = pbkdf2SHA256(password: Data(pin.utf8), salt: salt, iterations: iterations, keyLength: hashBytes) else {
            throw PinError.hashingFailed
        }
        return hash
    }

    /// PBKDF2-HMAC-SHA256 via CommonCrypto. Returns nil if CommonCrypto reports an error.
    public static func pbkdf2SHA256(password: Data, salt: Data, iterations: Int, keyLength: Int) -> Data? {
        var derived = Data(count: keyLength)
        let status = derived.withUnsafeMutableBytes { derivedBuffer in
            password.withUnsafeBytes { passwordBuffer in
                salt.withUnsafeBytes { saltBuffer in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passwordBuffer.baseAddress?.assumingMemoryBound(to: CChar.self),
                        password.count,
                        saltBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        derivedBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        keyLength
                    )
                }
            }
        }
        return status == Int32(kCCSuccess) ? derived : nil
    }

    /// Compares every byte regardless of where the first difference is.
    public static func constantTimeEquals(_ a: Data, _ b: Data) -> Bool {
        guard a.count == b.count else { return false }
        var difference: UInt8 = 0
        for (x, y) in zip(a, b) {
            difference |= x ^ y
        }
        return difference == 0
    }

    static func randomBytes(_ count: Int) throws -> Data {
        var bytes = Data(count: count)
        let status = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, count, $0.baseAddress!) }
        guard status == errSecSuccess else { throw PinError.hashingFailed }
        return bytes
    }
}
