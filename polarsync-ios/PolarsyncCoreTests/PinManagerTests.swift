import XCTest
@testable import PolarsyncCore

final class PinManagerTests: XCTestCase {

    private var now: TimeInterval = 1_000_000
    private var store: InMemoryPinStore!
    private var pins: PinManager!

    override func setUp() {
        super.setUp()
        now = 1_000_000
        store = InMemoryPinStore()
        // Few iterations keep the tests fast; the production count is checked separately.
        pins = PinManager(store: store, iterations: 1_000, clock: { [unowned self] in self.now })
    }

    func testPbkdf2MatchesKnownVectors() {
        func hex(_ data: Data?) -> String? { data?.map { String(format: "%02x", $0) }.joined() }
        let password = Data("password".utf8)
        let salt = Data("salt".utf8)
        XCTAssertEqual(
            hex(PinManager.pbkdf2SHA256(password: password, salt: salt, iterations: 1, keyLength: 32)),
            "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b"
        )
        XCTAssertEqual(
            hex(PinManager.pbkdf2SHA256(password: password, salt: salt, iterations: 4096, keyLength: 32)),
            "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a"
        )
    }

    func testProductionSettings() {
        XCTAssertEqual(PinManager.defaultIterations, 120_000)
        XCTAssertEqual(PinManager.pinLength, 4)
        XCTAssertEqual(PinManager.freeAttempts, 5)
    }

    func testStoresOnlySaltedHash() throws {
        XCTAssertFalse(try pins.isPinSet())
        try pins.setPin("1234")
        XCTAssertTrue(try pins.isPinSet())
        let record = store.record
        XCTAssertEqual(record.salt?.count, 16)
        XCTAssertEqual(record.hash?.count, 32)
        XCTAssertNil(record.hash.flatMap { $0.range(of: Data("1234".utf8)) })

        let first = record
        try pins.setPin("1234")
        XCTAssertNotEqual(store.record.salt, first.salt, "a new salt each time")
        XCTAssertNotEqual(store.record.hash, first.hash)
    }

    func testVerify() throws {
        try pins.setPin("0420")
        XCTAssertEqual(try pins.verify("0420"), .success)
        XCTAssertEqual(try pins.verify("0421"), .wrong(attemptsBeforeLockout: 4))
        XCTAssertEqual(try pins.verify("042"), .wrong(attemptsBeforeLockout: 3))
        XCTAssertEqual(try pins.verify("04200"), .wrong(attemptsBeforeLockout: 2))
        XCTAssertEqual(try pins.verify("０４２０"), .wrong(attemptsBeforeLockout: 1), "full-width digits aren't digits")
        XCTAssertEqual(try pins.verify("0420"), .success)
        XCTAssertEqual(store.record.failedAttempts, 0, "success resets the counter")
    }

    func testVerifyWithoutPinThrows() {
        XCTAssertThrowsError(try pins.verify("1234")) { XCTAssertEqual($0 as? PinError, .notSet) }
    }

    func testRejectsInvalidPins() {
        for pin in ["", "123", "12345", "12a4", " 123"] {
            XCTAssertThrowsError(try pins.setPin(pin), pin)
        }
    }

    func testLockoutSchedule() {
        XCTAssertEqual((0...4).map(PinManager.lockoutDuration), [0, 0, 0, 0, 0])
        XCTAssertEqual(PinManager.lockoutDuration(failures: 5), 30)
        XCTAssertEqual(PinManager.lockoutDuration(failures: 6), 60)
        XCTAssertEqual(PinManager.lockoutDuration(failures: 7), 120)
        XCTAssertEqual(PinManager.lockoutDuration(failures: 10), 960)
        XCTAssertEqual(PinManager.lockoutDuration(failures: 11), 1920)
        XCTAssertEqual(PinManager.lockoutDuration(failures: 12), 3600)
        XCTAssertEqual(PinManager.lockoutDuration(failures: 1_000), 3600)
    }

    func testLockoutBlocksEvenTheRightPin() throws {
        try pins.setPin("1111")
        for left in stride(from: 4, through: 1, by: -1) {
            XCTAssertEqual(try pins.verify("0000"), .wrong(attemptsBeforeLockout: left))
        }
        XCTAssertEqual(try pins.verify("0000"), .lockedOut(until: now + 30))
        XCTAssertEqual(try pins.lockoutRemaining(), 30)

        now += 29
        XCTAssertEqual(try pins.verify("1111"), .lockedOut(until: now + 1), "locked out even with the right PIN")
        XCTAssertEqual(store.record.failedAttempts, 5, "guesses during a lockout don't count")

        now += 1
        XCTAssertEqual(try pins.lockoutRemaining(), 0)
        XCTAssertEqual(try pins.verify("0000"), .lockedOut(until: now + 60), "next lockout doubles")
        now += 60
        XCTAssertEqual(try pins.verify("0000"), .lockedOut(until: now + 120))
        now += 120
        XCTAssertEqual(try pins.verify("1111"), .success)
        XCTAssertEqual(store.record, PinRecord(salt: store.record.salt, hash: store.record.hash))
    }

    func testLockoutSurvivesRestart() throws {
        try pins.setPin("1111")
        for _ in 0..<5 { _ = try pins.verify("0000") }
        let restarted = PinManager(store: store, iterations: 1_000, clock: { [unowned self] in self.now })
        XCTAssertEqual(try restarted.lockoutRemaining(), 30)
        XCTAssertEqual(try restarted.verify("1111"), .lockedOut(until: now + 30))
    }

    func testConstantTimeEquals() {
        XCTAssertTrue(PinManager.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 3])))
        XCTAssertFalse(PinManager.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 4])))
        XCTAssertFalse(PinManager.constantTimeEquals(Data([1, 2, 3]), Data([1, 2])))
        XCTAssertTrue(PinManager.constantTimeEquals(Data(), Data()))
    }
}
