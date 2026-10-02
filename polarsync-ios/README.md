# Polarsync for iPhone

An open-source, encrypted voice-memo recorder for iPhone (iOS 17 or newer), written in Swift with
SwiftUI. It's the iOS version of the [Android app](../polarsync/README.md) and uses the same
security design.

- **A 4-digit PIN opens the app.** You create it on first launch. The app asks for it again every
  time you come back to it. Too many wrong guesses trigger lockouts that grow from 30 s up to 1 h.
- **Recordings are encrypted on the phone.** Each recording is sealed with AES-256-GCM using its
  own key, and that key is encrypted with a master key kept in the iPhone's Keychain. Files copied
  off the phone can't be played.
- **It keeps recording with the screen locked.** iOS shows its orange microphone dot, and a Live
  Activity on the Lock Screen and in the Dynamic Island shows the timer with **Pause / Resume** and
  **Stop** buttons.
- **Recordings are tiny.** Opus, mono, 16 kHz, 12 kbps: about 90 KB per minute, or roughly 5 MB per
  hour. If Opus can't be set up, it falls back to AAC at 24 kbps.
- **Recording only starts when you tap Record.**
- **The app-switcher preview is hidden** behind a plain cover.

## Security model

| What | How |
|---|---|
| PIN | Only a salted PBKDF2-HMAC-SHA256 hash (120,000 iterations, CommonCrypto) is stored, in the Keychain, never the PIN itself. Comparison is constant-time. After 5 wrong guesses, lockouts start at 30 s and double each time, up to 1 h. The lockout survives restarting the app. |
| Recordings at rest | Format `.psm`, byte-for-byte the same layout as Android: a fresh random AES-256 data key per file, wrapped (AES-GCM) by a master key. Audio is stored in 64 KB AES-GCM chunks (CryptoKit). The header and chunk number are authenticated with every chunk, so changing, reordering, swapping or cutting off part of a file is detected. |
| Master key | A random 256-bit key in the Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`: never synced to iCloud Keychain and never restored to another phone. |
| While recording | `AVAudioRecorder` writes a plain audio file to `Library/Application Support/Polarsync/pending/`. On **Stop**, it's encrypted into `recordings/` and the plain file is deleted. If the app is ended mid-recording, the leftover file is encrypted the next time Polarsync opens. |
| File protection | Both folders use iOS Data Protection class `completeUntilFirstUserAuthentication`, so they're encrypted by iOS until you unlock the phone once after a restart. The stricter `complete` class would lock the files seconds after the screen locks, which would break recording with the screen off. |
| Playback | The memo is decrypted into memory and played with `AVAudioPlayer(data:)`. No decrypted copy is ever written to disk. An hour of audio is only ~5 MB, so memory isn't a concern. |
| Backups | The whole Polarsync folder is excluded from iCloud and computer backups. Keychain items are `ThisDeviceOnly`. |
| Screen privacy | A cover hides the app whenever it isn't in front, so the app switcher's snapshot shows nothing. |

**Limits to be aware of:**

- **The PIN locks the app; it isn't the encryption key.** Four digits would be far too easy to
  guess if they protected the files directly. File security comes from the Keychain master key.
- **iOS has no hardware-locked AES key like Android Keystore's.** The iPhone's Secure Enclave
  only holds elliptic-curve keys, so the master key is a Keychain item. The Keychain is itself
  encrypted with a key that the Secure Enclave controls, but while Polarsync runs, the master key is
  in the app's memory.
- **The lockout uses the phone's clock.** Changing the date can shorten a lockout. The app only
  locks the screen of Polarsync; the iPhone passcode is the real line of defence.
- **Screenshots aren't blocked.** iOS doesn't let apps prevent them the way Android does.
- **Jailbroken phones:** someone with full control of an unlocked phone can read the in-progress
  plain file while a recording is running.
- **Forgotten PIN: there is no recovery.** Deleting the app is the reset: it removes the PIN *and*
  every recording. (iOS keeps Keychain items after an app is deleted, so on the first launch after
  a reinstall Polarsync clears its old PIN and master key itself.)
- **Changing the PIN:** there's no in-app option yet. Deleting the app is the only way.

## Project layout

```
polarsync-ios/
├── project.yml                     # XcodeGen spec: generates Polarsync.xcodeproj
├── Config/                         # Info.plist files (mic text, background audio, Live Activities)
├── PolarsyncCore/                  # Plain Swift, no UI: covered by unit tests
│   ├── EncryptedMemoFormat.swift   # .psm chunked AES-GCM format
│   ├── PinManager.swift            # PBKDF2 hashing, constant-time check, lockout schedule
│   └── Format.swift                # durations, sizes, file names, recording clock, storage limits
├── PolarsyncCoreTests/             # XCTest
├── Polarsync/                      # The app
│   ├── PolarsyncApp.swift          # start-up, PIN gate, lock on background, privacy cover
│   ├── Recording/                  # AVAudioRecorder engine, interruptions, Live Activity control
│   ├── Storage/                    # folders, encryption on Stop, memo list, in-memory playback
│   ├── Security/Keychain.swift     # master key and PIN record in the Keychain
│   ├── Lock/                       # PIN screen
│   └── UI/RecorderView.swift       # record controls and memo list
├── PolarsyncWidgets/               # Live Activity (Lock Screen + Dynamic Island)
└── Shared/                         # Live Activity data and button actions, used by app and widget
```

## Getting the project onto a Mac

You need a Mac with **Xcode** (free from the Mac App Store; version 15 or newer, the newest is
best). The repository holds a small recipe, `project.yml`, instead of the Xcode project itself. Pick
one of these two ways to get a project Xcode can open:

**Option A: download the ready-made project (no Terminal needed)**

1. Sign in to GitHub and open this repository's **Actions** tab.
2. Click **Polarsync (iOS)** on the left, then the most recent run with a green tick.
3. At the bottom, under **Artifacts**, click **Polarsync-iOS-Xcode-project**. A zip downloads.
4. Double-click the zip to unpack it, then double-click **Polarsync.xcodeproj** inside.

**Option B: generate it yourself**

1. Install Homebrew: open the **Terminal** app and paste the command shown on
   [brew.sh](https://brew.sh), then press Return and follow the prompts.
2. Install XcodeGen: `brew install xcodegen`
3. Download this repository (green **Code** button on GitHub → **Download ZIP**, then unzip it), and
   in Terminal go to the `polarsync-ios` folder inside it, for example
   `cd ~/Downloads/AppDesign-main/polarsync-ios`
4. Run `xcodegen generate`, then `open Polarsync.xcodeproj`

## Installing on your iPhone

### Way 1: Xcode with a free Apple ID (no cost, re-install every 7 days)

1. **Connect the iPhone** to the Mac with a cable. On the iPhone, tap **Trust** if asked.
2. **Turn on Developer Mode on the iPhone:** Settings → Privacy & Security → Developer Mode → on.
   The phone restarts. (The option appears after the phone has been connected to Xcode once.)
3. **Add your Apple ID to Xcode:** Xcode menu → **Settings…** → **Accounts** → **+** →
   **Apple ID**, and sign in.
4. **Choose your team:** in Xcode's left sidebar click the blue **Polarsync** project icon. Then for
   **each** of the two targets **Polarsync** and **PolarsyncWidgets**: open **Signing &
   Capabilities**, tick **Automatically manage signing**, and pick your name ("Personal Team")
   under **Team**.
5. **If Xcode says the bundle identifier is unavailable** (someone else already uses
   `io.github.polarsync`): click the blue **Polarsync** project icon → the **Polarsync** item under
   *PROJECT* → **Build Settings** → search for `POLARSYNC_BUNDLE_ID` and change it to something
   unique, such as `io.github.polarsync.yourname`. Both targets pick it up.
6. **Run it:** at the top of the Xcode window, choose your iPhone in the device menu next to
   "Polarsync", then press the **▶ Run** button (or ⌘R).
7. **Trust the developer on the phone** the first time: Settings → General → **VPN & Device
   Management** → your Apple ID → **Trust**. Then open Polarsync.

With a free Apple ID the app **stops opening after 7 days**. Connect the phone and press **Run** again
to re-sign it. Your recordings and PIN are kept as long as you don't delete the app.

### Way 2: TestFlight with a paid Apple Developer account (US$99 a year)

This is the better option for everyday use: builds last 90 days and install over the air.

1. Join the [Apple Developer Program](https://developer.apple.com/programs/).
2. In Xcode, choose that team in **Signing & Capabilities** for both targets (step 4 above).
3. In [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**,
   enter the name "Polarsync" and choose your bundle identifier.
4. In Xcode, set the device menu to **Any iOS Device (arm64)**, then **Product → Archive**.
5. When the Organizer window opens, click **Distribute App → TestFlight & App Store** and follow
   the steps. Apple will ask about encryption: this app only uses the encryption built into iOS
   (CryptoKit and CommonCrypto) to protect your own data, see
   [Apple's export compliance guide](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations).
6. Install the **TestFlight** app on the iPhone. Once processing finishes (often 10–30 minutes),
   add yourself as a tester in App Store Connect → TestFlight, and install Polarsync from TestFlight.

## Building and testing in Xcode

- **Run on the Simulator:** pick any iPhone simulator in the device menu and press ▶. The Simulator
  uses the Mac's microphone.
- **Unit tests:** **Product → Test** (⌘U). They cover the file format (round trips at chunk
  boundaries, random access, tampering, truncation, wrong key), PIN hashing and the lockout
  schedule, and formatting.
- **Command line:**

  ```bash
  cd polarsync-ios
  xcodegen generate
  xcodebuild test -project Polarsync.xcodeproj -scheme Polarsync \
    -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO
  ```

**CI:** `.github/workflows/polarsync-ios.yml` runs on every change under `polarsync-ios/`. On a Mac
runner it generates the project, builds the app for the iOS Simulator and runs the unit tests,
then uploads the generated project as the **Polarsync-iOS-Xcode-project** artifact.

## Checking it on a real iPhone

1. **First launch:** create a PIN and confirm it. Enter a different PIN at the confirm step to see
   the mismatch message.
2. **Locking:** go to the Home Screen and come back: it asks for the PIN. Swipe up into the app
   switcher: the preview shows only the Polarsync cover. Enter a wrong PIN 5 times to see the 30 s
   countdown.
3. **Recording:** tap **Record** and allow the microphone. Lock the phone. The Lock Screen shows the
   Live Activity; try **Pause**, **Resume** and **Stop** there. Long-press the Dynamic Island
   (iPhone 14 Pro and later) for the same buttons. Unlock, open Polarsync (PIN first): the memo
   is in the list and plays.
4. **Interruptions:** call the phone while recording. Recording pauses during the call and resumes
   afterwards (or stays paused, with a Resume button, if iOS says not to resume). Plug in or unplug
   wired headphones while recording: it keeps going.
5. **Microphone denied:** Settings → Polarsync → turn Microphone off, then tap **Record**: the app
   offers a button to open Settings.
6. **Encryption:** connect to a Mac, open Xcode → **Window → Devices and Simulators** → your phone →
   Polarsync → ⋯ → **Download Container**. Right-click the downloaded file → **Show Package
   Contents** → `AppData/Library/Application Support/Polarsync/recordings`. Only `.psm` files are
   there, they don't play, and `pending/` is empty once a recording is stopped.
7. **Logs:** in the Console app on a Mac, pick the phone and filter by `io.github.polarsync`.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

    Copyright 2026 FluxDesignReserve

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
