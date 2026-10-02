import CryptoKit
import Foundation

/// A per-file data key, encrypted ("wrapped") by a long-lived master key.
public struct WrappedKey: Equatable {
    public let iv: Data
    public let bytes: Data

    public init(iv: Data, bytes: Data) {
        self.iv = iv
        self.bytes = bytes
    }
}

/// Encrypts and decrypts per-file data keys with a master key.
public protocol KeyWrapper {
    func wrap(_ key: SymmetricKey) throws -> WrappedKey
    func unwrap(_ wrapped: WrappedKey) throws -> SymmetricKey
}

/// Wraps data keys with AES-256-GCM under a master key. The wrapped form is
/// `iv = 12-byte nonce`, `bytes = ciphertext ‖ 16-byte tag`, the same shape Android Keystore produces.
public struct AESGCMKeyWrapper: KeyWrapper {
    private let masterKey: SymmetricKey

    public init(masterKey: SymmetricKey) {
        self.masterKey = masterKey
    }

    public func wrap(_ key: SymmetricKey) throws -> WrappedKey {
        let raw = key.withUnsafeBytes { Data($0) }
        let box = try AES.GCM.seal(raw, using: masterKey)
        return WrappedKey(iv: box.nonce.withUnsafeBytes { Data($0) }, bytes: box.ciphertext + box.tag)
    }

    public func unwrap(_ wrapped: WrappedKey) throws -> SymmetricKey {
        guard wrapped.bytes.count > EncryptedMemoFormat.tagBytes else { throw MemoFormatError.keyUnavailable }
        let box = try AES.GCM.SealedBox(
            nonce: AES.GCM.Nonce(data: wrapped.iv),
            ciphertext: wrapped.bytes.dropLast(EncryptedMemoFormat.tagBytes),
            tag: wrapped.bytes.suffix(EncryptedMemoFormat.tagBytes)
        )
        let raw = try AES.GCM.open(box, using: masterKey)
        guard raw.count == EncryptedMemoFormat.keyBytes else { throw MemoFormatError.keyUnavailable }
        return SymmetricKey(data: raw)
    }
}

public enum MemoFormatError: Error, Equatable {
    /// The file doesn't start with the `PSM1` magic.
    case notAMemo
    /// The header is malformed.
    case corruptHeader
    /// The file is shorter or longer than its header says.
    case truncatedOrCorrupt
    /// The data key couldn't be unwrapped (wrong master key, or the wrapped key was altered).
    case keyUnavailable
    /// A chunk failed authentication: altered, reordered or moved from another file.
    case tampered
    /// The plaintext source was shorter or longer than announced.
    case inputLengthMismatch
}

/// On-disk format for encrypted recordings (`.psm`), byte-for-byte the same layout as the Android app.
///
/// Each file has its own random AES-256 data key, stored wrapped by the master key (see
/// ``KeyWrapper``). The audio is split into fixed-size chunks, each sealed with AES-GCM, so any part
/// of the file can be decrypted without decrypting the rest.
///
/// ```
/// header : magic "PSM1" | u16 ivLen | iv | u16 wrappedLen | wrappedKey | i32 chunkSize | i64 plaintextLength
/// chunk i: AES-GCM(dataKey, nonce = 0x00000000 ‖ u64 i, aad = header ‖ u64 i) → ciphertext ‖ 16-byte tag
/// ```
///
/// All integers are big-endian. The nonce can be the chunk index because every file has a fresh
/// key. Using the whole header plus the index as associated data means chunks can't be reordered,
/// swapped between files or truncated without decryption failing.
public enum EncryptedMemoFormat {

    public static let magic: UInt32 = 0x5053_4D31 // "PSM1"
    public static let defaultChunkSize = 64 * 1024
    public static let fileExtension = "psm"
    static let tagBytes = 16
    static let keyBytes = 32
    /// Rejects absurd header values before doing arithmetic with them.
    private static let maxPlaintextLength: Int64 = 1 << 48

    // MARK: Encryption

    /// Encrypts the file at `input` into `output`. Writes to `output.part` first and moves it into
    /// place at the end, so a crash never leaves a half-written `.psm` behind.
    public static func encryptFile(
        at input: URL,
        to output: URL,
        wrapper: KeyWrapper,
        chunkSize: Int = defaultChunkSize,
        fileAttributes: [FileAttributeKey: Any]? = nil
    ) throws {
        let fileManager = FileManager.default
        let part = output.appendingPathExtension("part")
        try? fileManager.removeItem(at: part)
        guard fileManager.createFile(atPath: part.path, contents: nil, attributes: fileAttributes) else {
            throw CocoaError(.fileWriteUnknown, userInfo: [NSFilePathErrorKey: part.path])
        }
        defer { try? fileManager.removeItem(at: part) }

        let size = try fileManager.attributesOfItem(atPath: input.path)[.size] as? NSNumber
        let source = try FileHandle(forReadingFrom: input)
        defer { try? source.close() }
        let sink = try FileHandle(forWritingTo: part)
        do {
            try encrypt(
                plaintextLength: size?.int64Value ?? 0,
                chunkSize: chunkSize,
                wrapper: wrapper,
                read: { try source.read(upToCount: $0) ?? Data() },
                write: { try sink.write(contentsOf: $0) }
            )
            try sink.synchronize()
            try sink.close()
        } catch {
            try? sink.close()
            throw error
        }

        if fileManager.fileExists(atPath: output.path) {
            try fileManager.removeItem(at: output)
        }
        try fileManager.moveItem(at: part, to: output)
    }

