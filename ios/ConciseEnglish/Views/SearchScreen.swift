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
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Theme.background.ignoresSafeArea())
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
            #if DEBUG
            .onAppear {
                // Screenshot hook: `-openWord happy` opens that entry on launch.
                if path.isEmpty, let word = UserDefaults.standard.string(forKey: "openWord") {
                    path = [Lookup(term: word)]
                }
            }
            #endif
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
                        .listRowBackground(Theme.background)
                    }
                }
            } else {
                ForEach(suggestions) { suggestion in
                    NavigationLink(value: Lookup(term: suggestion.lemma)) {
                        SuggestionRow(suggestion: suggestion)
                    }
                    .listRowBackground(Theme.background)
                    .listRowSeparatorTint(Theme.elevated)
                }
            }
        }
        .listStyle(.plain)
        .screenBackground()
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
                .font(.inter(.body, .semibold))
                .foregroundStyle(Theme.text)
            if let summary = suggestion.summary {
                Text(summary)
                    .font(.inter(.footnote))
                    .foregroundStyle(Theme.muted)
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
                VStack(alignment: .leading, spacing: 4) {
                    Text(greeting)
                        .font(.inter(.title2, .bold))
                        .foregroundStyle(Theme.text)
                    Text("What word are you curious about today?")
                        .foregroundStyle(Theme.muted)
                }

                if let word = store.wordOfTheDay() {
                    WordOfTheDayCard(word: word)
                }

                Button {
                    if let word = store.randomWord() { open(word) }
                } label: {
                    Label("Surprise me", systemImage: "sparkles")
                }
                .buttonStyle(PillButtonStyle())

                if !library.history.isEmpty {
                    WordChips(title: "Recent", words: library.history.prefix(12).map(\.term))
                }

                Label("\(store.wordCount.formatted()) words · works offline", systemImage: "wifi.slash")
                    .font(.inter(.footnote))
                    .foregroundStyle(Theme.muted)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .frame(maxWidth: 700)
            .frame(maxWidth: .infinity)
        }
        .screenBackground()
        .scrollDismissesKeyboard(.immediately)
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: .now) {
        case 5..<12: "Good morning"
        case 12..<18: "Good afternoon"
        default: "Good evening"
        }
    }
}

private struct WordOfTheDayCard: View {
    let word: Suggestion

    var body: some View {
        NavigationLink(value: Lookup(term: word.lemma)) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Word of the day")
                    .font(.inter(.caption, .heavy))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.background.opacity(0.7))
                Text(word.lemma)
                    .font(Theme.headword)
                    .foregroundStyle(Theme.background)
                if let summary = word.summary {
                    Text(summary)
                        .foregroundStyle(Theme.background.opacity(0.85))
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                }
                Label("Explore", systemImage: "arrow.right")
                    .font(.inter(.subheadline, .bold))
                    .foregroundStyle(Theme.text)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Theme.background))
                    .padding(.top, 6)
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                ZStack {
                    LinearGradient(
                        colors: [Theme.sunshine, Theme.accent],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    Circle()
                        .fill(Theme.coral.opacity(0.55))
                        .frame(width: 180, height: 180)
                        .offset(x: 140, y: 70)
                    Circle()
                        .fill(Theme.sunshine.opacity(0.6))
                        .frame(width: 90, height: 90)
                        .offset(x: 150, y: -80)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the entry")
    }
}
