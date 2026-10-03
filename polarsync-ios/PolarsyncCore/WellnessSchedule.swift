import Foundation

/// A time of day, minute precision.
public struct HourMinute: Hashable, Codable, Comparable {
    public let hour: Int
    public let minute: Int

    public init(hour: Int, minute: Int) {
        self.hour = hour
        self.minute = minute
    }

    public var minutesSinceMidnight: Int { hour * 60 + minute }

    public static func < (lhs: HourMinute, rhs: HourMinute) -> Bool {
        lhs.minutesSinceMidnight < rhs.minutesSinceMidnight
    }
}

/// Times for the built-in wellness reminders. Pure logic, so it can be unit-tested.
public enum WellnessSchedule {

    /// iOS keeps at most 64 pending local notifications per app.
    public static let notificationLimit = 64

    /// Blink reminders every `everyMinutes` from `startHour`:00 up to (not including) `endHour`:00.
    /// 9–21 every 20 min gives 9:00, 9:20 … 20:40 (36 times). Empty if the range is invalid.
    public static func blinkTimes(startHour: Int, endHour: Int, everyMinutes: Int = 20) -> [HourMinute] {
        guard (0...23).contains(startHour), (1...24).contains(endHour), startHour < endHour, everyMinutes > 0 else {
            return []
        }
        return stride(from: startHour * 60, to: endHour * 60, by: everyMinutes).map {
            HourMinute(hour: $0 / 60, minute: $0 % 60)
        }
    }

    /// Water check-ins every `everyHours` from `firstHour`, within the same day: 11 → 11, 15, 19, 23.
    public static func waterTimes(firstHour: Int = 11, everyHours: Int = 4) -> [HourMinute] {
        guard (0...23).contains(firstHour), everyHours > 0 else { return [] }
        return stride(from: firstHour, to: 24, by: everyHours).map { HourMinute(hour: $0, minute: 0) }
    }

    /// The first of `times` strictly after `date`, today or tomorrow.
    public static func next(after date: Date, times: [HourMinute], calendar: Calendar = .current) -> Date? {
        let sorted = times.sorted()
        let startOfDay = calendar.startOfDay(for: date)
        for dayOffset in 0...1 {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: startOfDay) else { continue }
            for time in sorted {
                if let candidate = calendar.date(bySettingHour: time.hour, minute: time.minute, second: 0, of: day),
                   candidate > date {
                    return candidate
                }
            }
        }
        return nil
    }

    /// `2026-10-03`: a stable key for per-day counters.
    public static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}
