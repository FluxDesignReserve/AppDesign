import SwiftUI

struct SettingsScreen: View {
    @Environment(DictionaryStore.self) private var store
    @Environment(Library.self) private var library
    @AppStorage(PreferenceKey.accent) private var accent = Accent.british
    @AppStorage(PreferenceKey.speechRate) private var speechRate = 1.0
    @AppStorage(PreferenceKey.autoPronounce) private var autoPronounce = false
    @AppStorage(PreferenceKey.showExamples) private var showExamples = true
    @AppStorage(PreferenceKey.textSize) private var textSize = TextSize.system
    @AppStorage(PreferenceKey.appearance) private var appearance = Appearance.system
    @State private var confirmHistory = false
    @State private var confirmFavorites = false

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Accent", selection: $accent) {
                        ForEach(Accent.allCases) { Text($0.title).tag($0) }
                    }
                    VStack(alignment: .leading) {
                        Text("Speaking speed")
                        Slider(value: $speechRate, in: 0.5...1.5, step: 0.1) {
                            Text("Speaking speed")
                        } minimumValueLabel: {
                            Image(systemName: "tortoise")
                        } maximumValueLabel: {
                            Image(systemName: "hare")
                        }
                    }
                    Toggle("Pronounce words automatically", isOn: $autoPronounce)
                    Button("Play a sample") {
                        Pronouncer.shared.speak("dictionary", accent: accent, rate: speechRate)
                    }
                } header: {
                    Text("Pronunciation")
                } footer: {
                    Text("Uses the voices built into your iPhone, so it works offline. You can download higher-quality voices in the Settings app under Accessibility.")
                }

                Section("Display") {
                    Picker("Text size", selection: $textSize) {
                        ForEach(TextSize.allCases) { Text($0.title).tag($0) }
                    }
                    Picker("Appearance", selection: $appearance) {
                        ForEach(Appearance.allCases) { Text($0.title).tag($0) }
                    }
                    Toggle("Show example sentences", isOn: $showExamples)
                }

                Section("Your words") {
                    Button("Clear history", role: .destructive) { confirmHistory = true }
                        .disabled(library.history.isEmpty)
                    Button("Clear favourites", role: .destructive) { confirmFavorites = true }
                        .disabled(library.favorites.isEmpty)
                }

                Section("About") {
                    LabeledContent("Words", value: store.wordCount.formatted())
                    LabeledContent("Internet connection", value: "Not needed")
                    NavigationLink("Sources and licences") { AboutScreen() }
                    LabeledContent("Version", value: version)
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Clear all history?", isPresented: $confirmHistory, titleVisibility: .visible) {
                Button("Clear history", role: .destructive) { library.clearHistory() }
            }
            .confirmationDialog("Remove all favourites?", isPresented: $confirmFavorites, titleVisibility: .visible) {
                Button("Clear favourites", role: .destructive) { library.clearFavorites() }
            }
        }
    }
}

private struct AboutScreen: View {
    private var notices: String {
        guard let url = Bundle.main.url(forResource: "ThirdPartyNotices", withExtension: "txt"),
              let text = try? String(contentsOf: url, encoding: .utf8)
        else { return "" }
        return text
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Concise English is an independent dictionary and thesaurus. Everything it shows comes from the openly licensed sources below, stored on your device.")
                Text(notices)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
            .padding(20)
        }
        .navigationTitle("Sources and licences")
        .navigationBarTitleDisplayMode(.inline)
    }
}
