import Foundation

enum SearchKey {
    /// Lowercase, accents removed, typographic apostrophes unified.
    ///
    /// Must stay in sync with `fold` in `Tools/build_dictionary.py`, which
    /// produced the `key` columns this is compared against.
    static func fold(_ text: String) -> String {
        let unified = text
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{2018}", with: "'")
        var scalars = String.UnicodeScalarView()
        for scalar in unified.lowercased().decomposedStringWithCompatibilityMapping.unicodeScalars
        where scalar.properties.canonicalCombiningClass == .notReordered {
            scalars.append(scalar)
        }
        return String(scalars)
    }

    /// Upper bound for a prefix range scan over the `key` index.
    static func prefixUpperBound(_ prefix: String) -> String {
        prefix + "\u{10FFFF}"
    }
}

enum Lemmatizer {
    /// Suffix rules for regular English inflections, in the spirit of
    /// WordNet's morphy. Irregular forms come from the word list itself.
    private static let rules: [(suffix: String, replacement: String)] = [
        ("ies", "y"), ("ied", "y"), ("ier", "y"), ("iest", "y"),
        ("ses", "s"), ("xes", "x"), ("zes", "z"), ("ches", "ch"), ("shes", "sh"),
        ("ves", "f"), ("ves", "fe"), ("men", "man"),
        ("es", "e"), ("es", ""), ("s", ""),
        ("ed", "e"), ("ed", ""), ("ing", "e"), ("ing", ""),
        ("er", "e"), ("er", ""), ("est", "e"), ("est", ""),
        ("'s", ""), ("s'", "s"),
    ]

    static func candidates(for key: String) -> [String] {
        var result: [String] = []
        for rule in rules where key.hasSuffix(rule.suffix) && key.count > rule.suffix.count + 1 {
            result.append(String(key.dropLast(rule.suffix.count)) + rule.replacement)
        }
        // Doubled final consonant: "running" -> "run", "stopped" -> "stop".
        for suffix in ["ing", "ed", "er", "est"] where key.hasSuffix(suffix) {
            let stem = key.dropLast(suffix.count)
            if stem.count >= 3, let last = stem.last, stem.dropLast().last == last {
                result.append(String(stem.dropLast()))
            }
        }
        return result.uniqued()
    }
}

extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

/// Optimal string alignment distance: insertions, deletions, substitutions
/// and swaps of adjacent letters ("recieve" -> "receive") each cost one.
func editDistance(_ a: String, _ b: String) -> Int {
    let a = Array(a), b = Array(b)
    if a.isEmpty { return b.count }
    if b.isEmpty { return a.count }
    var beforePrevious = [Int](repeating: 0, count: b.count + 1)
    var previous = Array(0...b.count)
    var current = [Int](repeating: 0, count: b.count + 1)
    for i in 1...a.count {
        current[0] = i
        for j in 1...b.count {
            let cost = a[i - 1] == b[j - 1] ? 0 : 1
            current[j] = Swift.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            if i > 1, j > 1, a[i - 1] == b[j - 2], a[i - 2] == b[j - 1] {
                current[j] = Swift.min(current[j], beforePrevious[j - 2] + 1)
            }
        }
        (beforePrevious, previous, current) = (previous, current, beforePrevious)
    }
    return previous[b.count]
}
