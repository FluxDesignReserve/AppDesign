import AVFoundation
import Observation
import os
import PolarsyncCore
import UIKit

/// Speech-oriented encoder settings, smallest first. Both are 16 kHz mono, which covers the
/// frequencies that matter for intelligible speech.
struct AudioProfile {
    let name: String
    let fileExtension: String
    let settings: [String: Any]

    /// Opus in CAF, 12 kbps (~90 KB/min): the same codec and rate as Android.
    static let opus = AudioProfile(name: "Opus 12 kbps", fileExtension: "caf", settings: [
        AVFormatIDKey: Int(kAudioFormatOpus),
        AVSampleRateKey: 16_000,
        AVNumberOfChannelsKey: 1,
        AVEncoderBitRateKey: 12_000,
    ])

    /// AAC-LC in MPEG-4, 24 kbps (~180 KB/min). iOS has no AMR-WB encoder, so this stands in for
    /// Android's fallback if Opus can't be configured.
    static let aac = AudioProfile(name: "AAC 24 kbps", fileExtension: "m4a", settings: [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 16_000,
        AVNumberOfChannelsKey: 1,
        AVEncoderBitRateKey: 24_000,
    ])
}

struct UserMessage: Identifiable {
    let id = UUID()
    let text: String
    var offerSettings = false
}

/// Owns the `AVAudioRecorder` and the session lifecycle. One instance per process, on the main actor.
///
/// A session is recorded into `pending/`. On Stop the recorder closes the file, which is then
/// encrypted into `recordings/` in the background and deleted. With `UIBackgroundModes: audio`
/// and an active `.record` session, iOS keeps the app running with the screen locked and shows its
/// own microphone indicator; the Live Activity adds a timer and Pause/Resume/Stop buttons.
@MainActor
@Observable
final class RecordingManager {

    enum Phase: Equatable {
        case idle, recording, paused
    }

    private(set) var phase: Phase = .idle
    private(set) var clock = RecordingClock()
    private(set) var profileName: String?
    /// Sessions being encrypted right now.
    private(set) var savingCount = 0
    var message: UserMessage?

    @ObservationIgnored private let store: MemoStore
    @ObservationIgnored private let library: MemoLibrary
    @ObservationIgnored private let liveActivity = LiveActivityController()
    @ObservationIgnored private let delegate = RecorderDelegate()
    @ObservationIgnored private var recorder: AVAudioRecorder?
    @ObservationIgnored private var currentFile: URL?
    @ObservationIgnored private var encrypting = Set<URL>()
    @ObservationIgnored private var storageTimer: Timer?
    /// True if an interruption (e.g. a phone call) paused us, rather than the user.
    @ObservationIgnored private var pausedByInterruption = false
    @ObservationIgnored private var observers: [NSObjectProtocol] = []

    init(store: MemoStore, library: MemoLibrary) {
        self.store = store
        self.library = library
        delegate.onFinish = { [weak self] successfully in self?.recorderFinished(successfully: successfully) }
        delegate.onError = { [weak self] error in self?.recorderFailed(error) }
        observeAudioSession()
    }

    var isActive: Bool { phase != .idle }

    // MARK: Commands

    func handle(_ command: RecordingCommand) {
        switch command {
        case .pause: pause()
        case .resume: resume()
        case .stop: stop()
        }
    }

    /// Starts a new session. Only ever called from a button tap.
    func start() async {
        guard phase == .idle else { return }

        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            break
        case .undetermined:
            guard await AVAudioApplication.requestRecordPermission() else {
                message = UserMessage(text: "Polarsync needs the microphone to record.", offerSettings: true)
                return
            }
        default:
            message = UserMessage(
                text: "Microphone access is off. Turn it on in Settings → Polarsync → Microphone.",
                offerSettings: true
            )
            return
        }
        guard phase == .idle else { return }

        do {
            try store.prepare()
        } catch {
            Logger.recording.error("Could not prepare folders: \(error.localizedDescription, privacy: .public)")
        }
        guard StoragePolicy.canStart(freeBytes: store.freeBytes()) else {
            message = UserMessage(text: "Not enough free storage to start recording. Free up at least 50 MB.")
            return
        }

