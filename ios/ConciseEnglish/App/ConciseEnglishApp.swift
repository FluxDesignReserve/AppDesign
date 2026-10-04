import SwiftUI
import UIKit

@main
struct ConciseEnglishApp: App {
    @State private var store = DictionaryStore()
    @State private var library = Library()

    init() {
        Inter.register()
        Self.styleUIKitControls()
    }

    private static func inter(_ name: String, _ style: UIFont.TextStyle) -> UIFont {
        let size = UIFont.preferredFont(forTextStyle: style).pointSize
        guard let font = UIFont(name: name, size: size) else {
            return .preferredFont(forTextStyle: style)
        }
        return UIFontMetrics(forTextStyle: style).scaledFont(for: font)
    }

    /// Navigation titles and segmented controls are UIKit-backed, so they
    /// pick up Inter and the accent colour here.
    private static func styleUIKitControls() {
        let text = UIColor(Theme.text)
        let navigation = UINavigationBarAppearance()
        navigation.configureWithDefaultBackground()
        navigation.largeTitleTextAttributes = [
            .font: inter(Inter.displayBold, .largeTitle), .foregroundColor: text,
        ]
        navigation.titleTextAttributes = [
            .font: inter("Inter-SemiBold", .headline), .foregroundColor: text,
        ]
        UINavigationBar.appearance().standardAppearance = navigation
        UINavigationBar.appearance().compactAppearance = navigation
        let edge = navigation.copy()
        edge.configureWithTransparentBackground()
        edge.largeTitleTextAttributes = navigation.largeTitleTextAttributes
        edge.titleTextAttributes = navigation.titleTextAttributes
        UINavigationBar.appearance().scrollEdgeAppearance = edge

        let segmented = UISegmentedControl.appearance()
        segmented.selectedSegmentTintColor = UIColor(Theme.accent)
        segmented.backgroundColor = UIColor(Theme.surface)
        segmented.setTitleTextAttributes(
            [.font: inter("Inter-Bold", .subheadline), .foregroundColor: UIColor(Theme.background)],
            for: .selected
        )
        segmented.setTitleTextAttributes(
            [.font: inter("Inter-SemiBold", .subheadline), .foregroundColor: UIColor(Theme.muted)],
            for: .normal
        )
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(library)
        }
    }
}

struct RootView: View {
    @Environment(DictionaryStore.self) private var store
    @AppStorage(PreferenceKey.textSize) private var textSize = TextSize.system

    var body: some View {
        Group {
            if let error = store.loadError {
                ContentUnavailableView(
                    "Dictionary unavailable",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
                .background(Theme.background.ignoresSafeArea())
            } else {
                TabView {
                    SearchScreen()
                        .tabItem { Label("Search", systemImage: "magnifyingglass") }
                    FavoritesScreen()
                        .tabItem { Label("Favourites", systemImage: "star") }
                    HistoryScreen()
                        .tabItem { Label("History", systemImage: "clock") }
                    SettingsScreen()
                        .tabItem { Label("Settings", systemImage: "gearshape") }
                }
            }
        }
        .modifier(TextSizeModifier(size: textSize))
        .font(.inter(.body))
        .tint(Theme.accent)
        .preferredColorScheme(.dark)
    }
}

private struct TextSizeModifier: ViewModifier {
    let size: TextSize

    func body(content: Content) -> some View {
        if let dynamicTypeSize = size.dynamicTypeSize {
            content.dynamicTypeSize(dynamicTypeSize)
        } else {
            content
        }
    }
}