    /// Encrypts an in-memory plaintext. Mainly for tests and small payloads.
    public static func encrypt(_ plaintext: Data, wrapper: KeyWrapper, chunkSize: Int = defaultChunkSize) throws -> Data {
        var output = Data()
        var offset = plaintext.startIndex
        try encrypt(
            plaintextLength: Int64(plaintext.count),
            chunkSize: chunkSize,
            wrapper: wrapper,
            read: { count in
                let end = min(offset + count, plaintext.endIndex)
                defer { offset = end }
                return plaintext[offset..<end]
            },
            write: { output.append($0) }
        )
        return output
    }

    /// Streaming encryption. `read(n)` returns up to `n` bytes (empty at the end); `write` appends.
    public static func encrypt(
        plaintextLength: Int64,
        chunkSize: Int = defaultChunkSize,
        wrapper: KeyWrapper,
        read: (Int) throws -> Data,
        write: (Data) throws -> Void
    ) throws {
        precondition(chunkSize > 0 && plaintextLength >= 0)
        let dataKey = SymmetricKey(size: .bits256)
        let header = try makeHeader(wrapped: wrapper.wrap(dataKey), chunkSize: chunkSize, plaintextLength: plaintextLength)
        try write(header)

        var remaining = plaintextLength
        var index: UInt64 = 0
        while remaining > 0 {
            let length = Int(min(Int64(chunkSize), remaining))
            let chunk = try readExactly(length, using: read)
            let box = try AES.GCM.seal(chunk, using: dataKey, nonce: nonce(index), authenticating: aad(header, index))
            try write(box.ciphertext + box.tag)
            remaining -= Int64(length)
            index += 1
        }
        if !(try read(1)).isEmpty { throw MemoFormatError.inputLengthMismatch }
    }

    // MARK: Decryption

    /// Random-access decryption of one `.psm` file. Not thread-safe; use from one task at a time.
    public final class Reader {

        public let plaintextLength: Int64
        public let chunkSize: Int

        private let source: ByteSource
        private let header: Data
        private let key: SymmetricKey
        private var cachedIndex: Int64 = -1
        private var cachedChunk = Data()

        public convenience init(url: URL, wrapper: KeyWrapper) throws {
            try self.init(source: FileByteSource(url: url), wrapper: wrapper)
        }

        public convenience init(data: Data, wrapper: KeyWrapper) throws {
            try self.init(source: DataByteSource(data: data), wrapper: wrapper)
        }

        init(source: ByteSource, wrapper: KeyWrapper) throws {
            self.source = source
            var cursor: Int64 = 0
            func next(_ count: Int) throws -> Data {
                let bytes = try source.read(at: cursor, count: count)
                guard bytes.count == count else { throw MemoFormatError.truncatedOrCorrupt }
                cursor += Int64(count)
                return bytes
            }

            guard try source.length >= 4, try next(4).bigEndian(UInt32.self) == EncryptedMemoFormat.magic else {
                throw MemoFormatError.notAMemo
            }
            let iv = try next(Int(next(2).bigEndian(UInt16.self)))
            let wrappedBytes = try next(Int(next(2).bigEndian(UInt16.self)))
            let rawChunkSize = Int32(bitPattern: try next(4).bigEndian(UInt32.self))
            let rawLength = Int64(bitPattern: try next(8).bigEndian(UInt64.self))
            guard rawChunkSize > 0, rawLength >= 0, rawLength <= EncryptedMemoFormat.maxPlaintextLength else {
                throw MemoFormatError.corruptHeader
            }
            chunkSize = Int(rawChunkSize)
            plaintextLength = rawLength

            let wrapped = WrappedKey(iv: iv, bytes: wrappedBytes)
            header = EncryptedMemoFormat.makeHeader(wrapped: wrapped, chunkSize: chunkSize, plaintextLength: plaintextLength)
            let chunks = (plaintextLength + Int64(chunkSize) - 1) / Int64(chunkSize)
            let expectedLength = Int64(header.count) + plaintextLength + chunks * Int64(EncryptedMemoFormat.tagBytes)
            guard try source.length == expectedLength else { throw MemoFormatError.truncatedOrCorrupt }

            do {
                key = try wrapper.unwrap(wrapped)
            } catch {
                throw MemoFormatError.keyUnavailable
            }
        }

