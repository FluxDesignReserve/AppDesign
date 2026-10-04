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
                .textSelection(.enabled)
            if let note = page.note {
                Text(note)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
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
                    .foregroundStyle(Color.accentColor)
                Text(accent.shortLabel)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.accentColor)
                if let ipa {
                    Text("/\(ipa)/")
                        .font(.callout)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(Color.accentColor.opacity(0.1)))
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
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(entry.pos.title)
                    .font(Theme.partOfSpeech)
                    .foregroundStyle(Color.accentColor)
                if let distinctIPA {
                    Text("/\(distinctIPA)/")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.bottom, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Color.accentColor.opacity(0.25))
                    .frame(height: 1)
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
                        .font(.subheadline.weight(.medium))
                }
            }
        }
    }
}

private struct SenseRow: View {
    let sense: Sense
    let showExamples: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(sense.number)")
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(Color.accentColor)
                .frame(minWidth: 20, alignment: .trailing)
            VStack(alignment: .leading, spacing: 6) {
                Text(sense.definition)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                if showExamples {
                    ForEach(Array(sense.examples.prefix(3).enumerated()), id: \.offset) { _, example in
                        Text("“\(example)”")
                            .font(Theme.example)
                            .foregroundStyle(.secondary)
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
                                .foregroundStyle(Color.accentColor)
                            Text(item.sense.definition)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        if !item.sense.synonyms.isEmpty {
                            WordChips(title: "Synonyms", words: item.sense.synonyms)
                        }
                        ForEach(item.sense.relations) { group in
                            WordChips(title: group.kind.title, words: group.words)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Theme.cardBackground)
                    )
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
    }
}