        library.stopPlayback()
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            Logger.recording.error("Audio session: \(error.localizedDescription, privacy: .public)")
            message = UserMessage(text: "Could not start the microphone. Is a call or another app using it?")
            return
        }

        // Opus first; AAC if this device or iOS version won't configure it.
        for profile in [AudioProfile.opus, AudioProfile.aac] {
            let url = store.newPendingURL(fileExtension: profile.fileExtension)
            do {
                let recorder = try AVAudioRecorder(url: url, settings: profile.settings)
                recorder.delegate = delegate
                if recorder.prepareToRecord(), recorder.record() {
                    self.recorder = recorder
                    currentFile = url
                    profileName = profile.name
                    break
                }
                recorder.stop()
                _ = recorder.deleteRecording()
                Logger.recording.warning("\(profile.name, privacy: .public) recorder did not start")
            } catch {
                try? FileManager.default.removeItem(at: url)
                Logger.recording.warning("\(profile.name, privacy: .public): \(error.localizedDescription, privacy: .public)")
            }
        }
        guard recorder != nil else {
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            message = UserMessage(text: "Could not start recording. Is another app using the microphone?")
            return
        }

        phase = .recording
        pausedByInterruption = false
        clock = RecordingClock(accumulated: 0, segmentStart: Date())
        startStorageTimer()
        liveActivity.start(activityState)
        Logger.recording.info("Recording started (\(self.profileName ?? "?", privacy: .public))")
    }

    func pause() {
        guard phase == .recording, let recorder else { return }
        recorder.pause()
        clock.pause(at: Date())
        phase = .paused
        pausedByInterruption = false
        liveActivity.update(activityState)
    }

    func resume() {
        guard phase == .paused, let recorder else { return }
        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            Logger.recording.error("Reactivate session: \(error.localizedDescription, privacy: .public)")
        }
        guard recorder.record() else {
            message = UserMessage(text: "Could not resume. Is a call or another app using the microphone?")
            return
        }
        clock.resume(at: Date())
        phase = .recording
        pausedByInterruption = false
        liveActivity.update(activityState)
    }

    /// Finishes the session and encrypts it in the background. Safe to call in any state.
    func stop() {
        guard phase != .idle else { return }
        let file = currentFile
        let elapsed = clock.elapsed(at: Date())
        let recorder = self.recorder
        self.recorder = nil
        currentFile = nil
        recorder?.delegate = nil
        recorder?.stop() // Closes and finalises the file.

        phase = .idle
        clock = RecordingClock(accumulated: elapsed)
        storageTimer?.invalidate()
        storageTimer = nil
        liveActivity.end(activityState)
        clock = RecordingClock()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        Logger.recording.info("Recording stopped after \(Int(elapsed))s")

        if let file { encryptInBackground(file) }
    }

    /// Encrypts sessions left in `pending/` by a crash or by iOS ending the app mid-recording.
    func recoverLeftovers() {
        var active = encrypting
        if let currentFile { active.insert(currentFile) }
        for file in store.leftovers(excluding: active) {
            Logger.recording.info("Recovering \(file.lastPathComponent, privacy: .public)")
            encryptInBackground(file)
        }
    }

    // MARK: Encryption

    private func encryptInBackground(_ file: URL) {
        guard encrypting.insert(file).inserted else { return }
        savingCount += 1
        // Lets the save finish if the session was stopped from the Lock Screen and iOS would
        // otherwise suspend the app as soon as the microphone is released.
        let backgroundTask = BackgroundTask(name: "Encrypt recording")
        let store = self.store
        Task.detached(priority: .userInitiated) {
            let result = Result { try store.encryptPending(file) }
            await MainActor.run {
                self.encrypting.remove(file)
                self.savingCount -= 1
                switch result {
                case .success(.some(_)):
                    break
                case .success(.none):
                    self.message = UserMessage(text: "The recording was too short to save.")
                case .failure(let error):
                    // The plain file stays in pending/ and is retried on the next launch.
                    Logger.recording.error("Encrypt failed: \(error.localizedDescription, privacy: .public)")
                    self.message = UserMessage(text: "Could not save the recording. It will be retried next time Polarsync opens.")
                }
                self.library.reload()
                backgroundTask.end()
            }
        }
    }

    // MARK: Interruptions, route changes, errors

    private func observeAudioSession() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            MainActor.assumeIsolated { self?.handleInterruption(note) }
        })
        observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
            MainActor.assumeIsolated { self?.handleRouteChange(note) }
        })
        observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.handleMediaServicesReset() }
        })
    }

    private func handleInterruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch type {
        case .began:
            // iOS has already paused the recorder (e.g. an incoming call). Keep the file open.
            guard phase == .recording else { return }
            recorder?.pause()
            clock.pause(at: Date())
            phase = .paused
            pausedByInterruption = true
            liveActivity.update(activityState)
            Logger.recording.info("Interrupted; paused")
        case .ended:
            guard phase == .paused, pausedByInterruption else { return }
            let optionsRaw = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            if AVAudioSession.InterruptionOptions(rawValue: optionsRaw).contains(.shouldResume) {
                resume()
                if phase == .recording { Logger.recording.info("Interruption ended; resumed") }
            }
            // Otherwise stay paused: the Live Activity and the app both offer Resume.
        @unknown default:
            break
        }
    }

    private func handleRouteChange(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: raw) else { return }
        let input = AVAudioSession.sharedInstance().currentRoute.inputs.first?.portName ?? "none"
        Logger.recording.info("Route change \(raw), input now \(input, privacy: .public)")
        // A headset mic unplugged mid-session: iOS switches to the built-in mic. Make sure the
        // recorder kept going; if it didn't, restart it so audio isn't silently lost.
        if reason == .oldDeviceUnavailable || reason == .newDeviceAvailable, phase == .recording,
           let recorder, !recorder.isRecording {
            if !recorder.record() {
                pause()
                message = UserMessage(text: "The microphone changed and recording paused. Tap Resume to continue.")
            }
        }
    }

    private func handleMediaServicesReset() {
        guard phase != .idle else { return }
        Logger.recording.error("Media services were reset")
        stop()
        message = UserMessage(text: "iOS reset its audio system, so the recording was stopped and saved.")
    }

    private func recorderFinished(successfully: Bool) {
        // Only reached when iOS ends the recording itself; stop() detaches the delegate first.
        guard phase != .idle else { return }
        stop()
        if !successfully {
            message = UserMessage(text: "Recording stopped unexpectedly. What was captured has been saved.")
        }
    }

    private func recorderFailed(_ error: Error?) {
        Logger.recording.error("Encoder error: \(error?.localizedDescription ?? "unknown", privacy: .public)")
        guard phase != .idle else { return }
        stop()
        message = UserMessage(text: "Recording failed and was stopped. What was captured has been saved.")
    }

    // MARK: Storage

    private func startStorageTimer() {
        storageTimer?.invalidate()
        storageTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.checkStorage() }
        }
    }

    private func checkStorage() {
        guard phase != .idle, StoragePolicy.mustStop(freeBytes: store.freeBytes()) else { return }
        Logger.recording.warning("Storage almost full; stopping")
        stop()
        message = UserMessage(text: "Storage is almost full, so the recording was stopped and saved.")
    }

    private var activityState: RecordingActivityAttributes.ContentState {
        RecordingActivityAttributes.ContentState(accumulated: clock.accumulated, segmentStart: clock.segmentStart)
    }
}

/// `AVAudioRecorderDelegate` needs an NSObject; this forwards to the manager on the main actor.
private final class RecorderDelegate: NSObject, AVAudioRecorderDelegate {
    var onFinish: (@MainActor (Bool) -> Void)?
    var onError: (@MainActor (Error?) -> Void)?

    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        Task { @MainActor in self.onFinish?(flag) }
    }

    func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        Task { @MainActor in self.onError?(error) }
    }
}

/// A `beginBackgroundTask` assertion that ends exactly once, on completion or expiry.
@MainActor
private final class BackgroundTask {
    private var id = UIBackgroundTaskIdentifier.invalid

    init(name: String) {
        id = UIApplication.shared.beginBackgroundTask(withName: name) { [weak self] in
            MainActor.assumeIsolated { self?.end() }
        }
    }

    func end() {
        guard id != .invalid else { return }
        UIApplication.shared.endBackgroundTask(id)
        id = .invalid
    }
}
