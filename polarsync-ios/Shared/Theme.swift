import SwiftUI

/// Mood-palette theme: a near-black background with four soft, saturated accents
/// (red, yellow, blue, green) and blurred colour glows. Used by the app and the Live Activity.
enum Theme {
    static let background = Color(hex: 0x0E0E14)
    static let surface = Color.white.opacity(0.07)
    static let secondaryText = Color.white.opacity(0.6)

    static let red = Color(hex: 0xFF5C5C)
    static let yellow = Color(hex: 0xFFC83D)
    static let blue = Color(hex: 0x5B8CFF)
    static let green = Color(hex: 0x3DD68C)
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

/// Two blurred colour blobs that slowly drift, drawn behind content.
struct MoodGlow: View {
    let colors: [Color]
    @State private var drift = false

    var body: some View {
        ZStack {
            ForEach(Array(colors.enumerated()), id: \.offset) { index, color in
                Circle()
                    .fill(color)
                    .frame(width: 240, height: 240)
                    .offset(
                        x: (index.isMultiple(of: 2) ? -1 : 1) * (drift ? 70 : 40),
                        y: (index.isMultiple(of: 2) ? -1 : 1) * (drift ? 20 : 50)
                    )
                    .opacity(0.55)
            }
        }
        .blur(radius: 70)
        .animation(.easeInOut(duration: 4).repeatForever(autoreverses: true), value: drift)
        .animation(.easeInOut(duration: 0.8), value: colors)
        .onAppear { drift = true }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
