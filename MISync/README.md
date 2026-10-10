# MISync

An offline, encrypted audio recorder for Android, built for and tested against the
**Xiaomi Redmi 14C 5G** (Android 14 / HyperOS). Kotlin, Jetpack Compose, MVVM.

- **Package:** `com.misync.recorder` (debug builds: `com.misync.recorder.debug`)
- **minSdk / targetSdk:** 29 / 35
- **Permissions:** microphone, foreground service (microphone), notifications.
  **No internet or network permission**; CI fails the build if one appears in the merged manifest.

## Features

| Area | What it does |
|---|---|
| Recording | 44.1 kHz 16-bit mono PCM via `AudioRecord`, inside a `microphone` foreground service with a persistent notification and Pause / Resume / Stop actions |
| Encryption | AES-256-GCM, unique random key per recording, wrapped by a PIN-derived master key (PBKDF2) that is itself sealed by a non-exportable Android Keystore key (TEE / StrongBox) |
| Library | Room-backed list with in-memory decrypting playback (seek supported), rename, and delete. Delete also destroys the recording's key. |
| Access PIN | A six-digit PIN, set once at first launch and never changeable or resettable, is required **every time** the app opens. The PIN *is* the encryption key: the master key is sealed under it (PBKDF2) and can't be recovered without it. Escalating lockout on repeated wrong entries. `FLAG_SECURE` blocks screenshots/recents. |
| Diagnostics | Probes every public audio source, measures the signal, detects system silencing, reports the call/audio mode, and can save 8-second encrypted test clips for listening checks |
| Robustness | Detects system silencing (calls, concurrent capture), stops cleanly when storage runs low (under 50 MB), repairs recordings after a crash, power loss or force-stop, and flags damaged files without crashing |

There is no cloud sync, analytics, crash reporting, or any other network code.

## Architecture

```
ui/ (Compose screens + ViewModels)                      MVVM
  RecordScreen ── RecordViewModel ──► RecordingController (StateFlow) ◄── RecordingService
  LibraryScreen ─ LibraryViewModel ─► RecordingRepository + EncryptedPlayer
  DiagnosticsScreen ─ DiagnosticsViewModel ─► DiagnosticsRunner

service/RecordingService     foreground service, owns RecorderEngine → EncryptedAudioWriter
audio/RecorderEngine         AudioRecord capture thread, silencing + error detection
audio/EncryptedPlayer        decrypts chunk-by-chunk into AudioTrack (no plaintext on disk)
data/RecordingRepository     single source of truth: Room metadata + encrypted files, recovery
data/RecordingFileStore      app-private files/recordings, name validation, free-space policy
crypto/EncryptedAudioFile    .msa container: writer, random-access reader, recovery
crypto/KeyWrapper            AES-GCM wrapping of per-file keys
crypto/KeystoreKeyProvider   Android Keystore key-encryption key
AppContainer                 manual dependency injection
```

### Encrypted container (`.msa` v1)

```
header := "MSA1" | version | sampleRate | channels | bits | chunkSize | createdAt | wrappedKeyLen | wrappedKey
chunk  := flag (0 data / 1 end) | ctLen | nonce[12] | AES-GCM(ciphertext ‖ tag)
AAD    := header bytes ‖ chunk index ‖ flag
```

Each 64 KiB chunk (about 0.74 s of audio) is sealed on its own. Because the AAD binds the
header, the chunk's position and its end flag, the reader detects any edited header, reordered
or spliced chunks, flipped bits, and truncation. Because chunks are independent, playback can seek
without decrypting the whole file, and an interrupted recording can be recovered up to its last
complete chunk.

The file descriptor is synced every 4 chunks, so a sudden power loss costs at most about 3 s of
audio.

### Security model and trade-offs

