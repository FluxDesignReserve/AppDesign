import SwiftUI

@main
struct ConciseEnglishApp: App {
    @State private var store = DictionaryStore()
    @State private var library = Library()

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
    @AppStorage(PreferenceKey.appearance) private var appearance = Appearance.system

    var body: some View {
        Group {
            if let error = store.loadError {
                ContentUnavailableView(
                    "Dictionary unavailable",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
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
        .preferredColorScheme(appearance.colorScheme)
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
