import SwiftUI

enum Theme {
    static let headword = Font.system(.largeTitle, design: .serif).weight(.semibold)
    static let subheadword = Font.system(.title2, design: .serif).weight(.semibold)
    static let partOfSpeech = Font.system(.title3, design: .serif).italic()
    static let example = Font.system(.callout, design: .serif).italic()
    static let cardBackground = Color(uiColor: .secondarySystemBackground)
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
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            FlowLayout(spacing: 6, lineSpacing: 6) {
                ForEach(words, id: \.self) { word in
                    NavigationLink(value: Lookup(term: word)) {
                        Text(word)
                            .font(compact ? .subheadline : .body)
                            .padding(.horizontal, compact ? 10 : 12)
                            .padding(.vertical, compact ? 4 : 6)
                            .foregroundStyle(Color.accentColor)
                            .background(Capsule().fill(Color.accentColor.opacity(0.1)))
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
