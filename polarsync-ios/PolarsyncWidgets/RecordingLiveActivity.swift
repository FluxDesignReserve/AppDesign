import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct PolarsyncWidgets: WidgetBundle {
    var body: some Widget {
        RecordingLiveActivity()
    }
}

struct RecordingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RecordingActivityAttributes.self) { context in
            LockScreenView(state: context.state)
                .padding(16)
                .activityBackgroundTint(Theme.background)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    StatusLabel(state: context.state)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedText(state: context.state)
                        .font(.title3.monospacedDigit().weight(.semibold))
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Controls(state: context.state)
                }
            } compactLeading: {
                Image(systemName: context.state.isPaused ? "pause.fill" : "mic.fill")
                    .foregroundStyle(context.state.isPaused ? Theme.blue : Theme.red)
            } compactTrailing: {
                ElapsedText(state: context.state)
                    .monospacedDigit()
                    .frame(maxWidth: 52)
            } minimal: {
                Image(systemName: context.state.isPaused ? "pause.fill" : "mic.fill")
                    .foregroundStyle(context.state.isPaused ? Theme.blue : Theme.red)
            }
        }
    }
}

private struct LockScreenView: View {
    let state: RecordingActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                StatusLabel(state: state)
                Spacer()
                ElapsedText(state: state)
                    .font(.title2.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)
            }
            Controls(state: state)
        }
    }
}

private struct StatusLabel: View {
    let state: RecordingActivityAttributes.ContentState

    var body: some View {
        Label(state.isPaused ? "Paused" : "Recording", systemImage: state.isPaused ? "pause.circle.fill" : "record.circle")
            .font(.headline)
            .foregroundStyle(state.isPaused ? Theme.blue : Theme.red)
    }
}

private struct ElapsedText: View {
    let state: RecordingActivityAttributes.ContentState

    var body: some View {
        if let start = state.timerStart {
            Text(timerInterval: start...Date.distantFuture, countsDown: false)
                .multilineTextAlignment(.trailing)
        } else {
            Text(state.accumulatedText)
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct Controls: View {
    let state: RecordingActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            if state.isPaused {
                Button(intent: ResumeRecordingIntent()) {
                    Label("Resume", systemImage: "mic.fill").frame(maxWidth: .infinity)
                }
                .tint(Theme.green)
            } else {
                Button(intent: PauseRecordingIntent()) {
                    Label("Pause", systemImage: "pause.fill").frame(maxWidth: .infinity)
                }
                .tint(Theme.blue)
            }
            Button(intent: StopRecordingIntent()) {
                Label("Stop", systemImage: "stop.fill").frame(maxWidth: .infinity)
            }
            .tint(Theme.red)
        }
        .buttonStyle(.borderedProminent)
        .font(.subheadline.weight(.semibold))
    }
}