        /// Up to `count` plaintext bytes starting at `position`; empty at or past the end.
        public func read(at position: Int64, count: Int) throws -> Data {
            guard position >= 0, count > 0, position < plaintextLength else { return Data() }
            var output = Data(capacity: Int(min(Int64(count), plaintextLength - position)))
            var pos = position
            while output.count < count, pos < plaintextLength {
                let index = pos / Int64(chunkSize)
                let chunk = try self.chunk(index)
                let within = Int(pos - index * Int64(chunkSize))
                let take = min(count - output.count, chunk.count - within)
                output.append(chunk[chunk.startIndex + within ..< chunk.startIndex + within + take])
                pos += Int64(take)
            }
            return output
        }

        /// The whole plaintext.
        public func readAll() throws -> Data {
            try read(at: 0, count: Int(plaintextLength))
        }

        private func chunk(_ index: Int64) throws -> Data {
            if index == cachedIndex { return cachedChunk }
            let plainLength = Int(min(Int64(chunkSize), plaintextLength - index * Int64(chunkSize)))
            let offset = Int64(header.count) + index * Int64(chunkSize + EncryptedMemoFormat.tagBytes)
            let sealed = try source.read(at: offset, count: plainLength + EncryptedMemoFormat.tagBytes)
            guard sealed.count == plainLength + EncryptedMemoFormat.tagBytes else { throw MemoFormatError.truncatedOrCorrupt }
            let plain: Data
            do {
                let box = try AES.GCM.SealedBox(
                    nonce: EncryptedMemoFormat.nonce(UInt64(index)),
                    ciphertext: sealed.prefix(plainLength),
                    tag: sealed.suffix(EncryptedMemoFormat.tagBytes)
                )
                plain = try AES.GCM.open(box, using: key, authenticating: EncryptedMemoFormat.aad(header, UInt64(index)))
            } catch {
                throw MemoFormatError.tampered
            }
            cachedIndex = index
            cachedChunk = plain
            return plain
        }
    }

    // MARK: Helpers

    static func makeHeader(wrapped: WrappedKey, chunkSize: Int, plaintextLength: Int64) -> Data {
        var header = Data()
        header.appendBigEndian(magic)
        header.appendBigEndian(UInt16(wrapped.iv.count))
        header.append(wrapped.iv)
        header.appendBigEndian(UInt16(wrapped.bytes.count))
        header.append(wrapped.bytes)
        header.appendBigEndian(Int32(chunkSize))
        header.appendBigEndian(plaintextLength)
        return header
    }

    static func nonce(_ index: UInt64) throws -> AES.GCM.Nonce {
        var bytes = Data(count: 4)
        bytes.appendBigEndian(index)
        return try AES.GCM.Nonce(data: bytes)
    }

    static func aad(_ header: Data, _ index: UInt64) -> Data {
        var aad = header
        aad.appendBigEndian(index)
        return aad
    }

    private static func readExactly(_ count: Int, using read: (Int) throws -> Data) throws -> Data {
        var buffer = Data(capacity: count)
        while buffer.count < count {
            let bytes = try read(count - buffer.count)
            if bytes.isEmpty { throw MemoFormatError.inputLengthMismatch }
            buffer.append(bytes)
        }
        return buffer
    }
}

// MARK: - Byte sources

protocol ByteSource {
    var length: Int64 { get throws }
    func read(at offset: Int64, count: Int) throws -> Data
}

final class FileByteSource: ByteSource {
    private let handle: FileHandle

    init(url: URL) throws {
        handle = try FileHandle(forReadingFrom: url)
    }

    deinit {
        try? handle.close()
    }

    var length: Int64 {
        get throws { Int64(try handle.seekToEnd()) }
    }

    func read(at offset: Int64, count: Int) throws -> Data {
        try handle.seek(toOffset: UInt64(offset))
        return try handle.read(upToCount: count) ?? Data()
    }
}

struct DataByteSource: ByteSource {
    let data: Data

    var length: Int64 { Int64(data.count) }

    func read(at offset: Int64, count: Int) throws -> Data {
        guard offset < Int64(data.count) else { return Data() }
        let start = data.startIndex + Int(offset)
        return data[start ..< min(start + count, data.endIndex)]
    }
}

extension Data {
    mutating func appendBigEndian<T: FixedWidthInteger>(_ value: T) {
        Swift.withUnsafeBytes(of: value.bigEndian) { append(contentsOf: $0) }
    }

    /// Reads `self` (exactly `MemoryLayout<T>.size` bytes) as a big-endian unsigned integer.
    func bigEndian<T: FixedWidthInteger & UnsignedInteger>(_: T.Type) -> T {
        reduce(T.zero) { ($0 << 8) | T($1) }
    }
}
