import PolarsyncCore
import SwiftUI
import UIKit

struct RecorderView: View {
    @Environment(RecordingManager.self) private var recorder
    @Environment(MemoLibrary.self) private var library
    @Environment(LockModel.self) private var lock
    @Environment(\.openURL) private var openURL
    @State private var memoToDelete: VoiceMemo?

    var body: some View {
        @Bindable var recorder = recorder
        @Bindable var library = library
        NavigationStack {
            VStack(spacing: 0) {
                controls
                    .padding(.vertical, 32)
                    .background(MoodGlow(colors: glowColors))
                memoList
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Polarsync")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        lock.lock()
                    } label: {
                        Image(systemName: "lock")
                    }
                    .accessibilityLabel("Lock Polarsync")
                }
            }
            .alert(item: $recorder.message) { message in
                alert(for: message)
            }
            .alert(item: $library.message) { message in
                alert(for: message)
            }
            .confirmationDialog(
                "Delete this memo?",
                isPresented: Binding(get: { memoToDelete != nil }, set: { if !$0 { memoToDelete = nil } }),
                titleVisibility: .visible,
                presenting: memoToDelete
            ) { memo in
                Button("Delete", role: .destructive) { library.delete(memo) }
            } message: { _ in
                Text("It can't be recovered.")
            }
        }
        .task { library.reload() }
    }

    private func alert(for message: UserMessage) -> Alert {
        if message.offerSettings {
            return Alert(
                title: Text("Polarsync"),
                message: Text(message.text),
                primaryButton: .default(Text("Open Settings")) {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                },
                secondaryButton: .cancel()
            )
        }
        return Alert(title: Text("Polarsync"), message: Text(message.text))
    }

    // MARK: Recording controls

    private var controls: some View {
        VStack(spacing: 16) {
            TimelineView(.periodic(from: .now, by: 0.5)) { context in
                Text(Format.duration(recorder.clock.elapsed(at: context.date)))
                    .font(.system(size: 56, weight: .light, design: .rounded).monospacedDigit())
                    .foregroundStyle(recorder.phase == .idle ? Theme.secondaryText : .white)
            }
            Text(status)
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)

            HStack(spacing: 20) {
                switch recorder.phase {
                case .idle:
                    Button {
                        Task { await recorder.start() }
                    } label: {
                        Label("Record", systemImage: "mic.fill")
                            .frame(minWidth: 160)
                    }
                    .tint(Theme.red)
                case .recording:
                    Button {
                        recorder.pause()
                    } label: {
                        Label("Pause", systemImage: "pause.fill").frame(minWidth: 110)
                    }
                    .tint(Theme.blue)
                    stopButton
                case .paused:
                    Button {
                        recorder.resume()
                    } label: {
                        Label("Resume", systemImage: "mic.fill").frame(minWidth: 110)
                    }
                    .tint(Theme.green)
                    stopButton
                }
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .font(.headline)
        }
        .frame(maxWidth: .infinity)
    }

    private var stopButton: some View {
        Button {
            recorder.stop()
        } label: {
            Label("Stop", systemImage: "stop.fill").frame(minWidth: 110)
        }
        .tint(Theme.red)
    }

    /// Glow behind the timer: calm green/blue when idle, warm red/yellow while recording, blue when paused.
    private var glowColors: [Color] {
        switch recorder.phase {
        case .idle: return [Theme.green, Theme.blue]
        case .recording: return [Theme.red, Theme.yellow]
        case .paused: return [Theme.blue, Theme.blue]
        }
    }

    private var status: String {
        switch recorder.phase {
        case .recording: return "Recording · \(recorder.profileName ?? "")"
        case .paused: return "Paused"
        case .idle: return recorder.savingCount > 0 ? "Encrypting and saving…" : "Ready"
        }
    }

    // MARK: Memo list

    @ViewBuilder
    private var memoList: some View {
        if library.memos.isEmpty {
            ContentUnavailableView(
                library.isLoading ? "Loading…" : "No recordings yet",
                systemImage: "waveform",
                description: Text(library.isLoading ? "" : "Tap Record to make your first memo. It keeps recording with the screen locked.")
            )
        } else {
            List {
                ForEach(library.memos) { memo in
                    MemoRow(
                        memo: memo,
                        isPlaying: library.playingID == memo.id,
                        canPlay: recorder.phase == .idle,
                        onPlay: { library.togglePlayback(memo) },
                        onDelete: { memoToDelete = memo }
                    )
                    .listRowBackground(Theme.surface)
                    .listRowSeparatorTint(Color.white.opacity(0.08))
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .refreshable { library.reload() }
        }
    }
}

private struct MemoRow: View {
    let memo: VoiceMemo
    let isPlaying: Bool
    let canPlay: Bool
    let onPlay: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            Button(action: onPlay) {
                Image(systemName: isPlaying ? "stop.circle.fill" : "play.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(isPlaying ? Theme.red : Theme.yellow)
            }
            .buttonStyle(.borderless)
            .disabled(!canPlay && !isPlaying)
            .accessibilityLabel(isPlaying ? "Stop" : "Play")

            VStack(alignment: .leading, spacing: 3) {
                Text(memo.date, format: .dateTime.day().month(.abbreviated).year().hour().minute())
                    .font(.body)
                Text("\(memo.duration.map(Format.duration) ?? "–") · \(Format.size(memo.size))")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.secondaryText)
            }
            Spacer()
            Button(role: .destructive, action: onDelete) {
                Image(systemName: "trash")
                    .foregroundStyle(Theme.secondaryText)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Delete")
        }
        .padding(.vertical, 4)
        .swipeActions {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
