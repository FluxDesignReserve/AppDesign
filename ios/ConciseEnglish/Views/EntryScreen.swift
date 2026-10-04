import SwiftUI

private enum EntryMode: Hashable {
    case dictionary, thesaurus
}

struct EntryScreen: View {
    let term: String

    @Environment(DictionaryStore.self) private var store
    @Environment(Library.self) private var library
    @AppStorage(PreferenceKey.accent) private var accent = Accent.british
    @AppStorage(PreferenceKey.speechRate) private var speechRate = 1.0
    @AppStorage(PreferenceKey.autoPronounce) private var autoPronounce = false
    @State private var outcome: LookupOutcome?
    @State private var mode = EntryMode.dictionary

    var body: some View {
        Group {
            switch outcome {
            case nil:
                ProgressView()
            case .some(.found(let page)):
                pageView(page)
            case .some(.notFound(let query, let alternatives)):
                NotFoundView(query: query, alternatives: alternatives)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: term) { load() }
    }

    private func load() {
        let result = store.lookup(term)
        outcome = result
        if case .found(let page) = result {
            library.record(page.title)
            if autoPronounce {
                Pronouncer.shared.speak(page.title, accent: accent, rate: speechRate)
            }
        }
    }

    private func pageView(_ page: WordPage) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                EntryHeader(page: page, preferred: accent) { spoken in
                    Pronouncer.shared.speak(page.title, accent: spoken, rate: speechRate)
                }

                Picker("View", selection: $mode) {
                    Text("Dictionary").tag(EntryMode.dictionary)
                    Text("Thesaurus").tag(EntryMode.thesaurus)
                }
                .pickerStyle(.segmented)

                switch mode {
                case .dictionary:
                    DefinitionsView(page: page, accent: accent)
                case .thesaurus:
                    ThesaurusView(page: page)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .frame(maxWidth: 700, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .screenBackground()
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                ShareLink(item: page.shareText) {
                    Image(systemName: "square.and.arrow.up")
                }
                let saved = library.isFavorite(page.title)
                Button {
                    library.toggleFavorite(page.title)
                } label: {
                    Image(systemName: saved ? "star.fill" : "star")
                }
                .accessibilityLabel(saved ? "Remove from favourites" : "Add to favourites")
            }
        }
    }
}

private struct EntryHeader: View {
    let page: WordPage
    let preferred: Accent
    let speak: (Accent) -> Void

    private var accents: [Accent] {
        preferred == .british ? [.british, .american] : [.american, .british]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(page.title)
                .font(Theme.headword)
                .foregroundStyle(Theme.text)
                .textSelection(.enabled)
            if let note = page.note {
                Text(note)
                    .font(.inter(.subheadline))
                    .foregroundStyle(Theme.muted)
            }
            FlowLayout(spacing: 8, lineSpacing: 8) {
                ForEach(accents) { accent in
                    PronunciationButton(accent: accent, ipa: page.pronunciation(for: accent)) {
                        speak(accent)
                    }
                }
            }
        }
    }
}

private struct PronunciationButton: View {
    let accent: Accent
    let ipa: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "speaker.wave.2.fill")
                    .font(.inter(.caption, .bold))
                    .foregroundStyle(Theme.background)
                    .frame(width: 26, height: 26)
                    .background(Circle().fill(Theme.accent))
                Text(accent.shortLabel)
                    .font(.inter(.caption, .heavy))
                    .foregroundStyle(Theme.accent)
                if let ipa {
                    Text("/\(ipa)/")
                        .font(.inter(.callout))
                        .foregroundStyle(Theme.text)
                }
            }
            .padding(.leading, 5)
            .padding(.trailing, 14)
            .padding(.vertical, 5)
            .background(Capsule().fill(Theme.surface))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Play \(accent.title) pronunciation")
    }
}

