import ActivityKit
import Foundation
import os

/// Starts, updates and ends the recording Live Activity (Lock Screen + Dynamic Island).
/// Recording works the same without it, e.g. if the user turned Live Activities off.
@MainActor
final class LiveActivityController {
    private var activity: Activity<RecordingActivityAttributes>?

    func start(_ state: RecordingActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            Logger.recording.info("Live Activities are turned off")
            return
        }
        do {
            activity = try Activity.request(
                attributes: RecordingActivityAttributes(),
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
        } catch {
            Logger.recording.error("Live Activity: \(error.localizedDescription, privacy: .public)")
        }
    }

    func update(_ state: RecordingActivityAttributes.ContentState) {
        guard let activity else { return }
        Task { await activity.update(ActivityContent(state: state, staleDate: nil)) }
    }

    func end(_ state: RecordingActivityAttributes.ContentState) {
        guard let activity else { return }
        self.activity = nil
        Task { await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate) }
    }

    /// Ends activities left over from a previous run that was terminated mid-recording.
    static func endAll() {
        Task {
            for activity in Activity<RecordingActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
