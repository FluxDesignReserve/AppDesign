import os
import PolarsyncCore
import SwiftUI

/// Long-lived objects, created once per process.
@MainActor
final class AppEnvironment {
    static let shared = AppEnvironment()

    let lock: LockModel
    let library: MemoLibrary
    let recorder: RecordingManager

    private init() {
        let store = MemoStore(root: MemoStore.defaultRoot, wrapper: KeychainKeyWrapper())
        store.resetKeychainIfFreshInstall()
        do {
            try store.prepare()
        } catch {
            Logger.library.error("Could not prepare folders: \(error.localizedDescription, privacy: .public)")
        }

        lock = LockModel(pins: PinManager(store: KeychainPinStore()))
        library = MemoLibrary(store: store)
        recorder = RecordingManager(store: store, library: library)

        // Live Activity buttons arrive here (LiveActivityIntent runs in the app's process).
        RecordingCommandCenter.handler = { [recorder] command in recorder.handle(command) }
        // A previous run that iOS ended mid-session can't be continued: clear its Live Activity
        // and encrypt whatever it recorded.
        LiveActivityController.endAll()
        recorder.recoverLeftovers()
    }
}

@main
struct PolarsyncApp: App {
    private let env = AppEnvironment.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(env.lock)
                .environment(env.library)
                .environment(env.recorder)
        }
    }
}

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(LockModel.self) private var lock
    @Environment(MemoLibrary.self) private var library

    var body: some View {
        ZStack {
            if lock.unlocked {
                RecorderView()
            } else {
                PinView()
            }
            // Covers the UI whenever the app isn't frontmost, so the app switcher's snapshot
            // shows nothing private.
            if scenePhase != .active {
                PrivacyCover()
            }
        }
        .preferredColorScheme(.dark)
        .tint(Theme.yellow)
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                // Ask for the PIN again on return. Recording, if any, carries on.
                library.stopPlayback()
                lock.lock()
            }
        }
    }
}

private struct PrivacyCover: View {
    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 40))
                Text("Polarsync")
                    .font(.title2.weight(.semibold))
            }
            .foregroundStyle(Theme.secondaryText)
        }
    }
}
