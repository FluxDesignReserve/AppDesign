import Foundation

struct Lookup: Hashable {
    let term: String
}

enum PartOfSpeech: String {
    case noun = "n"
    case verb = "v"
    case adjective = "a"
    case adverb = "r"

    var title: String {
        switch self {
        case .noun: "noun"
        case .verb: "verb"
        case .adjective: "adjective"
        case .adverb: "adverb"
        }
    }

    var abbreviation: String {
        switch self {
        case .noun: "n."
        case .verb: "v."
        case .adjective: "adj."
        case .adverb: "adv."
        }
    }
}

enum RelationKind: CaseIterable, Comparable {
    case opposite, similar, broader, narrower, partOf, hasParts, memberOf, hasMembers,
         madeOf, entails, causes, seeAlso, related

    init?(type: String) {
        switch type {
        case "antonym": self = .opposite
        case "similar": self = .similar
        case "hypernym", "instance_hypernym": self = .broader
        case "hyponym", "instance_hyponym": self = .narrower
        case "holo_part", "holo_substance": self = .partOf
        case "mero_part": self = .hasParts
        case "holo_member": self = .memberOf
        case "mero_member": self = .hasMembers
        case "mero_substance": self = .madeOf
        case "entails": self = .entails
        case "causes": self = .causes
        case "also": self = .seeAlso
        case "derivation", "pertainym", "participle", "attribute": self = .related
        default: return nil
        }
    }

    var title: String {
        switch self {
        case .opposite: "Opposites"
        case .similar: "Similar"
        case .broader: "Type of"
        case .narrower: "Types"
        case .partOf: "Part of"
        case .hasParts: "Parts"
        case .memberOf: "Member of"
        case .hasMembers: "Members"
        case .madeOf: "Made of"
        case .entails: "Involves"
        case .causes: "Causes"
        case .seeAlso: "See also"
        case .related: "Related words"
        }
    }

    var limit: Int { self == .narrower || self == .hasMembers ? 24 : 40 }
}

struct RelationGroup: Identifiable {
    let kind: RelationKind
    let words: [String]
    var id: RelationKind { kind }
}

struct Sense: Identifiable {
    let id: Int
    let number: Int
    let definition: String
    let examples: [String]
    let synonyms: [String]
    let relations: [RelationGroup]

    var hasThesaurusContent: Bool { !synonyms.isEmpty || !relations.isEmpty }
}

struct Entry: Identifiable {
    let id: Int
    let pos: PartOfSpeech
    let ipaUS: String?
    let ipaGB: String?
    let senses: [Sense]

    func ipa(for accent: Accent) -> String? {
        accent == .british ? ipaGB : ipaUS
    }
}

struct Headword: Identifiable {
    let id: Int
    let lemma: String
    let entries: [Entry]
}

struct ThesaurusItem: Identifiable {
    let pos: PartOfSpeech
    let sense: Sense
    var id: Int { sense.id }
}

struct WordPage {
    let title: String
    /// Explains how the search was resolved, e.g. "“ran” is a form of run".
    let note: String?
    let headwords: [Headword]

    private var entries: [Entry] { headwords.flatMap(\.entries) }

    func pronunciation(for accent: Accent) -> String? {
        entries.lazy.compactMap { $0.ipa(for: accent) }.first
    }

    var firstDefinition: String? {
        entries.first?.senses.first?.definition
    }

    var thesaurusItems: [ThesaurusItem] {
        entries.flatMap { entry in
            entry.senses
                .filter(\.hasThesaurusContent)
                .map { ThesaurusItem(pos: entry.pos, sense: $0) }
        }
    }

    var shareText: String {
        var text = title
        if let firstDefinition {
            text += " — \(firstDefinition)"
        }
        return text
    }
}

enum LookupOutcome {
    case found(WordPage)
    case notFound(query: String, alternatives: [String])
}

struct Suggestion: Identifiable, Hashable {
    let lemma: String
    let key: String
    let summary: String?
    var id: String { key }
}
