# Polarsync

An open-source, encrypted voice recorder for Android 12+ (API 31+), written in Kotlin with Jetpack Compose.

- **A 4-digit PIN opens the app.** You set the PIN on first launch. The app locks again whenever it
  leaves the screen. Too many wrong guesses trigger lockouts that grow from 30 s up to 1 h.
- **Recordings are encrypted on disk.** Each recording is sealed with AES-256-GCM using its own
  key. That key is itself encrypted by a master key held in the phone's secure hardware
  (Android Keystore). Files copied off the phone can't be played.
- **It keeps recording in the background.** A foreground service of type `microphone` keeps the
  mic running with the screen off. An ongoing notification with a timer and **Pause / Resume** and
  **Stop** buttons stays up for the whole session.
- **Recording only starts when the user taps a button.** The service isn't exported and never
  restarts itself.
- **Screen content stays private.** Screenshots, screen recordings and the recent-apps preview are
  blocked (`FLAG_SECURE`).

## Security model

| What | How |
|---|---|
| PIN | Only a salted PBKDF2-HMAC-SHA256 hash (120,000 iterations) is stored, never the PIN itself. Comparison is constant-time. After 5 wrong guesses, lockouts start at 30 s and double each time, up to 1 h. |
| Recordings at rest | Format `.psm`: a fresh random AES-256 data key per file, wrapped with a Keystore AES-GCM master key that can't be exported. Audio is stored in 64 KB AES-GCM chunks. The header and chunk index are authenticated, so tampering, reordering or truncating a file is detected. |
| Playback | Decrypted chunk by chunk in memory, through a `MediaDataSource`. No decrypted copy is written to disk. |
| While recording | `MediaRecorder` needs a seekable plain file. The live session is written to app-private `noBackupFilesDir/pending/`. On Stop it is encrypted and the plain file deleted. A file left behind by a crash is encrypted the next time the app opens. |
| Backups | Recordings and the PIN hash are excluded from cloud backup and device-to-device transfer. |

**Limits to be aware of:**
- **The PIN locks the app; it isn't the encryption key.** Four digits would be far too easy to
  brute-force if they protected the files directly. File security comes from the hardware key
  instead.
- **Rooted phones:** someone with root on an unlocked phone can still reach the in-progress
  plain file while a recording is running.
- **Forgotten PIN:** there's no recovery. Clearing the app's data (Settings → Apps → Polarsync →
  Storage → Clear data) removes the PIN *and* every recording.
- **Changing the PIN:** there's no in-app option yet. Clearing the app's data is the only way.

## Project layout

```
polarsync/
├── settings.gradle.kts, build.gradle.kts, gradle.properties, gradle/libs.versions.toml
├── gradlew, gradlew.bat, gradle/wrapper/          # Gradle 8.14.3
└── app/src/
    ├── main/
    │   ├── AndroidManifest.xml                     # permissions + microphone FGS declaration
    │   └── java/io/github/polarsync/
    │       ├── PolarsyncApp.kt                     # notification channel; owns RecordingManager, PinManager
    │       ├── AudioRecordingService.kt            # foreground service + ongoing notification
    │       ├── RecordingManager.kt                 # MediaRecorder engine, encryption, file management
    │       ├── RecordingState.kt                   # Idle / Recording / Paused, events, VoiceMemo
    │       ├── MainActivity.kt                     # PIN gate, permissions, FLAG_SECURE, re-lock on stop
    │       ├── MainViewModel.kt                    # memo list, decrypting playback, delete
    │       ├── LockViewModel.kt                    # create / confirm / enter PIN flow
    │       ├── security/
    │       │   ├── EncryptedMemoFormat.kt          # .psm chunked AES-GCM format
    │       │   ├── KeystoreKeyWrapper.kt           # hardware-backed master key
    │       │   ├── EncryptedMediaDataSource.kt     # in-memory decryption for MediaPlayer
    │       │   ├── PinManager.kt, PrefsPinStore.kt # PIN hashing and lockout
    │       └── ui/                                 # Compose: RecorderScreen, PinScreen, theme
    └── test/                                       # JVM unit tests (format, PIN, formatting)
```

## Permissions

| Permission | Kind | Why |
|---|---|---|
| `RECORD_AUDIO` | runtime | Needed to record. The app asks before the first recording. |
| `POST_NOTIFICATIONS` | runtime (API 33+) | Shows the recording notification in the shade. If denied, recording still works and the session is listed in the system's active-apps drawer. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE` | normal | Needed for a microphone foreground service. |

## Building

You need Android Studio (Ladybug or newer) or the Android SDK with platform 36, plus JDK 17 or newer.

- **Android Studio:** open the `polarsync/` folder (not the repository root), let Gradle sync, then
  press **Run** with a device or emulator running API 31 or higher.
- **Command line:**

  ```bash
  cd polarsync
  echo "sdk.dir=$HOME/Android/Sdk" > local.properties   # or export ANDROID_HOME
  ./gradlew assembleDebug testDebugUnitTest lintDebug   # → app/build/outputs/apk/debug/app-debug.apk
  ./gradlew installDebug
  ```

CI (`.github/workflows/polarsync-android.yml`) builds, tests and lints every change under this
folder. It uploads the debug APK as the **polarsync-debug** artifact.

## Testing on a device

1. **First launch:** create a PIN and confirm it. Enter a different PIN at the confirm step to see
   the mismatch message.
2. **Locking:** press Home and come back; it asks for the PIN again. Rotate the screen; it doesn't.
   Enter a wrong PIN 5 times to see the 30 s lockout countdown.
3. **Recording:** tap **Record** and grant the permissions. Press Home, lock the screen, and use
   **Pause / Resume / Stop** from the notification. When you reopen the app (PIN first), the new
   memo is in the list and plays back.
4. **Encryption:**

   ```bash
   adb shell run-as io.github.polarsync ls -l files/recordings no_backup/pending
   # Only .psm files in recordings/; pending/ is empty once a recording is stopped.
   adb exec-out run-as io.github.polarsync cat files/recordings/<name>.psm > memo.psm
   ffprobe memo.psm   # fails: the file isn't recognisable audio
   ```

5. **Doze:** `adb shell dumpsys battery unplug && adb shell dumpsys deviceidle force-idle` while
   recording, then check the pending file keeps growing. Afterwards run
   `adb shell dumpsys deviceidle unforce && adb shell dumpsys battery reset`.
6. **Logs:** `adb logcat -s RecordingManager AudioRecordingService`

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
