import Foundation
import Observation

struct SavedWord: Codable, Hashable, Identifiable {
    var term: String
    var date: Date
    var id: String { term }
}

/// The user's search history and favourites, stored as JSON on the device.
@Observable
final class Library {
    private(set) var history: [SavedWord] = []
    private(set) var favorites: [SavedWord] = []

    @ObservationIgnored private let fileURL: URL
    private static let historyLimit = 500

    private struct Snapshot: Codable {
        var history: [SavedWord]
        var favorites: [SavedWord]
    }

    init(fileURL: URL = URL.applicationSupportDirectory.appending(path: "library.json")) {
        self.fileURL = fileURL
        if let data = try? Data(contentsOf: fileURL),
           let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data) {
            history = snapshot.history
            favorites = snapshot.favorites
        }
    }

    func record(_ term: String) {
        history.removeAll { $0.term == term }
        history.insert(SavedWord(term: term, date: .now), at: 0)
        if history.count > Self.historyLimit {
            history.removeLast(history.count - Self.historyLimit)
        }
        save()
    }

    func removeFromHistory(_ item: SavedWord) {
        history.removeAll { $0 == item }
        save()
    }

    func clearHistory() {
        history.removeAll()
        save()
    }

    func isFavorite(_ term: String) -> Bool {
        favorites.contains { $0.term == term }
    }

    func toggleFavorite(_ term: String) {
        if isFavorite(term) {
            favorites.removeAll { $0.term == term }
        } else {
            favorites.insert(SavedWord(term: term, date: .now), at: 0)
        }
        save()
    }

    func removeFavorite(_ term: String) {
        favorites.removeAll { $0.term == term }
        save()
    }

    func clearFavorites() {
        favorites.removeAll()
        save()
    }

    private func save() {
        let snapshot = Snapshot(history: history, favorites: favorites)
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        try? FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? data.write(to: fileURL, options: .atomic)
    }
}
