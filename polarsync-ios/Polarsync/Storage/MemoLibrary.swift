import AVFoundation
import Observation
import os
import PolarsyncCore

/// The memo list and playback.
///
/// Playback decrypts the whole memo into memory and plays it with `AVAudioPlayer(data:)`, so no
/// decrypted copy ever touches the disk (as on Android). At 12 kbps an hour of audio is about
/// 5 MB, so even very long memos fit comfortably in memory. A temp-file approach would need a
/// plaintext file on disk, however briefly, and cleanup after crashes.
@MainActor
@Observable
final class MemoLibrary {

    private(set) var memos: [VoiceMemo] = []
    private(set) var playingID: VoiceMemo.ID?
    private(set) var isLoading = false
    var message: UserMessage?

    @ObservationIgnored private let store: MemoStore
    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private let delegate = PlayerDelegate()
    @ObservationIgnored private var durations: [String: TimeInterval] = [:]
    @ObservationIgnored private var reloadTask: Task<Void, Never>?
    @ObservationIgnored private var playTask: Task<Void, Never>?

    init(store: MemoStore) {
        self.store = store
        delegate.onFinish = { [weak self] in self?.stopPlayback() }
    }

    func reload() {
        reloadTask?.cancel()
        isLoading = true
        let store = self.store
        let cached = durations
        reloadTask = Task {
            let (memos, durations) = await Task.detached(priority: .userInitiated) {
                var durations = cached
                let memos = store.listMemos(durations: &durations)
                return (memos, durations)
            }.value
            guard !Task.isCancelled else { return }
            self.memos = memos
            self.durations = durations
            self.isLoading = false
        }
    }

    func togglePlayback(_ memo: VoiceMemo) {
        if playingID == memo.id {
            stopPlayback()
        } else {
            play(memo)
        }
    }

    func play(_ memo: VoiceMemo) {
        stopPlayback()
        playingID = memo.id
        let store = self.store
        playTask = Task {
            do {
                let data = try await Task.detached(priority: .userInitiated) { try store.decrypt(memo) }.value
                guard !Task.isCancelled, playingID == memo.id else { return }
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .spokenAudio)
                try session.setActive(true)
                let player = try AVAudioPlayer(data: data, fileTypeHint: AudioContainer.fileTypeHint(for: data))
                player.delegate = delegate
                guard player.play() else { throw CocoaError(.featureUnsupported) }
                self.player = player
            } catch {
                Logger.library.error("Playback failed: \(error.localizedDescription, privacy: .public)")
                if playingID == memo.id { stopPlayback() }
                message = UserMessage(text: "Could not play this memo. It may be damaged.")
            }
        }
    }

    func stopPlayback() {
        playTask?.cancel()
        playTask = nil
        let wasPlaying = player != nil
        player?.stop()
        player = nil // Drops the decrypted audio.
        playingID = nil
        if wasPlaying {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    func delete(_ memo: VoiceMemo) {
        if playingID == memo.id { stopPlayback() }
        do {
            try store.delete(memo)
            memos.removeAll { $0.id == memo.id }
        } catch {
            Logger.library.error("Delete failed: \(error.localizedDescription, privacy: .public)")
            message = UserMessage(text: "Could not delete this memo.")
        }
    }
}

private final class PlayerDelegate: NSObject, AVAudioPlayerDelegate {
    var onFinish: (@MainActor () -> Void)?

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.onFinish?() }
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor in self.onFinish?() }
    }
}