private struct DefinitionsView: View {
    let page: WordPage
    let accent: Accent
    @AppStorage(PreferenceKey.showExamples) private var showExamples = true

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            ForEach(page.headwords) { headword in
                VStack(alignment: .leading, spacing: 28) {
                    if page.headwords.count > 1 {
                        Text(headword.lemma)
                            .font(Theme.subheadword)
                            .foregroundStyle(Theme.text)
                    }
                    ForEach(headword.entries) { entry in
                        let ipa = entry.ipa(for: accent)
                        EntrySection(
                            entry: entry,
                            distinctIPA: ipa == page.pronunciation(for: accent) ? nil : ipa,
                            showExamples: showExamples
                        )
                    }
                }
            }
        }
    }
}

private struct EntrySection: View {
    let entry: Entry
    let distinctIPA: String?
    let showExamples: Bool

    @State private var expanded = false
    private let collapsedCount = 6

    private var visibleSenses: ArraySlice<Sense> {
        expanded ? entry.senses[...] : entry.senses.prefix(collapsedCount)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(entry.pos.title)
                    .font(Theme.partOfSpeech)
                    .foregroundStyle(Theme.background)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Theme.accent))
                if let distinctIPA {
                    Text("/\(distinctIPA)/")
                        .font(.inter(.callout))
                        .foregroundStyle(Theme.muted)
                }
            }

            ForEach(visibleSenses) { sense in
                SenseRow(sense: sense, showExamples: showExamples)
            }

            let hidden = entry.senses.count - collapsedCount
            if !expanded && hidden > 0 {
                Button {
                    withAnimation(.snappy) { expanded = true }
                } label: {
                    Label("Show \(hidden) more \(hidden == 1 ? "sense" : "senses")", systemImage: "chevron.down")
                        .font(.inter(.subheadline, .bold))
                        .foregroundStyle(Theme.accent)
                }
            }
        }
    }
}

private struct SenseRow: View {
    let sense: Sense
    let showExamples: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Text("\(sense.number)")
                .font(.inter(.caption, .heavy).monospacedDigit())
                .foregroundStyle(Theme.accent)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Theme.elevated))
            VStack(alignment: .leading, spacing: 8) {
                Text(sense.definition)
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                    .padding(.top, 3)
                if showExamples {
                    ForEach(Array(sense.examples.prefix(3).enumerated()), id: \.offset) { _, example in
                        Text("“\(example)”")
                            .font(Theme.example)
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                if !sense.synonyms.isEmpty {
                    WordChips(title: "Synonyms", words: Array(sense.synonyms.prefix(8)), compact: true)
                        .padding(.top, 2)
                }
            }
        }
    }
}

private struct ThesaurusView: View {
    let page: WordPage

    var body: some View {
        let items = page.thesaurusItems
        if items.isEmpty {
            ContentUnavailableView(
                "No thesaurus entries",
                systemImage: "text.book.closed",
                description: Text("There are no synonyms or related words for \(page.title).")
            )
        } else {
            LazyVStack(alignment: .leading, spacing: 14) {
                ForEach(items) { item in
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(item.pos.abbreviation)
                                .font(Theme.partOfSpeech)
                                .foregroundStyle(Theme.accent)
                            Text(item.sense.definition)
                                .font(.inter(.subheadline))
                                .foregroundStyle(Theme.muted)
                                .lineLimit(2)
                        }
                        if !item.sense.synonyms.isEmpty {
                            WordChips(title: "Synonyms", words: item.sense.synonyms)
                        }
                        ForEach(item.sense.relations) { group in
                            WordChips(title: group.kind.title, words: group.words)
                        }
                    }
                    .card()
                }
            }
        }
    }
}

private struct NotFoundView: View {
    let query: String
    let alternatives: [String]

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                ContentUnavailableView(
                    "No entry for “\(query)”",
                    systemImage: "character.book.closed",
                    description: Text(alternatives.isEmpty
                        ? "Check the spelling, or try a related word."
                        : "Did you mean one of these?")
                )
                if !alternatives.isEmpty {
                    WordChips(title: "Suggestions", words: alternatives)
                        .padding(.horizontal, 20)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.top, 40)
        }
        .screenBackground()
    }
}
