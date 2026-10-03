import SwiftUI

extension Mood {
    var color: Color {
        switch self {
        case .red: Theme.red
        case .yellow: Theme.yellow
        case .blue: Theme.blue
        case .green: Theme.green
        }
    }
}

/// A rounded card with a soft colour wash in one corner.
struct MoodCard<Content: View>: View {
    let color: Color
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(Theme.surface)
                    .overlay(alignment: .topTrailing) {
                        Circle()
                            .fill(color.opacity(0.45))
                            .frame(width: 180, height: 180)
                            .blur(radius: 50)
                            .offset(x: 50, y: -60)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.08))
                    }
            }
    }
}

/// Screen background shared by all tabs.
struct ScreenBackground: View {
    var glow: [Color] = [Theme.yellow, Theme.green]

    var body: some View {
        ZStack(alignment: .top) {
            Theme.background
            MoodGlow(colors: glow)
                .offset(y: -160)
        }
        .ignoresSafeArea()
    }
}

/// Big, filled, capsule-shaped call to action.
struct PillButtonStyle: ButtonStyle {
    var color: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Color.black.opacity(0.85))
            .padding(.vertical, 14)
            .padding(.horizontal, 22)
            .frame(maxWidth: .infinity)
            .background(Capsule().fill(color))
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}
