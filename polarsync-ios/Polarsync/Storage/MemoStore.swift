import AudioToolbox
import Foundation
import os
import PolarsyncCore

/// A finished, encrypted recording.
struct VoiceMemo: Identifiable, Equatable {
    var id: String { url.lastPathComponent }
    let url: URL
    let date: Date
    let size: Int64
    let duration: TimeInterval?
}

/// File layout and file operations. All methods are synchronous and safe to call off the main thread.
///
/// ```
/// Library/Application Support/Polarsync/       excluded from backup
/// ├── pending/      plain .caf/.m4a of the session being recorded (or left by a crash)
/// └── recordings/   encrypted .psm files
/// ```
///
/// Both folders use `completeUntilFirstUserAuthentication` protection: the files are encrypted by
/// iOS while the phone is off or not yet unlocked once. Stricter `complete` protection would make
/// them unreadable a few seconds after the screen locks, which would break recording with the
/// screen off and saving a session stopped from the Lock Screen.
struct MemoStore {
    let root: URL
    let wrapper: KeyWrapper

    var pendingDir: URL { root.appendingPathComponent("pending", isDirectory: true) }
    var recordingsDir: URL { root.appendingPathComponent("recordings", isDirectory: true) }
    private var installMarker: URL { root.appendingPathComponent(".installed") }

    static let fileProtection: [FileAttributeKey: Any] = [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
    static let plainExtensions: Set<String> = ["caf", "m4a"]

    static var defaultRoot: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Polarsync", isDirectory: true)
    }

    /// Creates the folders, applies file protection and excludes everything from iCloud and
    /// computer backups (recordings couldn't be decrypted elsewhere anyway).
    func prepare() throws {
        let fileManager = FileManager.default
        for dir in [root, pendingDir, recordingsDir] {
            try fileManager.createDirectory(at: dir, withIntermediateDirectories: true, attributes: Self.fileProtection)
            try fileManager.setAttributes(Self.fileProtection, ofItemAtPath: dir.path)
        }
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var rootURL = root
        try rootURL.setResourceValues(values)
    }

    /// Keychain items survive deleting the app, but the recordings don't. On the first launch of a
    /// fresh install, drop the old PIN and master key so deleting the app really is a full reset.
    /// Skipped if any recording exists, so a lost marker can never orphan existing files.
    func resetKeychainIfFreshInstall() {
        let fileManager = FileManager.default
        guard !fileManager.fileExists(atPath: installMarker.path) else { return }
        let hasFiles = [pendingDir, recordingsDir].contains { dir in
            !((try? fileManager.contentsOfDirectory(atPath: dir.path)) ?? []).isEmpty
        }
        if !hasFiles {
            Keychain.deleteAll()
            Logger.security.info("Fresh install: cleared Keychain items from any earlier install")
        }
        fileManager.createFile(atPath: installMarker.path, contents: Data(), attributes: [.protectionKey: FileProtectionType.none])
    }

    /// A new pending file whose name is free both in `pending/` and, once encrypted, in `recordings/`.
    func newPendingURL(fileExtension: String, date: Date = Date()) -> URL {
        let base = Format.recordingBaseName(date)
        var name = base
        var n = 1
        let fileManager = FileManager.default
        while fileManager.fileExists(atPath: pendingDir.appendingPathComponent("\(name).\(fileExtension)").path) ||
            fileManager.fileExists(atPath: encryptedURL(forBaseName: name).path) {
            name = "\(base)_\(n)"
            n += 1
        }
        return pendingDir.appendingPathComponent("\(name).\(fileExtension)")
    }

    func freeBytes() -> Int64 {
        let values = try? root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        return values?.volumeAvailableCapacityForImportantUsage ?? Int64.max
    }

    /// Plain files in `pending/` other than `active`: sessions that were never encrypted.
    func leftovers(excluding active: Set<URL>) -> [URL] {
        let files = (try? FileManager.default.contentsOfDirectory(at: pendingDir, includingPropertiesForKeys: nil)) ?? []
        let activePaths = Set(active.map(\.standardizedFileURL.path))
        return files.filter {
            Self.plainExtensions.contains($0.pathExtension.lowercased()) && !activePaths.contains($0.standardizedFileURL.path)
        }
    }

    /// Encrypts a finished plain recording into `recordings/` and deletes the plain file.
    /// Returns nil (and deletes the file) if it holds no audio.
    @discardableResult
    func encryptPending(_ plain: URL) throws -> URL? {
        let fileManager = FileManager.default
        let attributes = try fileManager.attributesOfItem(atPath: plain.path)
        if ((attributes[.size] as? NSNumber)?.int64Value ?? 0) == 0 {
            try? fileManager.removeItem(at: plain)
            return nil
        }
        let created = (attributes[.creationDate] as? Date) ?? Date()
        let target = encryptedURL(forBaseName: plain.deletingPathExtension().lastPathComponent)
        try EncryptedMemoFormat.encryptFile(at: plain, to: target, wrapper: wrapper, fileAttributes: Self.fileProtection)
        try? fileManager.setAttributes([.creationDate: created, .modificationDate: created], ofItemAtPath: target.path)
        try fileManager.removeItem(at: plain)
        Logger.library.info("Encrypted \(target.lastPathComponent, privacy: .public)")
        return target
    }

