import XCTest
@testable import PolarsyncCore

final class FormatTests: XCTestCase {

    func testRecordingBaseName() {
        let utc = TimeZone(identifier: "UTC")!
        let date = Date(timeIntervalSince1970: 1_791_037_805) // 2026-10-03 14:30:05 UTC
        XCTAssertEqual(Format.recordingBaseName(date, timeZone: utc), "memo_20261003_143005")
    }

    func testDuration() {
        XCTAssertEqual(Format.duration(0), "0:00")
        XCTAssertEqual(Format.duration(7.9), "0:07")
        XCTAssertEqual(Format.duration(754), "12:34")
        XCTAssertEqual(Format.duration(3723), "1:02:03")
        XCTAssertEqual(Format.duration(-5), "0:00")
        XCTAssertEqual(Format.duration(.nan), "0:00")
        XCTAssertEqual(Format.duration(.infinity), "0:00")
    }

    func testSize() {
        XCTAssertEqual(Format.size(0), "0 B")
        XCTAssertEqual(Format.size(512), "512 B")
        XCTAssertEqual(Format.size(1023), "1023 B")
        XCTAssertEqual(Format.size(1024), "1 KB")
        XCTAssertEqual(Format.size(48 * 1024 + 900), "48 KB")
        XCTAssertEqual(Format.size(1024 * 1024), "1.0 MB")
        XCTAssertEqual(Format.size(Int64(3.3 * 1024 * 1024)), "3.3 MB")
    }

    func testRecordingClock() {
        let t0 = Date(timeIntervalSince1970: 1_000)
        var clock = RecordingClock()
        XCTAssertEqual(clock.elapsed(at: t0), 0)
        clock.resume(at: t0)
        XCTAssertTrue(clock.isRunning)
        XCTAssertEqual(clock.elapsed(at: t0 + 10), 10)
        clock.pause(at: t0 + 10)
        XCTAssertFalse(clock.isRunning)
        XCTAssertEqual(clock.elapsed(at: t0 + 100), 10, "paused time doesn't count")
        clock.resume(at: t0 + 100)
        clock.resume(at: t0 + 200) // no-op while running
        XCTAssertEqual(clock.elapsed(at: t0 + 105), 15)
        XCTAssertEqual(clock.effectiveStart(at: t0 + 105), t0 + 90)
    }

    func testStoragePolicy() {
        XCTAssertFalse(StoragePolicy.canStart(freeBytes: 49 * 1024 * 1024))
        XCTAssertTrue(StoragePolicy.canStart(freeBytes: 50 * 1024 * 1024))
        XCTAssertTrue(StoragePolicy.mustStop(freeBytes: 19 * 1024 * 1024))
        XCTAssertFalse(StoragePolicy.mustStop(freeBytes: 20 * 1024 * 1024))
    }
}
