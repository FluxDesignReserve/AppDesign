import Foundation
import Observation

/// Read-only access to the bundled word list. Everything here runs against
/// the local database, so lookups work with no network connection.
@Observable
final class DictionaryStore {
    let loadError: String?
    let wordCount: Int

    private let database: SQLiteDatabase?
    @ObservationIgnored private var dailyWord: (day: Int, word: Suggestion?)?
    @ObservationIgnored private var featuredCount: Int?

    private static let firstDefinitionSQL = """
        (SELECT y.definition FROM entry e
         JOIN sense s ON s.entry_id = e.id
         JOIN synset y ON y.id = s.synset_id
         WHERE e.word_id = w.id ORDER BY e.id, s.ord LIMIT 1)
        """

    init(bundle: Bundle = .main) {
        let path = bundle.path(forResource: "dictionary", ofType: "sqlite")
            ?? bundle.path(forResource: "dictionary", ofType: "sqlite", inDirectory: "Resources")
        guard let path else {
            database = nil
            loadError = "The word list is missing from the app."
            wordCount = 0
            return
        }
        do {
            let database = try SQLiteDatabase(path: path)
            self.database = database
            loadError = nil
            wordCount = database.rows("SELECT count(*) FROM word") { $0.int(0) }.first ?? 0
        } catch {
            database = nil
            loadError = error.localizedDescription
            wordCount = 0
        }
    }

    // MARK: Search

    func suggestions(for text: String, limit: Int = 30) -> [Suggestion] {
        let key = SearchKey.fold(text.trimmingCharacters(in: .whitespacesAndNewlines))
        guard let database, !key.isEmpty else { return [] }
        let rows = database.rows("""
            SELECT w.lemma, w.key, w.score, \(Self.firstDefinitionSQL)
            FROM (SELECT id, lemma, key, score FROM word
                  WHERE key >= ?1 AND key < ?2
                  ORDER BY key = ?1 DESC, score DESC, length(key)
                  LIMIT ?3) AS w
            """, .text(key), .text(SearchKey.prefixUpperBound(key)), .int(limit * 2)
        ) { row in
            (lemma: row.string(0), key: row.string(1), score: row.int(2), summary: row.text(3))
        }
        var seen = Set<String>()
        return rows
            .sorted { ($0.key == key ? 1 : 0, $0.score) > ($1.key == key ? 1 : 0, $1.score) }
            .filter { seen.insert($0.key).inserted }
            .prefix(limit)
            .map { Suggestion(lemma: $0.lemma, key: $0.key, summary: $0.summary) }
    }

    /// Close spellings for a word that isn't in the dictionary.
    func spellingAlternatives(for text: String, limit: Int = 6) -> [String] {
        let key = SearchKey.fold(text.trimmingCharacters(in: .whitespacesAndNewlines))
        guard let database, key.count >= 3, let first = key.first else { return [] }
        let prefix = String(first)
        let candidates = database.rows("""
            SELECT lemma, key, score FROM word
            WHERE key >= ?1 AND key < ?2 AND length(key) BETWEEN ?3 AND ?4 AND score >= 30
            """, .text(prefix), .text(SearchKey.prefixUpperBound(prefix)),
            .int(key.count - 2), .int(key.count + 2)
        ) { row in (lemma: row.string(0), key: row.string(1), score: row.int(2)) }

        let maxDistance = key.count <= 4 ? 1 : 2
        var seen = Set<String>()
        return candidates
            .map { (candidate: $0, distance: editDistance(key, $0.key)) }
            .filter { $0.distance <= maxDistance }
            .sorted { ($0.distance, -$0.candidate.score) < ($1.distance, -$1.candidate.score) }
            .filter { seen.insert($0.candidate.key).inserted }
            .prefix(limit)
            .map { $0.candidate.lemma }
    }

    // MARK: Entries

    func lookup(_ term: String) -> LookupOutcome {
        let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = SearchKey.fold(trimmed)
        guard let database, !key.isEmpty else {
            return .notFound(query: trimmed, alternatives: [])
        }

        if let page = page(forKey: key, note: nil, database: database) {
            return .found(page)
        }

        // Irregular forms recorded in the word list: "ran", "mice", "better".
        let forms = database.rows("""
            SELECT w.lemma, w.key FROM form f JOIN word w ON w.id = f.word_id
            WHERE f.form_key = ? ORDER BY w.score DESC
            """, .text(key)
        ) { (lemma: $0.string(0), key: $0.string(1)) }
        if let base = forms.first,
           let page = page(forKey: base.key, note: formNote(trimmed, base.lemma), database: database) {
            return .found(page)
        }

        // Regular inflections: "dictionaries", "walked", "running".
        var best: (key: String, lemma: String, score: Int)?
        for candidate in Lemmatizer.candidates(for: key) {
            let match = database.rows(
                "SELECT lemma, score FROM word WHERE key = ? ORDER BY score DESC LIMIT 1",
                .text(candidate)
            ) { (lemma: $0.string(0), score: $0.int(1)) }.first
            if let match, match.score > (best?.score ?? .min) {
                best = (candidate, match.lemma, match.score)
            }
        }
        if let best, let page = page(forKey: best.key, note: formNote(trimmed, best.lemma), database: database) {
            return .found(page)
        }

        return .notFound(query: trimmed, alternatives: spellingAlternatives(for: trimmed))
    }