    /// Encrypted recordings, newest first. `durations` caches results between calls.
    func listMemos(durations: inout [String: TimeInterval]) -> [VoiceMemo] {
        let keys: [URLResourceKey] = [.creationDateKey, .fileSizeKey]
        let files = (try? FileManager.default.contentsOfDirectory(at: recordingsDir, includingPropertiesForKeys: keys)) ?? []
        return files
            .filter { $0.pathExtension == EncryptedMemoFormat.fileExtension }
            .map { url in
                let values = try? url.resourceValues(forKeys: Set(keys))
                let size = Int64(values?.fileSize ?? 0)
                let cacheKey = "\(url.lastPathComponent)#\(size)"
                if durations[cacheKey] == nil, let duration = readDuration(url) {
                    durations[cacheKey] = duration
                }
                return VoiceMemo(url: url, date: values?.creationDate ?? .distantPast, size: size, duration: durations[cacheKey])
            }
            .sorted { $0.date > $1.date }
    }

    /// The decrypted audio, in memory only.
    func decrypt(_ memo: VoiceMemo) throws -> Data {
        try requireInRecordings(memo.url)
        return try EncryptedMemoFormat.Reader(url: memo.url, wrapper: wrapper).readAll()
    }

    func delete(_ memo: VoiceMemo) throws {
        try requireInRecordings(memo.url)
        try FileManager.default.removeItem(at: memo.url)
    }

    private func encryptedURL(forBaseName name: String) -> URL {
        recordingsDir.appendingPathComponent(name).appendingPathExtension(EncryptedMemoFormat.fileExtension)
    }

    private func requireInRecordings(_ url: URL) throws {
        guard url.standardizedFileURL.deletingLastPathComponent().path == recordingsDir.standardizedFileURL.path else {
            throw CocoaError(.fileReadNoPermission)
        }
    }

    /// Reads the duration through Core Audio, decrypting only the parts of the file it asks for
    /// (normally the first chunk), like Android's `MediaDataSource`.
    private func readDuration(_ url: URL) -> TimeInterval? {
        do {
            let reader = try EncryptedMemoFormat.Reader(url: url, wrapper: wrapper)
            return AudioDuration.of(reader)
        } catch {
            Logger.library.error("Could not open \(url.lastPathComponent, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
}

enum AudioContainer {
    /// Opus is recorded into CAF (`caff` magic), the AAC fallback into MPEG-4.
    static func fileTypeHint(for header: Data) -> String {
        header.prefix(4) == Data("caff".utf8) ? "com.apple.coreaudio-format" : "public.mpeg-4-audio"
    }

    static func audioFileType(for header: Data) -> AudioFileTypeID {
        header.prefix(4) == Data("caff".utf8) ? kAudioFileCAFType : kAudioFileM4AType
    }
}

/// Opens an encrypted recording with `AudioFileOpenWithCallbacks`, so Core Audio reads the
/// plaintext through the chunked reader without a decrypted copy on disk.
enum AudioDuration {
    private final class Source {
        let reader: EncryptedMemoFormat.Reader
        init(_ reader: EncryptedMemoFormat.Reader) { self.reader = reader }
    }

    static func of(_ reader: EncryptedMemoFormat.Reader) -> TimeInterval? {
        guard let header = try? reader.read(at: 0, count: 4) else { return nil }
        let source = Source(reader)
        return withExtendedLifetime(source) {
            var fileID: AudioFileID?
            let status = AudioFileOpenWithCallbacks(
                Unmanaged.passUnretained(source).toOpaque(),
                { clientData, position, requestCount, buffer, actualCount in
                    let source = Unmanaged<Source>.fromOpaque(clientData).takeUnretainedValue()
                    do {
                        let data = try source.reader.read(at: position, count: Int(requestCount))
                        data.copyBytes(to: buffer.assumingMemoryBound(to: UInt8.self), count: data.count)
                        actualCount.pointee = UInt32(data.count)
                        return noErr
                    } catch {
                        actualCount.pointee = 0
                        return kAudioFileUnspecifiedError
                    }
                },
                nil,
                { clientData in
                    Unmanaged<Source>.fromOpaque(clientData).takeUnretainedValue().reader.plaintextLength
                },
                nil,
                AudioContainer.audioFileType(for: header),
                &fileID
            )
            guard status == noErr, let fileID else { return nil }
            defer { AudioFileClose(fileID) }
            var duration: Float64 = 0
            var size = UInt32(MemoryLayout<Float64>.size)
            guard AudioFileGetProperty(fileID, kAudioFilePropertyEstimatedDuration, &size, &duration) == noErr,
                  duration.isFinite, duration > 0 else { return nil }
            return duration
        }
    }
}
