import Foundation

/// Locale-independent formatting shared by the UI and the Live Activity.
public enum Format {

    /// `memo_20261002_143005`: sortable, filesystem-safe, locale-independent. No extension.
    public static func recordingBaseName(_ date: Date, timeZone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyyMMdd_HHmmss"
        return "memo_" + formatter.string(from: date)
    }

    /// `0:07`, `12:34`, `1:02:03`.
    public static func duration(_ seconds: TimeInterval) -> String {
        let total = seconds.isFinite ? max(0, Int(seconds)) : 0
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }

    /// `9 AM`, `12 PM`, `9 PM`; 0 and 24 are both `12 AM` (midnight).
    public static func hour12(_ hour: Int) -> String {
        let h = ((hour % 24) + 24) % 24
        let display = h % 12 == 0 ? 12 : h % 12
        return "\(display) \(h < 12 ? "AM" : "PM")"
    }

    /// `512 B`, `48 KB`, `3.2 MB`.
    public static func size(_ bytes: Int64) -> String {
        if bytes < 1024 { return "\(max(0, bytes)) B" }
        if bytes < 1024 * 1024 { return "\(bytes / 1024) KB" }
        return String(format: "%.1f MB", Double(bytes) / (1024 * 1024))
    }
}

/// Elapsed-time bookkeeping for a session that can be paused and resumed.
public struct RecordingClock: Equatable, Codable, Hashable {
    /// Time recorded before the current segment.
    public var accumulated: TimeInterval
    /// When the current segment started, or nil while paused.
    public var segmentStart: Date?

    public init(accumulated: TimeInterval = 0, segmentStart: Date? = nil) {
        self.accumulated = accumulated
        self.segmentStart = segmentStart
    }

    public var isRunning: Bool { segmentStart != nil }

    public func elapsed(at now: Date) -> TimeInterval {
        guard let start = segmentStart else { return accumulated }
        return accumulated + max(0, now.timeIntervalSince(start))
    }

    /// A start date that, counted from, shows the total elapsed time (for `Text(timerInterval:)`).
    public func effectiveStart(at now: Date) -> Date {
        now.addingTimeInterval(-elapsed(at: now))
    }

    public mutating func pause(at now: Date) {
        accumulated = elapsed(at: now)
        segmentStart = nil
    }

    public mutating func resume(at now: Date) {
        if segmentStart == nil { segmentStart = now }
    }
}

/// Free-space thresholds, the same as Android: don't start below 50 MB, stop below 20 MB.
public enum StoragePolicy {
    public static let minimumToStart: Int64 = 50 * 1024 * 1024
    public static let reserve: Int64 = 20 * 1024 * 1024

    public static func canStart(freeBytes: Int64) -> Bool { freeBytes >= minimumToStart }
    public static func mustStop(freeBytes: Int64) -> Bool { freeBytes < reserve }
}
