import CryptoKit
import XCTest
@testable import PolarsyncCore

final class EncryptedMemoFormatTests: XCTestCase {

    private let chunk = EncryptedMemoFormat.defaultChunkSize
    private let wrapper = AESGCMKeyWrapper(masterKey: SymmetricKey(size: .bits256))

    private func randomData(_ count: Int) -> Data {
        var generator = SystemRandomNumberGenerator()
        return Data((0..<count).map { _ in UInt8.random(in: 0...255, using: &generator) })
    }

    private func assertFormatError(
        _ expected: MemoFormatError? = nil,
        file: StaticString = #filePath,
        line: UInt = #line,
        _ body: () throws -> Void
    ) {
        XCTAssertThrowsError(try body(), file: file, line: line) { error in
            guard let formatError = error as? MemoFormatError else {
                return XCTFail("Unexpected error \(error)", file: file, line: line)
            }
            if let expected { XCTAssertEqual(formatError, expected, file: file, line: line) }
        }
    }

    // MARK: Round trips

    func testRoundTripAtChunkBoundaries() throws {
        for size in [0, 1, chunk - 1, chunk, chunk + 1, 2 * chunk, 3 * chunk + 17] {
            let plain = randomData(size)
            let sealed = try EncryptedMemoFormat.encrypt(plain, wrapper: wrapper)
            let reader = try EncryptedMemoFormat.Reader(data: sealed, wrapper: wrapper)
            XCTAssertEqual(reader.plaintextLength, Int64(size), "size \(size)")
            XCTAssertEqual(try reader.readAll(), plain, "size \(size)")

            let chunks = (size + chunk - 1) / chunk
            let headerSize = sealed.count - size - chunks * 16
            XCTAssertGreaterThan(headerSize, 0)
        }
    }

    func testFileRoundTrip() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let plain = randomData(2 * chunk + 123)
        let input = dir.appendingPathComponent("memo.caf")
        let output = dir.appendingPathComponent("memo.psm")
        try plain.write(to: input)

        try EncryptedMemoFormat.encryptFile(at: input, to: output, wrapper: wrapper)

