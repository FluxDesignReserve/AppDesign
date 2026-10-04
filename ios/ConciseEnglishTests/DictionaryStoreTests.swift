import XCTest
@testable import ConciseEnglish

/// Exercises the main lookup flows against the bundled database only.
/// Nothing here (or in the app) touches the network.
final class DictionaryStoreTests: XCTestCase {
    private static let store = DictionaryStore()
    private var store: DictionaryStore { Self.store }

    private func page(_ term: String, file: StaticString = #filePath, line: UInt = #line) throws -> WordPage {
        guard case .found(let page) = store.lookup(term) else {
            XCTFail("Expected an entry for \(term)", file: file, line: line)
            throw XCTSkip()
        }
        return page
    }

    func testBundledDatabaseLoads() {
        XCTAssertNil(store.loadError)
        XCTAssertGreaterThan(store.wordCount, 100_000)
    }

    func testExactLookupHasDefinitionsAndPronunciation() throws {
        let page = try page("dictionary")
        XCTAssertEqual(page.title, "dictionary")
        XCTAssertNil(page.note)
        let entry = try XCTUnwrap(page.headwords.first?.entries.first)
        XCTAssertEqual(entry.pos, .noun)
        XCTAssertFalse(entry.senses.isEmpty)
        XCTAssertFalse(entry.senses[0].definition.isEmpty)
        XCTAssertNotNil(page.pronunciation(for: .british))
        XCTAssertNotNil(page.pronunciation(for: .american))
    }

    func testLookupIgnoresCaseAccentsAndWhitespace() throws {
        XCTAssertEqual(try page("  Dictionary ").title, "dictionary")
        XCTAssertEqual(SearchKey.fold("Café"), "cafe")
        XCTAssertEqual(SearchKey.fold("don\u{2019}t"), "don't")
    }

    func testIrregularFormsResolveToBaseWord() throws {
        XCTAssertEqual(try page("ran").title, "run")
        XCTAssertEqual(try page("mice").title, "mouse")
        XCTAssertNotNil(try page("went").note)
    }

    func testRegularInflectionsResolveToBaseWord() throws {
        XCTAssertEqual(try page("dictionaries").title, "dictionary")
        XCTAssertEqual(try page("walked").title, "walk")
        XCTAssertEqual(try page("cities").title, "city")
        XCTAssertEqual(try page("hugged").title, "hug")
        XCTAssertEqual(try page("uses").title, "use")
    }

    func testSuggestionsArePrefixMatchesWithExactMatchFirst() {
        let suggestions = store.suggestions(for: "run")
        XCTAssertEqual(suggestions.first?.lemma, "run")
        XCTAssertTrue(suggestions.allSatisfy { $0.key.hasPrefix("run") })
        XCTAssertTrue(store.suggestions(for: "dict").contains { $0.lemma == "dictionary" })
        XCTAssertTrue(store.suggestions(for: "   ").isEmpty)
    }

    func testMisspellingOffersAlternatives() {
        XCTAssertTrue(store.spellingAlternatives(for: "dictionery").contains("dictionary"))
        guard case .notFound(_, let alternatives) = store.lookup("recieve") else {
            return XCTFail("Misspelling should not resolve to an entry")
        }
        XCTAssertTrue(alternatives.contains("receive"))
    }

    func testUnknownWordIsNotFound() {
        guard case .notFound(let query, _) = store.lookup("qzxvwq") else {
            return XCTFail("Expected no entry")
        }
        XCTAssertEqual(query, "qzxvwq")
    }

    func testThesaurusHasSynonymsAndOpposites() throws {
        let happy = try page("happy")
        let senses = happy.thesaurusItems.map(\.sense)
        XCTAssertFalse(senses.isEmpty)
        let opposites = senses.flatMap { $0.relations.filter { $0.kind == .opposite }.flatMap(\.words) }
        XCTAssertTrue(opposites.contains("unhappy"))
        XCTAssertFalse(try page("big").thesaurusItems.flatMap(\.sense.synonyms).isEmpty)
    }

    func testWordOfTheDayIsDeterministic() throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let first = try XCTUnwrap(store.wordOfTheDay(on: date))
        XCTAssertEqual(store.wordOfTheDay(on: date), first)
        XCTAssertNotNil(first.summary)
        XCTAssertNotNil(store.randomWord())
    }

    func testLemmatizerCandidates() {
        XCTAssertTrue(Lemmatizer.candidates(for: "stopped").contains("stop"))
        XCTAssertTrue(Lemmatizer.candidates(for: "cities").contains("city"))
        XCTAssertTrue(Lemmatizer.candidates(for: "go").isEmpty)
    }
}

final class LibraryTests: XCTestCase {
    private var url: URL!

    override func setUp() {
        url = FileManager.default.temporaryDirectory
            .appending(path: "library-\(UUID().uuidString).json")
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: url)
    }

    func testFavoritesAndHistoryPersist() {
        let library = Library(fileURL: url)
        library.record("run")
        library.record("walk")
        library.record("run")
        library.toggleFavorite("walk")

        let reloaded = Library(fileURL: url)
        XCTAssertEqual(reloaded.history.map(\.term), ["run", "walk"])
        XCTAssertTrue(reloaded.isFavorite("walk"))

        reloaded.toggleFavorite("walk")
        reloaded.clearHistory()
        let cleared = Library(fileURL: url)
        XCTAssertTrue(cleared.history.isEmpty)
        XCTAssertFalse(cleared.isFavorite("walk"))
    }
}