- **The six-digit PIN is the root of encryption.** It is set once at first launch and cannot be
  changed or reset. The master key (which wraps each recording's own key) is sealed under a key
  derived from the PIN with PBKDF2, and that sealed blob is additionally wrapped by a non-exportable
  Android Keystore key so it can't be brute-forced off-device. The decrypted master key lives only
  in memory for the current unlocked session and is wiped when the app leaves the foreground, so
  **every** time you open the app you must re-enter the PIN. The PIN itself is never stored, and
  there is deliberately no backdoor: **if the PIN is forgotten, all recordings are permanently
  unrecoverable.**
- **Room metadata is not encrypted** (title, date, duration, size). It lives in app-private
  storage, which is protected by Android's sandbox and file-based encryption. Audio content is
  always encrypted.
- **Recordings are bound to this device.** Backup and device transfer are disabled. Uninstalling
  the app or clearing its data permanently destroys the recordings. There is no export feature
  yet, by design.
- **Storage use:** uncompressed PCM is about 5.3 MB per minute (about 318 MB per hour).
- **Recording is always visible, by design.** While recording, the app runs a foreground service
  with a persistent notification (a deliberately terse "M in use"), and Android shows its own
  microphone indicator and Privacy Dashboard entry. These are required by the OS for microphone
  capture and are not removed: an audio recorder that hid them would be a covert recorder, which is
  out of scope. The notification carries no recording title, duration or input detail, and
  screenshots are blocked, but the fact that the microphone is in use is never concealed.
- **No automatic call recording.** There is no feature that detects a WhatsApp (or other) call and
  starts recording on its own. Automatic, unattended capture of a call records the other party
  without their knowledge or consent — the covert recording this app does not do. Every recording
  is started deliberately by the user from the app.

## Building

### Requirements

- Android Studio Ladybug (2024.2) or newer, or the command line with **JDK 17**
- Android SDK Platform 35 (Android Studio installs it on first sync)
- Internet access to `google()` and `mavenCentral()` for the first Gradle sync

Toolchain: Gradle 8.14.3 (wrapper), AGP 8.7.3, Kotlin 2.0.21, KSP, Compose BOM 2024.12.01, Room 2.6.1.

### Android Studio

1. **File ▸ Open** and select the `MISync/` folder (not the repository root).
2. Let Gradle sync finish.
3. Select the `app` run configuration and a connected device, then press **Run**.

### Command line

```bash
cd MISync
./gradlew testDebugUnitTest      # unit tests: encryption, decryption, recovery, storage, repository
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
```

CI (`.github/workflows/misync-android.yml`) runs both tasks, checks for network permissions, and
uploads the debug APK as the `misync-debug` artifact.

## Installing a debug build on the Redmi 14C 5G

1. **Enable developer options:** go to Settings ▸ About phone and tap **OS version** seven times.
2. **Enable debugging:** go to Settings ▸ Additional settings ▸ Developer options and turn on
   - **USB debugging**
   - **Install via USB**. HyperOS may ask you to sign in to a Xiaomi account and insert a SIM card
     for this toggle.
3. Connect over USB, accept the RSA fingerprint prompt on the phone, then run:
   ```bash
   adb devices                     # the device should be listed as "device"
   cd MISync
   ./gradlew installDebug          # or: adb install -r app/build/outputs/apk/debug/app-debug.apk
   adb shell am start -n com.misync.recorder.debug/com.misync.recorder.ui.MainActivity
   ```
4. **For long recordings:** long-press the app icon, then go to App info ▸ Battery saver ▸
   **No restrictions**. HyperOS can otherwise stop foreground services aggressively.

## Device testing procedure

Run these checks on the Redmi 14C 5G and record the results in
[`docs/DEVICE_COMPATIBILITY_REPORT.md`](docs/DEVICE_COMPATIBILITY_REPORT.md).

1. **Permissions.** On first record, Android asks for microphone and notification access. Deny
   the microphone: the app shows "Microphone permission is required" and does not crash. Then
   grant it.
2. **Basic recording.** Record for 30 s, pause for 5 s, resume for 30 s, then stop. Check:
   - The notification showed the right state and its buttons worked.
   - The green microphone privacy dot was visible while recording.
   - The library shows about 1:00, and playback and seeking work.
3. **Screen off.** Start recording, lock the phone for 5 min, then stop from the notification.
   The duration should be about 5 min.
4. **The file is encrypted.** This works only on debug builds:
   ```bash
   adb shell run-as com.misync.recorder.debug ls -l files/recordings
   adb shell run-as com.misync.recorder.debug head -c 4 files/recordings/<file>.msa   # prints MSA1
   ```
   The rest of the file is ciphertext. Copy it off the device and confirm no player can open it.
5. **Interruptions.**
   - *Incoming cellular call:* while recording, receive a call. The UI and notification should
     say "silenced by system", and recording should resume capturing after the call ends.
   - *Process death:* while recording, run
     `adb shell am force-stop com.misync.recorder.debug`, then reopen the app. The recording
     appears as **Recovered** and plays up to the moment it was killed.
   - *Reboot during recording:* the same expectation as process death.
6. **Low storage.** Fill the device until less than 100 MB is free. Starting a recording should be
   refused with a clear message. If you record while space runs out, the recording stops with
   "Stopped: storage almost full" and is kept.
7. **Corrupted file.** On a debug build, flip a byte in the middle of a recording:
   ```bash
   adb shell run-as com.misync.recorder.debug sh -c \
     'printf "\x00" | dd of=files/recordings/<file>.msa bs=1 seek=200000 conv=notrunc'
   ```
   Playback should stop at the damaged chunk with an error, not crash or play garbage.
8. **Access PIN.** On first launch, set a six-digit PIN (entered twice). Fully close and reopen
   the app, and also background it and return: the PIN is required every time before the library
   or the record button is reachable. Enter it wrong five times and confirm the escalating lockout.
   Record something, then clear the app's data (which destroys the Keystore key and the PIN blob)
   and confirm the old recordings can no longer be opened — there is no recovery by design.
9. **No network.** `adb shell dumpsys package com.misync.recorder.debug | grep -i permission`
   should list no `INTERNET` permission.
10. **WhatsApp and call capture.** Follow the procedure in the compatibility report.

## WhatsApp calls

MISync uses only the public capture APIs. It does not use accessibility-service tricks, root,
hidden APIs, or covert recording. Whether the Redmi 14C 5G exposes **both** sides of a WhatsApp
call to a regular app has **not been verified**. See
[`docs/DEVICE_COMPATIBILITY_REPORT.md`](docs/DEVICE_COMPATIBILITY_REPORT.md) for the analysis, the
test procedure, and the results table. Do not assume this works until that table records it.
Recording calls may also require the consent of every participant, depending on where you live.
