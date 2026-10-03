import PolarsyncCore
import SwiftUI
import UIKit

/// Home tab: greeting, water check-in, blink breaks and what's next.
struct TodayView: View {
    @Environment(WellnessStore.self) private var wellness
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    if !wellness.notificationsAllowed {
                        permissionCard
                    }
                    waterCard
                    blinkCard
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .background(ScreenBackground(glow: [Theme.blue, Theme.green]))
            .toolbar(.hidden, for: .navigationBar)
        }
        .task {
            await wellness.requestPermission()
        }
    }

    private var header: some View {
        TimelineView(.everyMinute) { context in
            VStack(alignment: .leading, spacing: 6) {
                Text(context.date, format: .dateTime.weekday(.wide).day().month(.wide))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.secondaryText)
                Text(greeting(for: context.date))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
            }
            .padding(.top, 24)
        }
    }

    private func greeting(for date: Date) -> String {
        switch Calendar.current.component(.hour, from: date) {
        case 5..<12: "Good morning"
        case 12..<17: "Good afternoon"
        default: "Good evening"
        }
    }

    // MARK: Water

    private var waterCard: some View {
        MoodCard(color: Theme.blue) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .center, spacing: 18) {
                    WaterRing(progress: Double(wellness.waterLitresToday) / Double(max(1, wellness.waterGoalLitres)))
                        .frame(width: 84, height: 84)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Water")
                            .font(.title3.weight(.semibold))
                        Text("\(wellness.waterLitresToday) of \(wellness.waterGoalLitres) L today")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                        if let next = wellness.nextWater() {
                            Text("Next check-in \(next, format: .dateTime.hour().minute())")
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryText)
                        }
                    }
                }
                HStack(spacing: 12) {
                    Button("I drank 1 L") {
                        wellness.logWater()
                    }
                    .buttonStyle(PillButtonStyle(color: Theme.blue))
                    .sensoryFeedback(.success, trigger: wellness.waterLitresToday)

                    if wellness.waterLitresToday > 0 {
                        Button {
                            wellness.undoWater()
                        } label: {
                            Image(systemName: "arrow.uturn.backward")
                                .font(.headline)
                                .frame(width: 48, height: 48)
                                .background(Circle().fill(Theme.surface))
                        }
                        .accessibilityLabel("Undo")
                        .foregroundStyle(.white)
                    }
                }
                Toggle("Check-ins at 11:00, 15:00, 19:00, 23:00", isOn: Bindable(wellness).waterEnabled)
                    .font(.footnote)
                    .tint(Theme.blue)
            }
        }
    }

    // MARK: Blink

    private var blinkCard: some View {
        @Bindable var wellness = wellness
        return MoodCard(color: Theme.green) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Blink breaks")
                            .font(.title3.weight(.semibold))
                        Text(blinkSubtitle)
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    Spacer()
                    Toggle("Blink breaks", isOn: $wellness.blinkEnabled)
                        .labelsHidden()
                        .tint(Theme.green)
                }
                if wellness.blinkEnabled {
                    HStack {
                        hourPicker("From", selection: $wellness.blinkStartHour, range: 0...22)
                        Spacer()
                        hourPicker("Until", selection: $wellness.blinkEndHour, range: (wellness.blinkStartHour + 1)...24)
                    }
                }
            }
        }
    }

    private var blinkSubtitle: String {
        guard wellness.blinkEnabled else { return "Off" }
        if let next = wellness.nextBlink() {
            return "Every 20 min · next \(next.formatted(date: .omitted, time: .shortened))"
        }
        return "Every 20 min"
    }

    private func hourPicker(_ label: String, selection: Binding<Int>, range: ClosedRange<Int>) -> some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
            Picker(label, selection: selection) {
                ForEach(Array(range), id: \.self) { hour in
                    Text(String(format: "%02d:00", hour)).tag(hour)
                }
            }
            .pickerStyle(.menu)
            .tint(.white)
        }
    }

    // MARK: Permission

    private var permissionCard: some View {
        MoodCard(color: Theme.red) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Notifications are off")
                    .font(.headline)
                Text("Reminders can't reach you. Turn on notifications for Polarbear in Settings.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                .buttonStyle(PillButtonStyle(color: Theme.red))
            }
        }
    }
}

/// Progress ring that fills as water is logged.
private struct WaterRing: View {
    let progress: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.surface, lineWidth: 10)
            Circle()
                .trim(from: 0, to: min(1, progress))
                .stroke(
                    AngularGradient(colors: [Theme.blue, Theme.green, Theme.blue], center: .center),
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(duration: 0.6), value: progress)
            Image(systemName: progress >= 1 ? "checkmark" : "drop.fill")
                .font(.title2)
                .foregroundStyle(Theme.blue)
        }
    }
}
