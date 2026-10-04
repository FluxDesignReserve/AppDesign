import SwiftUI

enum PreferenceKey {
    static let accent = "accent"
    static let speechRate = "speechRate"
    static let autoPronounce = "autoPronounce"
    static let showExamples = "showExamples"
    static let textSize = "textSize"
}

enum Accent: String, CaseIterable, Identifiable {
    case british = "gb"
    case american = "us"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .british: "British English"
        case .american: "American English"
        }
    }

    var shortLabel: String {
        switch self {
        case .british: "UK"
        case .american: "US"
        }
    }

    var languageCode: String {
        switch self {
        case .british: "en-GB"
        case .american: "en-US"
        }
    }
}

enum TextSize: String, CaseIterable, Identifiable {
    case system, small, standard, large, extraLarge, huge

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: "Match iPhone"
        case .small: "Small"
        case .standard: "Standard"
        case .large: "Large"
        case .extraLarge: "Extra large"
        case .huge: "Huge"
        }
    }

    var dynamicTypeSize: DynamicTypeSize? {
        switch self {
        case .system: nil
        case .small: .small
        case .standard: .large
        case .large: .xLarge
        case .extraLarge: .xxLarge
        case .huge: .xxxLarge
        }
    }
}
