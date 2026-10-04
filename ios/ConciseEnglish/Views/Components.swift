import CoreText
import SwiftUI

/// Inter (SIL Open Font License), bundled in Resources/Fonts.
enum Inter {
    /// Registers every bundled .ttf for this process. Call once at launch.
    static func register() {
        let urls = FileManager.default
            .enumerator(at: Bundle.main.bundleURL, includingPropertiesForKeys: nil)?
            .compactMap { $0 as? URL }
            .filter { $0.pathExtension == "ttf" } ?? []
        for url in urls {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }

    static func name(_ weight: Font.Weight, italic: Bool = false) -> String {
        if italic { return "Inter-Italic" }
        switch weight {
        case .medium: return "Inter-Medium"
        case .semibold: return "Inter-SemiBold"
        case .bold: return "Inter-Bold"
        case .heavy, .black: return "Inter-ExtraBold"
        default: return "Inter-Regular"
        }
    }

    static let displayBold = "InterDisplay-Bold"

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
    /// Inter at a system text style's size, scaling with Dynamic Type.
    static func inter(_ style: TextStyle, _ weight: Weight = .regular, italic: Bool = false) -> Font {
        .custom(Inter.name(weight, italic: italic), size: Inter.size(style), relativeTo: style)
    }

    /// Inter Display, tuned for large headings.
    static func interDisplay(_ style: TextStyle) -> Font {
        .custom(Inter.displayBold, size: Inter.size(style), relativeTo: style)
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

/// Dark, warm palette set in Inter: deep ink backgrounds, soft raised
/// cards, and iridescent pearl accents.
enum Theme {
    static let background = Color(hex: 0x12131F)
    static let surface = Color(hex: 0x1C1E2E)
    static let elevated = Color(hex: 0x272A3F)
    static let text = Color(hex: 0xF6F1E9)
    static let muted = Color(hex: 0xA3A6BD)

    /// Pearl lilac: the solid accent for tints, numbers and links.
    static let accent = Color(hex: 0xD3BFF2)

    /// "Pearlence Fur": soft iridescent pastels used as a shimmering gradient.
    enum Pearl {
        static let peach = Color(hex: 0xEFCFC7)
        static let cream = Color(hex: 0xEBDEC6)
        static let mint = Color(hex: 0xC5E6D0)
        static let aqua = Color(hex: 0xBAEBE1)
        static let sky = Color(hex: 0xB8DBE3)
        static let periwinkle = Color(hex: 0xC0C7DD)
        static let lilac = Color(hex: 0xD9C0E2)
        static let blush = Color(hex: 0xEBC2CD)
    }

    static let pearl = LinearGradient(
        colors: [Pearl.peach, Pearl.blush, Pearl.lilac, Pearl.periwinkle, Pearl.sky, Pearl.aqua, Pearl.mint, Pearl.cream],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let headword = Font.interDisplay(.largeTitle)
    static let subheadword = Font.interDisplay(.title2)
    static let partOfSpeech = Font.inter(.subheadline, .bold)
    static let example = Font.inter(.callout, italic: true)

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

/// The iridescent texture behind the Word of the day card (Assets: PearlGradient).
struct PearlSurface: View {
    var body: some View {
        Image("PearlGradient")
            .resizable()
            .scaledToFill()
    }
}

/// Rounded, filled call-to-action button.
struct PillButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.inter(.headline, .semibold))
            .foregroundStyle(Theme.background)
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(Capsule().fill(Theme.pearl))
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
                .font(.inter(.caption, .bold))
                .foregroundStyle(Theme.muted)
                .textCase(.uppercase)
                .tracking(0.6)
            FlowLayout(spacing: 6, lineSpacing: 6) {
                ForEach(words, id: \.self) { word in
                    NavigationLink(value: Lookup(term: word)) {
                        Text(word)
                            .font(.inter(compact ? .subheadline : .body))
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