        XCTAssertFalse(FileManager.default.fileExists(atPath: output.path + ".part"))
        let sealed = try Data(contentsOf: output)
        XCTAssertNil(sealed.range(of: plain.prefix(64)), "plaintext must not appear in the file")
        let reader = try EncryptedMemoFormat.Reader(url: output, wrapper: wrapper)
        XCTAssertEqual(try reader.readAll(), plain)
    }

    func testHeaderStartsWithMagicAndIsBigEndian() throws {
        let sealed = try EncryptedMemoFormat.encrypt(Data([1, 2, 3]), wrapper: wrapper)
        XCTAssertEqual(Array(sealed.prefix(4)), Array("PSM1".utf8))
        XCTAssertEqual(Array(sealed[4..<6]), [0, 12], "12-byte wrap IV")
        // chunk size and length close the header, just before the single chunk (3 bytes + tag).
        let tail = sealed.dropLast(3 + 16).suffix(12)
        XCTAssertEqual(Array(tail), [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3])
    }

    func testRandomAccessAcrossChunks() throws {
        let plain = randomData(3 * chunk + 500)
        let reader = try EncryptedMemoFormat.Reader(data: EncryptedMemoFormat.encrypt(plain, wrapper: wrapper), wrapper: wrapper)
        let cases: [(Int, Int)] = [
            (0, 10), (chunk - 5, 10), (chunk, 1), (chunk - 1, chunk + 2),
            (2 * chunk + 7, 3), (plain.count - 4, 100), (5, 3 * chunk), (17, 0),
        ]
        for (position, count) in cases {
            let expected = plain[min(position, plain.count) ..< min(position + count, plain.count)]
            XCTAssertEqual(try reader.read(at: Int64(position), count: count), Data(expected), "\(position)+\(count)")
        }
        // Reading backwards after forwards exercises the chunk cache.
        XCTAssertEqual(try reader.read(at: 3, count: 4), plain[3..<7])
        XCTAssertTrue(try reader.read(at: Int64(plain.count), count: 10).isEmpty)
        XCTAssertTrue(try reader.read(at: Int64(plain.count) + 1_000, count: 10).isEmpty)
    }

    func testEachFileUsesAFreshKey() throws {
        let plain = randomData(1000)
        let a = try EncryptedMemoFormat.encrypt(plain, wrapper: wrapper)
        let b = try EncryptedMemoFormat.encrypt(plain, wrapper: wrapper)
        XCTAssertNotEqual(a, b)
    }

    // MARK: Tampering

    func testFlippedBitInEachChunkIsDetected() throws {
        let plain = randomData(2 * chunk + 10)
        let sealed = try EncryptedMemoFormat.encrypt(plain, wrapper: wrapper)
        let headerSize = sealed.count - plain.count - 3 * 16
        for offset in [headerSize, headerSize + chunk + 16 + 5, sealed.count - 1] {
            var tampered = sealed
            tampered[offset] ^= 0x01
            let reader = try EncryptedMemoFormat.Reader(data: tampered, wrapper: wrapper)
            assertFormatError(.tampered) { _ = try reader.readAll() }
        }
    }

    func testTamperedHeaderIsDetected() throws {
        let plain = randomData(chunk + 10)
        let sealed = try EncryptedMemoFormat.encrypt(plain, wrapper: wrapper)
        let headerSize = sealed.count - plain.count - 2 * 16

        var badMagic = sealed
        badMagic[0] ^= 0xFF
        assertFormatError(.notAMemo) { _ = try EncryptedMemoFormat.Reader(data: badMagic, wrapper: self.wrapper) }

        // Every other header byte: wrapped key, sizes, IV.
        for offset in 4..<headerSize {
            var tampered = sealed
            tampered[offset] ^= 0x01
            assertFormatError { _ = try EncryptedMemoFormat.Reader(data: tampered, wrapper: self.wrapper).readAll() }
        }
    }

    func testTruncationAndExtensionAreDetected() throws {
        let plain = randomData(2 * chunk + 10)
        let sealed = try EncryptedMemoFormat.encrypt(plain, wrapper: wrapper)
        assertFormatError(.truncatedOrCorrupt) { _ = try EncryptedMemoFormat.Reader(data: sealed.dropLast(), wrapper: self.wrapper) }
        assertFormatError(.truncatedOrCorrupt) {
            _ = try EncryptedMemoFormat.Reader(data: sealed.dropLast(10 + 16), wrapper: self.wrapper)
        }
        assertFormatError(.truncatedOrCorrupt) { _ = try EncryptedMemoFormat.Reader(data: sealed + Data([0]), wrapper: self.wrapper) }
        assertFormatError(.notAMemo) { _ = try EncryptedMemoFormat.Reader(data: sealed.prefix(3), wrapper: self.wrapper) }
        assertFormatError(.notAMemo) { _ = try EncryptedMemoFormat.Reader(data: Data(), wrapper: self.wrapper) }
    }

    func testLastChunkCutAndLengthFieldRewrittenIsDetected() throws {
        // An attacker drops the last chunk and patches plaintextLength to match: the header is
        // authenticated as associated data, so every chunk then fails.
        let plain = randomData(2 * chunk)
        let sealed = try EncryptedMemoFormat.encrypt(plain, wrapper: wrapper)
        let headerSize = sealed.count - plain.count - 2 * 16
        var cut = Data(sealed.prefix(sealed.count - chunk - 16))
        var newLength = Data()
        newLength.appendBigEndian(Int64(chunk))
        cut.replaceSubrange(headerSize - 8 ..< headerSize, with: newLength)
        let reader = try EncryptedMemoFormat.Reader(data: cut, wrapper: wrapper)
        assertFormatError(.tampered) { _ = try reader.readAll() }
    }

    func testReorderedChunksAreDetected() throws {
        let plain = randomData(3 * chunk)
        let sealed = try EncryptedMemoFormat.encrypt(plain, wrapper: wrapper)
        let headerSize = sealed.count - plain.count - 3 * 16
        let sealedChunk = chunk + 16
        let first = sealed[headerSize ..< headerSize + sealedChunk]
        let second = sealed[headerSize + sealedChunk ..< headerSize + 2 * sealedChunk]
        var swapped = Data(sealed.prefix(headerSize))
        swapped.append(second)
        swapped.append(first)
        swapped.append(sealed.suffix(sealedChunk))
        let reader = try EncryptedMemoFormat.Reader(data: swapped, wrapper: wrapper)
        assertFormatError(.tampered) { _ = try reader.read(at: 0, count: 1) }
    }

    func testChunkFromAnotherFileIsDetected() throws {
        let a = try EncryptedMemoFormat.encrypt(randomData(chunk), wrapper: wrapper)
        let b = try EncryptedMemoFormat.encrypt(randomData(chunk), wrapper: wrapper)
        let headerSize = a.count - chunk - 16
        var spliced = Data(a.prefix(headerSize))
        spliced.append(b.suffix(chunk + 16))
        let reader = try EncryptedMemoFormat.Reader(data: spliced, wrapper: wrapper)
        assertFormatError(.tampered) { _ = try reader.readAll() }
    }

    func testWrongMasterKeyIsRejected() throws {
        let sealed = try EncryptedMemoFormat.encrypt(randomData(100), wrapper: wrapper)
        let other = AESGCMKeyWrapper(masterKey: SymmetricKey(size: .bits256))
        assertFormatError(.keyUnavailable) { _ = try EncryptedMemoFormat.Reader(data: sealed, wrapper: other) }
    }

    func testInputLengthMismatchIsRejected() {
        var produced = Data([1, 2, 3])
        assertFormatError(.inputLengthMismatch) {
            try EncryptedMemoFormat.encrypt(plaintextLength: 10, wrapper: self.wrapper, read: { _ in
                defer { produced = Data() }
                return produced
            }, write: { _ in })
        }
        var remaining = 20
        assertFormatError(.inputLengthMismatch) {
            try EncryptedMemoFormat.encrypt(plaintextLength: 10, wrapper: self.wrapper, read: { count in
                let n = min(count, remaining)
                remaining -= n
                return Data(count: n)
            }, write: { _ in })
        }
    }

    func testKeyWrapRoundTrip() throws {
        let key = SymmetricKey(size: .bits256)
        let wrapped = try wrapper.wrap(key)
        XCTAssertEqual(wrapped.iv.count, 12)
        XCTAssertEqual(wrapped.bytes.count, 32 + 16)
        let unwrapped = try wrapper.unwrap(wrapped)
        XCTAssertEqual(unwrapped.withUnsafeBytes { Data($0) }, key.withUnsafeBytes { Data($0) })
    }
}
