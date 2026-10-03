import XCTest
@testable import PolarsyncCore

final class WellnessScheduleTests: XCTestCase {

    private var calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    private func date(_ day: Int, _ hour: Int, _ minute: Int) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 10, day: day, hour: hour, minute: minute))!
    }

    func testBlinkTimesEvery20Minutes() {
        let times = WellnessSchedule.blinkTimes(startHour: 9, endHour: 21)
        XCTAssertEqual(times.count, 36)
        XCTAssertEqual(times.first, HourMinute(hour: 9, minute: 0))
        XCTAssertEqual(times[1], HourMinute(hour: 9, minute: 20))
        XCTAssertEqual(times.last, HourMinute(hour: 20, minute: 40))
    }

    func testBlinkTimesRejectInvalidRanges() {
        XCTAssertTrue(WellnessSchedule.blinkTimes(startHour: 21, endHour: 9).isEmpty)
        XCTAssertTrue(WellnessSchedule.blinkTimes(startHour: 9, endHour: 9).isEmpty)
        XCTAssertTrue(WellnessSchedule.blinkTimes(startHour: -1, endHour: 5).isEmpty)
        XCTAssertEqual(WellnessSchedule.blinkTimes(startHour: 0, endHour: 24).count, 72)
    }

    func testWaterEveryFourHoursFrom11() {
        XCTAssertEqual(
            WellnessSchedule.waterTimes(),
            [11, 15, 19, 23].map { HourMinute(hour: $0, minute: 0) }
        )
    }

    func testDefaultsFitTheNotificationLimit() {
        let builtIn = WellnessSchedule.blinkTimes(startHour: 9, endHour: 21).count + WellnessSchedule.waterTimes().count
        XCTAssertLessThanOrEqual(builtIn, WellnessSchedule.notificationLimit - 20, "room for 20 custom reminders")
    }

    func testNextTime() {
        let water = WellnessSchedule.waterTimes()
        XCTAssertEqual(WellnessSchedule.next(after: date(3, 8, 0), times: water, calendar: calendar), date(3, 11, 0))
        XCTAssertEqual(WellnessSchedule.next(after: date(3, 11, 0), times: water, calendar: calendar), date(3, 15, 0))
        XCTAssertEqual(WellnessSchedule.next(after: date(3, 23, 30), times: water, calendar: calendar), date(4, 11, 0))
        XCTAssertNil(WellnessSchedule.next(after: date(3, 8, 0), times: [], calendar: calendar))
    }

    func testDayKey() {
        XCTAssertEqual(WellnessSchedule.dayKey(date(3, 23, 59), calendar: calendar), "2026-10-03")
        XCTAssertEqual(WellnessSchedule.dayKey(date(4, 0, 0), calendar: calendar), "2026-10-04")
    }
}
