import SwiftUI

private enum FavoriteSort: String, CaseIterable, Identifiable {
    case recent, alphabetical
    var id: String { rawValue }
    var title: String { self == .recent ? "Recently added" : "A–Z" }
}

struct FavoritesScreen: View {
    @Environment(Library.self) private var library
    @State private var sort = FavoriteSort.recent

    private var items: [SavedWord] {
        switch sort {
        case .recent:
            library.favorites
        case .alphabetical:
            library.favorites.sorted {
                $0.term.localizedCaseInsensitiveCompare($1.term) == .orderedAscending
            }
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if library.favorites.isEmpty {
                    ContentUnavailableView(
                        "No favourites yet",
                        systemImage: "star",
                        description: Text("Tap the star on any entry to keep it here.")
                    )
                } else {
                    List {
                        ForEach(items) { item in
                            NavigationLink(value: Lookup(term: item.term)) {
                                Text(item.term)
                            }
                            .listRowBackground(Theme.surface)
                            .swipeActions {
                                Button(role: .destructive) {
                                    library.removeFavorite(item.term)
                                } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .screenBackground()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Favourites")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if !library.favorites.isEmpty {
                        Menu {
                            Picker("Sort", selection: $sort) {
                                ForEach(FavoriteSort.allCases) { Text($0.title).tag($0) }
                            }
                        } label: {
                            Label("Sort", systemImage: "arrow.up.arrow.down")
                        }
                    }
                }
            }
            .wordDestinations()
        }
    }
}

struct HistoryScreen: View {
    @Environment(Library.self) private var library
    @State private var confirmClear = false

    private struct DaySection: Identifiable {
        let day: Date
        let items: [SavedWord]
        var id: Date { day }
    }

    private var sections: [DaySection] {
        let calendar = Calendar.current
        return Dictionary(grouping: library.history) { calendar.startOfDay(for: $0.date) }
            .map { DaySection(day: $0.key, items: $0.value) }
            .sorted { $0.day > $1.day }
    }

    private func title(for day: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(day) { return "Today" }
        if calendar.isDateInYesterday(day) { return "Yesterday" }
        return day.formatted(date: .abbreviated, time: .omitted)
    }

    var body: some View {
        NavigationStack {
            Group {
                if library.history.isEmpty {
                    ContentUnavailableView(
                        "No history",
                        systemImage: "clock",
                        description: Text("Words you look up appear here.")
                    )
                } else {
                    List {
                        ForEach(sections) { section in
                            Section(title(for: section.day)) {
                                ForEach(section.items) { item in
                                    NavigationLink(value: Lookup(term: item.term)) {
                                        Text(item.term)
                                    }
                                    .listRowBackground(Theme.surface)
                                    .swipeActions {
                                        Button(role: .destructive) {
                                            library.removeFromHistory(item)
                                        } label: {
                                            Label("Delete", systemImage: "trash")
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .screenBackground()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("History")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if !library.history.isEmpty {
                        Button("Clear") { confirmClear = true }
                    }
                }
            }
            .confirmationDialog("Clear all history?", isPresented: $confirmClear, titleVisibility: .visible) {
                Button("Clear history", role: .destructive) { library.clearHistory() }
            }
            .wordDestinations()
        }
    }
}
