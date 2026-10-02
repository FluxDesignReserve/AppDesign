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

## Installing on your iPhone (free, with Xcode)

This uses a free Apple ID ("Personal Team"); no paid developer account is needed. The steps are
written for an iPhone 15, but any iPhone on iOS 17 or newer works the same way. The app only uses
features a free account can sign: background audio, the Keychain, file protection and Live
Activities updated on the phone itself (no push notifications, iCloud or App Groups).

1. **Connect the iPhone 15** to the MacBook with a USB-C cable. Unlock the phone and tap **Trust**
   if it asks whether to trust this computer.
2. **Add your Apple ID to Xcode:** Xcode menu → **Settings…** → **Accounts** → **+** (bottom left) →
   **Apple ID**, and sign in.
3. **Make the app identifier unique.** A free team can't use an identifier someone else already
   has. In Xcode's left sidebar click the blue **Polarsync** project icon → under *PROJECT* click
   **Polarsync** → **Build Settings** → type `POLARSYNC_BUNDLE_ID` in the search box → double-click
   the value `io.github.polarsync` and change it to something like `com.yourname.polarsync`
   (letters, numbers, dots and hyphens only). This is the only place to change it: the widget
   becomes `com.yourname.polarsync.widgets` automatically. (To make it permanent, change the same
   line in `project.yml`.)
4. **Pick your Personal Team.** Still with the blue project icon selected, for **each** of the two
   targets **Polarsync** and **PolarsyncWidgets**: open the **Signing & Capabilities** tab, tick
   **Automatically manage signing**, and choose **Your Name (Personal Team)** under **Team**.
   Any red error there should disappear after a few seconds.
5. **Choose the phone:** at the top of the Xcode window, click the device menu next to
   "Polarsync" and pick your iPhone 15.
6. **Turn on Developer Mode on the iPhone:** Settings → **Privacy & Security** → scroll to the
   bottom → **Developer Mode** → on. The phone asks to restart; after the restart, unlock it and tap
   **Turn On**. (The option only appears after the phone has been connected to Xcode once.)
7. **Run it:** press the **▶ Run** button (or ⌘R). The first build takes a minute or two.
8. **Trust your developer certificate** the first time: if the iPhone says "Untrusted Developer",
   go to Settings → General → **VPN & Device Management** → your Apple ID → **Trust**. Then open
   Polarsync from the Home Screen.

**Limits of a free Apple ID:**

- **The app stops opening after 7 days.** Connect the phone and press **▶ Run** in Xcode again to
  re-sign it. Your recordings and PIN are kept, as long as you don't delete the app.
- **At most 3 apps** installed this way can be on the phone at once.
- **A limited number of new app identifiers per week** (about 10). Polarsync uses two (the app and
  its Live Activity widget), so avoid changing the identifier again and again.

(With a paid Apple Developer account, US$99 a year, you could instead upload builds to
TestFlight, which last 90 days and install without a cable. That isn't needed here.)

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
   (iPhone 15 and later; iPhone 14 Pro too) for the same buttons. Unlock, open Polarsync (PIN first): the memo
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
