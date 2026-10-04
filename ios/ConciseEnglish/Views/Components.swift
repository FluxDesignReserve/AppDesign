import CoreText
import SwiftUI

/// Bundled typefaces (Resources/Fonts), both under the SIL Open Font License:
/// Alegreya Sans for text and Newsreader Light for titles. Newsreader-Light.ttf
/// is a static instance of Google's Newsreader variable font (wght 300,
/// optical size 36, tuned for headings).
enum Typeface {
    /// Registers every bundled font file for this process. Call once at launch.
    static func register() {
        let urls = FileManager.default
            .enumerator(at: Bundle.main.bundleURL, includingPropertiesForKeys: nil)?
            .compactMap { $0 as? URL }
            .filter { ["ttf", "otf"].contains($0.pathExtension.lowercased()) } ?? []
        for url in urls {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }

    /// The design avoids bold: text is set Light, and anything asking for
    /// more weight (labels, buttons) gets Regular at most.
    static func body(_ weight: Font.Weight, italic: Bool = false) -> String {
        if italic { return "AlegreyaSans-LightItalic" }
        switch weight {
        case .regular, .light, .thin, .ultraLight: return "AlegreyaSans-Light"
        default: return "AlegreyaSans-Regular"
        }
    }

    static let title = "Newsreader-Light"

    /// Default point sizes of the system text styles at standard Dynamic Type.
    static func size(_ style: Font.TextStyle) -> CGFloat {
        switch style {
        case .largeTitle: 34
        case .title: 28
        case .title2: 22
        case .title3: 20
        case .headline, .body: 17
        case .callout: 16
        case .subheadline: 15
        case .footnote: 13
        case .caption: 12
        case .caption2: 11
        default: 17
        }
    }
}

extension Font {
    /// Alegreya Sans at a system text style's size, scaling with Dynamic Type.
    /// Alegreya runs small, so it is set a touch larger than the system size.
    static func alegreya(_ style: TextStyle, _ weight: Weight = .regular, italic: Bool = false) -> Font {
        .custom(Typeface.body(weight, italic: italic), size: Typeface.size(style) * 1.08, relativeTo: style)
    }

    /// Newsreader Light, for titles.
    static func display(_ style: TextStyle) -> Font {
        .custom(Typeface.title, size: Typeface.size(style), relativeTo: style)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// Deep Tyrian background, Siren highlights and bone text.
enum Theme {
    /// Deep Tyrian Purple.
    static let background = Color(hex: 0x250000)
    static let surface = Color(hex: 0x300D0C)
    static let elevated = Color(hex: 0x3C1A18)
    /// Bone.
    static let text = Color(hex: 0xE3DAC9)
    static let muted = Color(hex: 0x9B877D)

    /// Siren: fills for buttons, tags and selected controls.
    static let siren = Color(hex: 0x860038)
    /// A light tint of Siren for text and small marks, legible on the dark
    /// background where Siren itself would be too dark.
    static let accent = Color(hex: 0xE8829F)
    /// Warm amber for the Word of the day card.
    static let amber = Color(hex: 0xF3A33A)

    static let headword = Font.display(.largeTitle)
    static let subheadword = Font.display(.title2)
    static let partOfSpeech = Font.alegreya(.subheadline, .bold)
    static let example = Font.alegreya(.callout, italic: true)

    static let cardRadius: CGFloat = 24
}

extension View {
    /// Full-bleed app background behind scroll views, lists and forms.
    func screenBackground() -> some View {
        scrollContentBackground(.hidden)
            .background(Theme.background.ignoresSafeArea())
    }

    func card(padding: CGFloat = 20) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                    .fill(Theme.surface)
            )
    }
}

/// Rounded, filled call-to-action button.
struct PillButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.alegreya(.headline, .semibold))
            .foregroundStyle(Theme.text)
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(Capsule().fill(Theme.siren))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
    }
}

/// Lays children out left to right, wrapping onto new lines as needed.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(width: proposal.width ?? .infinity, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let arrangement = arrange(width: bounds.width, subviews: subviews)
        for (subview, frame) in zip(subviews, arrangement.frames) {
            subview.place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> (frames: [CGRect], size: CGSize) {
        var frames: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        var maxX: CGFloat = 0
        for subview in subviews {
            var size = subview.sizeThatFits(.unspecified)
            size.width = min(size.width, width)
            if x > 0 && x + size.width > width {
                x = 0
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            maxX = max(maxX, x + size.width)
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return (frames, CGSize(width: maxX, height: y + lineHeight))
    }
}

/// A titled group of tappable words that open their own entries.
struct WordChips: View {
    let title: String
    let words: [String]
    var compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.alegreya(.caption, .bold))
                .foregroundStyle(Theme.muted)
                .textCase(.uppercase)
                .tracking(0.6)
            FlowLayout(spacing: 6, lineSpacing: 6) {
                ForEach(words, id: \.self) { word in
                    NavigationLink(value: Lookup(term: word)) {
                        Text(word)
                            .font(.alegreya(compact ? .subheadline : .body))
                            .padding(.horizontal, compact ? 12 : 14)
                            .padding(.vertical, compact ? 5 : 8)
                            .foregroundStyle(Theme.text)
                            .background(Capsule().fill(Theme.elevated))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

extension View {
    /// The shared destination for every word link inside a navigation stack.
    func wordDestinations() -> some View {
        navigationDestination(for: Lookup.self) { lookup in
            EntryScreen(term: lookup.term)
        }
    }
}
