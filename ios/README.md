# Concise English (iOS)

An offline English dictionary and thesaurus for iPhone and iPad, built with
SwiftUI and no third-party dependencies. See `DESIGN.md` for the screen
inventory, navigation, features, data model and plan.

## Run it on your iPhone (free Apple ID)

1. Clone this repository on your Mac, or pull the latest changes if you already have it.
2. Open `ios/ConciseEnglish.xcodeproj` in Xcode 26 or newer (iOS 26 devices need Xcode 26).
3. Click the **ConciseEnglish** project, then the **ConciseEnglish** target, then
   **Signing & Capabilities**. Choose your Apple ID under **Team**. If you don't
   see one, add it in Xcode › Settings › Accounts.
4. If Xcode says the bundle identifier is unavailable, change
   `com.fluxdesignreserve.conciseenglish` to something unique, for example
   `com.yourname.conciseenglish`.
5. Plug in the iPhone, select it at the top of the Xcode window, and press **Run** (⌘R).
6. The first time, on the iPhone go to Settings › General › VPN & Device
   Management, tap your Apple ID and choose **Trust**.

With a free Apple ID the app stops opening after 7 days. Press Run again from
Xcode to reinstall it; your favourites and history are kept.

## Offline check

Turn on Airplane Mode, then:

1. Type "dict" and confirm suggestions appear. Open **dictionary**.
2. Tap the UK and US play buttons. If no sound plays, the voice isn't downloaded:
   go to Settings › Accessibility and download an English voice under Spoken Content › Voices.
3. Switch to **Thesaurus** and tap a synonym. Its entry should open.
4. Search "ran". It should open **run** with a "form of" note.
5. Search "recieve". It should offer **receive**.
6. Star a word and check it appears in **Favourites**. Check **History** lists your lookups.
7. Force-quit the app, reopen it while still offline, and confirm the favourites and history are still there.

## Tests

In Xcode press ⌘U, or from the command line:

```bash
cd ios
xcodebuild test -project ConciseEnglish.xcodeproj -scheme ConciseEnglish \
  -destination 'platform=iOS Simulator,name=iPhone 17'
```

GitHub Actions (`.github/workflows/ios.yml`) runs the same tests on every push.

## Rebuilding the word list

```bash
python3 ios/Tools/build_dictionary.py
```

This downloads Open English WordNet and the CMU Pronouncing Dictionary into
`ios/Tools/.cache/` (only needed when rebuilding, never by the app) and
rewrites `ios/ConciseEnglish/Resources/dictionary.sqlite`.