    private func formNote(_ form: String, _ lemma: String) -> String {
        "“\(form)” is a form of \(lemma)"
    }

    private func page(forKey key: String, note: String?, database: SQLiteDatabase) -> WordPage? {
        let words = database.rows(
            "SELECT id, lemma FROM word WHERE key = ? ORDER BY score DESC", .text(key)
        ) { (id: $0.int(0), lemma: $0.string(1)) }
        guard let first = words.first else { return nil }
        let headwords = words.map { headword(id: $0.id, lemma: $0.lemma, database: database) }
        return WordPage(title: first.lemma, note: note, headwords: headwords)
    }

    private func headword(id wordID: Int, lemma: String, database: SQLiteDatabase) -> Headword {
        let entryRows = database.rows(
            "SELECT id, pos, ipa_us, ipa_gb FROM entry WHERE word_id = ? ORDER BY id", .int(wordID)
        ) { (id: $0.int(0), pos: $0.string(1), us: $0.text(2), gb: $0.text(3)) }

        let entries = entryRows.map { row -> Entry in
            let senseRows = database.rows("""
                SELECT s.id, s.synset_id, y.definition, y.examples
                FROM sense s JOIN synset y ON y.id = s.synset_id
                WHERE s.entry_id = ? ORDER BY s.ord
                """, .int(row.id)
            ) { (id: $0.int(0), synset: $0.int(1), definition: $0.string(2), examples: $0.string(3)) }

            let senses = senseRows.enumerated().map { index, sense in
                Sense(
                    id: sense.id,
                    number: index + 1,
                    definition: sense.definition,
                    examples: sense.examples.isEmpty ? [] : sense.examples.components(separatedBy: "\n"),
                    synonyms: synonyms(synset: sense.synset, excludingWord: wordID, database: database),
                    relations: relations(sense: sense.id, synset: sense.synset, lemma: lemma, database: database)
                )
            }
            return Entry(
                id: row.id,
                pos: PartOfSpeech(rawValue: row.pos) ?? .noun,
                ipaUS: row.us,
                ipaGB: row.gb,
                senses: senses
            )
        }
        return Headword(id: wordID, lemma: lemma, entries: entries)
    }

    private func synonyms(synset: Int, excludingWord wordID: Int, database: SQLiteDatabase) -> [String] {
        database.rows("""
            SELECT w.lemma FROM sense s
            JOIN entry e ON e.id = s.entry_id
            JOIN word w ON w.id = e.word_id
            WHERE s.synset_id = ? AND w.id <> ?
            ORDER BY s.member_ord
            """, .int(synset), .int(wordID)
        ) { $0.string(0) }.uniqued()
    }

    private func relations(sense: Int, synset: Int, lemma: String, database: SQLiteDatabase) -> [RelationGroup] {
        let lexical = database.rows("""
            SELECT r.type, w.lemma FROM sense_relation r
            JOIN sense s ON s.id = r.target_sense_id
            JOIN entry e ON e.id = s.entry_id
            JOIN word w ON w.id = e.word_id
            WHERE r.sense_id = ?
            """, .int(sense)
        ) { (type: $0.string(0), word: $0.string(1)) }

        // A related synset is represented by its first member word.
        let semantic = database.rows("""
            SELECT r.type,
                   (SELECT w.lemma FROM sense s
                    JOIN entry e ON e.id = s.entry_id
                    JOIN word w ON w.id = e.word_id
                    WHERE s.synset_id = r.target_synset_id
                    ORDER BY s.member_ord LIMIT 1)
            FROM synset_relation r WHERE r.synset_id = ?
            """, .int(synset)
        ) { (type: $0.string(0), word: $0.string(1)) }

        var grouped: [RelationKind: [String]] = [:]
        for relation in lexical + semantic where !relation.word.isEmpty && relation.word != lemma {
            guard let kind = RelationKind(type: relation.type) else { continue }
            var words = grouped[kind, default: []]
            if !words.contains(relation.word) && words.count < kind.limit {
                words.append(relation.word)
            }
            grouped[kind] = words
        }
        return grouped
            .sorted { $0.key < $1.key }
            .map { RelationGroup(kind: $0.key, words: $0.value) }
    }

    // MARK: Discovery

    func wordOfTheDay(on date: Date = .now) -> Suggestion? {
        let day = Int(Calendar.current.startOfDay(for: date).timeIntervalSince1970 / 86_400)
        if let dailyWord, dailyWord.day == day { return dailyWord.word }
        let word = featuredWord(index: day &* 7_919)
        dailyWord = (day, word)
        return word
    }

    func randomWord() -> String? {
        featuredWord(index: Int.random(in: 0..<Int.max))?.lemma
    }

    private func featuredWord(index: Int) -> Suggestion? {
        guard let database else { return nil }
        let count = featuredCount ?? database.rows("SELECT count(*) FROM word WHERE featured = 1") { $0.int(0) }.first ?? 0
        featuredCount = count
        guard count > 0 else { return nil }
        let offset = ((index % count) + count) % count
        return database.rows("""
            SELECT w.lemma, w.key, \(Self.firstDefinitionSQL)
            FROM (SELECT id, lemma, key FROM word WHERE featured = 1 ORDER BY id LIMIT 1 OFFSET ?) AS w
            """, .int(offset)
        ) { Suggestion(lemma: $0.string(0), key: $0.string(1), summary: $0.text(2)) }.first
    }
}
