# Voice Memo Recorder (Android)

An open-source voice memo recorder for Android 12+ (API 31+), written in Kotlin with Jetpack Compose.
It records in the background, and it always shows that it is recording.

- **It keeps recording in the background.** A foreground service of type `microphone` keeps the
  mic open when the app is in the background or the screen is off.
- **It always shows that it is recording.** An ongoing notification with a timer, plus
  **Pause / Resume** and **Stop** buttons, stays up for the whole session. Android also shows its
  own green microphone privacy indicator. Recording only starts when the user taps a button.
  The service is not exported and never restarts on its own (`START_NOT_STICKY`).
- **Recordings are stored privately.** Audio is AAC-LC in an MPEG-4 container (`.m4a`), mono,
  44.1 kHz, 128 kbps (about 1 MB per minute). Files go to `filesDir/recordings/`. They are left
  out of cloud backup and device-to-device transfer.
- **You can manage your memos.** The app lists your recordings with their date, length and size,
  and you can play them back or delete them.

## Project layout

```
voice-memo-recorder/
├── settings.gradle.kts, build.gradle.kts, gradle.properties
├── gradle/libs.versions.toml          # version catalog (AGP 8.11, Kotlin 2.2, Compose BOM)
├── gradlew, gradlew.bat, gradle/wrapper/   # Gradle 8.14.3
└── app/
    ├── build.gradle.kts               # minSdk 31, target/compileSdk 36
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml    # permissions + microphone FGS declaration
        │   ├── java/io/github/voicememo/
        │   │   ├── VoiceMemoApp.kt          # creates the notification channel, owns RecordingManager
        │   │   ├── RecordingManager.kt      # MediaRecorder engine + file management
        │   │   ├── RecordingState.kt        # Idle / Recording / Paused, events, VoiceMemo
        │   │   ├── AudioRecordingService.kt # foreground service + ongoing notification
        │   │   ├── MainActivity.kt          # runtime permissions, starts/stops the service
        │   │   ├── MainViewModel.kt         # memo list, playback, delete, messages
        │   │   ├── Format.kt                # file names, durations, sizes
        │   │   └── ui/                      # Compose screen and Material You theme
        │   └── res/
        └── test/                      # JVM unit tests
```

### How the pieces fit together

```
MainActivity ──startForegroundService(START)──▶ AudioRecordingService ──▶ RecordingManager ──▶ MediaRecorder
     │          startService(PAUSE/RESUME/STOP)        ▲  │ notify()                │
     │                                                 │  ▼                          │ StateFlow<RecordingState>
     │                         notification actions ───┘  Ongoing notification       │ SharedFlow<RecordingEvent>
     └──────────── MainViewModel ◀───────────────────────────────────────────────────┘
```

- `RecordingManager` is a single object for the whole app process, held by `VoiceMemoApp`.
  The service and the UI both watch its `state`, so they always agree.
- The service calls `startForeground(…, FOREGROUND_SERVICE_TYPE_MICROPHONE)` *before* the
  recorder starts. Android requires this order. The service then mirrors every state change
  into the notification. If the session ends for any reason (Stop, an encoder error, a full disk),
  the service removes its notification and stops itself.
- If the system destroys the service mid-session, `onDestroy()` finishes the file instead of
  losing it.

### Permissions

| Permission | Kind | Why |
|---|---|---|
| `RECORD_AUDIO` | runtime | Needed to record. The app asks before the first recording. |
| `POST_NOTIFICATIONS` | runtime (API 33+) | Shows the recording notification in the shade. If denied, recording still works, the session is listed in the system's active-apps drawer, and the app tells the user. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE` | normal | Needed for a microphone foreground service (API 34+). |

If the user picks "Don't allow" for the microphone permission, the error snackbar includes a
**Settings** button that opens the app's permission settings.

### Error handling

- **The mic is busy, or `prepare()`/`start()` fails:** the half-made file is deleted and the
  error is shown in a snackbar.
- **The recording is stopped too soon:** `stop()` throws because no audio was saved yet. The
  unplayable file is deleted and the user is told it was too short.
- **Storage runs low:** recording won't start with less than 50 MB free. A size limit stops
  the recording 20 MB before the disk fills, and the audio recorded so far is kept.
- **Starting from the background (`ForegroundServiceStartNotAllowedException`) or a missing
  permission (`SecurityException`):** both are caught and reported. The app does not crash.

## Building

You need **Android Studio** (Ladybug or newer) or the **Android SDK with platform 36**, plus
**JDK 17 or newer**.

### Android Studio

1. **File → Open…** and pick the `voice-memo-recorder/` folder (not the repository root).
2. Let Gradle sync. Studio offers to install SDK Platform 36 if you don't have it.
3. Choose the `app` run configuration and a device or emulator running API 31 or higher, then
   press **Run**.

### Command line

```bash
cd voice-memo-recorder
# Point Gradle at your SDK, either through local.properties or the environment:
echo "sdk.dir=$HOME/Android/Sdk" > local.properties    # or: export ANDROID_HOME=...

./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest      # JVM unit tests
./gradlew lintDebug              # → app/build/reports/lint-results-debug.html
./gradlew installDebug           # install on the connected device/emulator
```

CI (`.github/workflows/voice-memo-android.yml`) runs `assembleDebug testDebugUnitTest lintDebug`
on every change under this folder and uploads the debug APK.

## Testing on a device

Use an emulator or phone running API 31 or higher. On an emulator, turn on
**Extended controls → Microphone → "Virtual microphone uses host audio input"**.

1. **Permissions:** tap **Record**. The microphone and notification prompts appear. Deny the
   microphone once to see the explanation. Deny it twice to see the **Settings** button.
2. **Background recording:** start recording, press Home, and lock the screen for a minute.
   The notification timer keeps running and the green mic dot stays on. Unlock, tap the
   notification, and the app shows the same elapsed time.
3. **Notification controls:** use **Pause**, **Resume** and **Stop** from the notification
   shade. When you stop, the notification goes away and the new memo is listed in the app.
4. **Edge cases:** tap Record and then Stop right away. You get a "too short" message and no
   file is saved. Start a recording in another app first to check the "mic busy" message.
5. **Inspect the files:**

   ```bash
   adb shell run-as io.github.voicememo ls -l files/recordings
   adb exec-out run-as io.github.voicememo cat files/recordings/memo_YYYYMMDD_HHMMSS.m4a > memo.m4a
   ```

6. **Service state:**

   ```bash
   adb shell dumpsys activity services io.github.voicememo   # isForeground=true, types=0x80 (microphone)
   adb logcat -s RecordingManager AudioRecordingService
   ```

## License

Licensed under the [Apache License, Version 2.0](LICENSE). This is the same license as the
Android Open Source Project and the AndroidX libraries this app depends on.

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
