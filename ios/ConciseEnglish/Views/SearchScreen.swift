import SwiftUI

struct SearchScreen: View {
    @Environment(DictionaryStore.self) private var store
    @State private var query = ""
    @State private var path: [Lookup] = []
    @State private var suggestions: [Suggestion] = []
    @State private var alternatives: [String] = []

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if trimmedQuery.isEmpty {
                    HomeView { path.append(Lookup(term: $0)) }
                } else if suggestions.isEmpty && alternatives.isEmpty {
                    ContentUnavailableView.search(text: trimmedQuery)
                } else {
                    resultsList
                }
            }
            .navigationTitle("Concise English")
            .searchable(
                text: $query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search words"
            )
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .onSubmit(of: .search) {
                guard !trimmedQuery.isEmpty else { return }
                path.append(Lookup(term: trimmedQuery))
            }
            .task(id: query) { await refresh() }
            .wordDestinations()
        }
    }

    private var resultsList: some View {
        List {
            if suggestions.isEmpty {
                Section("Did you mean") {
                    ForEach(alternatives, id: \.self) { word in
                        NavigationLink(value: Lookup(term: word)) {
                            Text(word)
                        }
                    }
                }
            } else {
                ForEach(suggestions) { suggestion in
                    NavigationLink(value: Lookup(term: suggestion.lemma)) {
                        SuggestionRow(suggestion: suggestion)
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollDismissesKeyboard(.immediately)
    }

    private func refresh() async {
        let text = query
        if !text.isEmpty {
            // Small debounce so fast typing doesn't query on every keystroke.
            try? await Task.sleep(for: .milliseconds(60))
            guard !Task.isCancelled else { return }
        }
        suggestions = store.suggestions(for: text)
        alternatives = suggestions.isEmpty ? store.spellingAlternatives(for: text) : []
    }
}

private struct SuggestionRow: View {
    let suggestion: Suggestion

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(suggestion.lemma)
                .font(.body.weight(.medium))
            if let summary = suggestion.summary {
                Text(summary)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }
}

private struct HomeView: View {
    @Environment(DictionaryStore.self) private var store
    @Environment(Library.self) private var library
    let open: (String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                if let word = store.wordOfTheDay() {
                    WordOfTheDayCard(word: word)
                }

                Button {
                    if let word = store.randomWord() { open(word) }
                } label: {
                    Label("Surprise me", systemImage: "shuffle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)

                if !library.history.isEmpty {
                    WordChips(title: "Recent", words: library.history.prefix(12).map(\.term))
                }

                Label("\(store.wordCount.formatted()) words · works offline", systemImage: "wifi.slash")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .frame(maxWidth: 700)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.immediately)
    }
}

private struct WordOfTheDayCard: View {
    let word: Suggestion

    var body: some View {
        NavigationLink(value: Lookup(term: word.lemma)) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Word of the day")
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.8))
                Text(word.lemma)
                    .font(Theme.headword)
                    .foregroundStyle(.white)
                if let summary = word.summary {
                    Text(summary)
                        .foregroundStyle(.white.opacity(0.92))
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.accentColor.gradient)
            )
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the entry")
    }
}
