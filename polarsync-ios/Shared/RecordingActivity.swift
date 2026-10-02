import ActivityKit
import AppIntents
import Foundation

/// The Live Activity shown on the Lock Screen and in the Dynamic Island while recording.
/// Compiled into both the app and the widget extension.
struct RecordingActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// Seconds recorded before the current segment.
        var accumulated: TimeInterval
        /// When the current segment started, or nil while paused.
        var segmentStart: Date?

        var isPaused: Bool { segmentStart == nil }

        /// A start date that, counted from, shows the total elapsed time.
        var timerStart: Date? { segmentStart?.addingTimeInterval(-accumulated) }

        /// `0:07`, `12:34`, `1:02:03` (the widget doesn't link PolarsyncCore).
        var accumulatedText: String {
            let total = max(0, Int(accumulated))
            let (hours, minutes, seconds) = (total / 3600, (total % 3600) / 60, total % 60)
            return hours > 0
                ? String(format: "%d:%02d:%02d", hours, minutes, seconds)
                : String(format: "%d:%02d", minutes, seconds)
        }
    }
}

enum RecordingCommand {
    case pause, resume, stop
}

/// Routes Live Activity buttons to the recorder. Set by the app at launch. A `LiveActivityIntent`
/// runs in the app's process, so the widget extension never calls this.
@MainActor
enum RecordingCommandCenter {
    static var handler: (@MainActor (RecordingCommand) -> Void)?
}

struct StopRecordingIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Stop recording"
    static let description = IntentDescription("Stops and saves the current Polarsync recording.")

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        RecordingCommandCenter.handler?(.stop)
        return .result()
    }
}

struct PauseRecordingIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Pause recording"
    static let description = IntentDescription("Pauses the current Polarsync recording.")

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        RecordingCommandCenter.handler?(.pause)
        return .result()
    }
}

struct ResumeRecordingIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Resume recording"
    static let description = IntentDescription("Resumes the paused Polarsync recording.")

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        RecordingCommandCenter.handler?(.resume)
        return .result()
    }
}
