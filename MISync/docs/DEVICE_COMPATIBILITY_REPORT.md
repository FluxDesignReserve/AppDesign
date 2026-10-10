# MISync device compatibility report: Xiaomi Redmi 14C 5G

| | |
|---|---|
| **Report status** | **Not verified on the device.** No Redmi 14C 5G was available where this project was written, so no device results are recorded yet. |
| **WhatsApp two-sided capture** | **Not claimed.** Expected *not* to be available to a regular app (see the analysis below). This can only change after the on-device test in this document records both voices clearly. |
| **App version** | 1.0.0 |
| **Last updated** | 2026-10-10 |

This report has three parts:
1. A platform analysis of every public capture path, which explains the expected results.
2. A repeatable test procedure using MISync's built-in Diagnostics screen.
3. A results table to fill in from real device runs. Only part 3 counts as evidence.

---

## 1. Platform analysis

The target device runs Android 14 (HyperOS, API 34) or later. All rows below describe what a
**regular, non-system app** can do through **public APIs**. That is the only kind of access MISync
uses.

| # | Capture path | API | Requirement | Expected for MISync | Notes |
|---|---|---|---|---|---|
| 1 | Microphone, no call active | `AudioRecord` with `MIC`, `VOICE_RECOGNITION`, `UNPROCESSED`, `CAMCORDER`, `VOICE_COMMUNICATION`, `VOICE_PERFORMANCE` | `RECORD_AUDIO` | **Works** | This is MISync's normal recording path. `UNPROCESSED` depends on the device; the Diagnostics screen reads `PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED`. |
| 2 | Microphone during a WhatsApp call | Same as row 1 | `RECORD_AUDIO` | **Likely silenced** | Since Android 10, audio policy decides which client receives input when several capture at once. During a call, the app that owns the call (WhatsApp captures with `VOICE_COMMUNICATION`) normally keeps the input, and other ordinary apps receive silence. MISync detects this through `AudioRecordingConfiguration.isClientSilenced()` and a digital-silence check, then shows "Silenced by system". OEM policy can differ, which is why this needs on-device testing. |
| 3 | Microphone during a call, speakerphone | Same as row 1 | `RECORD_AUDIO` | **Likely silenced.** If it is not silenced, it captures the room only. | If the device does not silence MISync, the microphone picks up the local speaker and possibly the remote voice played through the loudspeaker. This is acoustic pickup, not a call tap. Quality is limited, and WhatsApp's echo cancellation does not apply to MISync's stream. Both voices would still have to be confirmed by listening. |
| 4 | Cellular call audio | `VOICE_CALL`, `VOICE_UPLINK`, `VOICE_DOWNLINK` | `CAPTURE_AUDIO_OUTPUT`, a signature/privileged permission that third-party apps cannot hold | **Unavailable** | These sources tap the modem voice path. WhatsApp is VoIP and does not use that path, so they would not carry WhatsApp audio even for a system app. They are probed only to document how the device responds. |
| 5 | Device output mix | `REMOTE_SUBMIX` | `CAPTURE_AUDIO_OUTPUT` | **Unavailable** | System-only. |
| 6 | Playback capture | `AudioPlaybackCaptureConfiguration` with `MediaProjection` | User consent through the screen-capture dialog | **Cannot capture call audio** | By API contract it matches only `USAGE_MEDIA`, `USAGE_GAME` and `USAGE_UNKNOWN`. VoIP downlink uses `USAGE_VOICE_COMMUNICATION`, which cannot be captured. Apps can also opt out with `ALLOW_CAPTURE_BY_NONE`. MISync does not implement this path because it cannot reach call audio by design. |

**Paths deliberately not used.** Using an accessibility service to keep microphone access, root,
hidden or reflective APIs, OEM-private intents, or hiding the recording indicator or
notification would all bypass Android security controls or enable covert recording. They are out
of scope and will not be added.

**Conclusion from the analysis.** On stock Android 14 policy, a regular app should not be able to
capture both sides of a WhatsApp call. The only path that could produce any call audio is row 3
(acoustic pickup on speakerphone), and only if HyperOS does not silence the second client. That is
an empirical question for the device, and it is what the procedure below answers.

---

## 2. Test procedure

**Equipment**
- Redmi 14C 5G with the MISync debug build installed (see the README).
- A second phone with WhatsApp, operated by a consenting participant.
- A quiet room.

Record the build number from MISync ▸ Diagnostics ▸ Device ▸ Build.

**A. Baseline, no call**
1. Open MISync ▸ Diagnostics. Grant microphone permission if asked.
2. Turn on **Save 8 s encrypted clip per source** and tap **Run source scan** while speaking
   continuously.
3. Copy the report (the **Copy report** button) and paste it under Results ▸ Baseline.
4. In the Library, play each `Diagnostic · …` clip and note whether your voice is audible.

**B. WhatsApp call, earpiece**
1. Start a WhatsApp voice call to the second phone. Keep the Redmi on the earpiece, not speaker.
2. Switch to MISync (the call keeps running) and open Diagnostics. **Audio mode** should read
   `IN_COMMUNICATION`. If it does not, note that.
3. Turn on clips and tap **Run source scan**. During the scan, the local person speaks in short
   phrases, and the **remote** person reads numbers aloud ("one, two, three…") so each voice can
   be identified.
4. End the call. Copy the report into the Results section.
5. Play every clip. For each source, record **Local voice heard?** and **Remote voice heard?**
   as *Yes clearly*, *Faint*, or *No*.

**C. WhatsApp call, speakerphone.** Repeat B with the Redmi on speaker.

**D. Recording during a call (main recorder).**
1. During a speakerphone WhatsApp call, start a normal recording on the Record tab with the
   default Microphone input.
2. Watch for the **Silenced by system** state. Stop after 30 s.
3. Play the recording and record what is audible.

**E. Repeat B through D at least twice**, including once with the Redmi as the *caller* and once
as the *callee*.

**Decision rule.** A source is reported as **"captures both sides of a WhatsApp call"** only if,
in **every** run, both the local and the remote voices are *clearly* audible in that source's
clip. Anything less is reported as not supported, together with the observed behaviour. Faint
speaker bleed is not support.

---

## 3. Results

> Fill in from real device runs. Leave a cell as "not tested" rather than guessing.

**Device details**

| Field | Value |
|---|---|
| Model / codename | not tested |
| Android / HyperOS build | not tested |
| Security patch | not tested |
| WhatsApp version | not tested |
| MISync version | 1.0.0 |
| Tester / date | not tested |

**Baseline (no call)**

| Source | Status | Level (dBFS) | Voice audible |
|---|---|---|---|
| MIC | not tested | | |
| VOICE_RECOGNITION | not tested | | |
| UNPROCESSED | not tested | | |
| CAMCORDER | not tested | | |
| VOICE_COMMUNICATION | not tested | | |
| VOICE_PERFORMANCE | not tested | | |
| VOICE_CALL | not tested (expected: unavailable) | | |
| VOICE_UPLINK | not tested (expected: unavailable) | | |
| VOICE_DOWNLINK | not tested (expected: unavailable) | | |
| REMOTE_SUBMIX | not tested (expected: unavailable) | | |

**WhatsApp call**

| Source | Mode | Status (silenced / signal / unavailable) | Local voice | Remote voice |
|---|---|---|---|---|
| MIC | Earpiece | not tested | | |
| MIC | Speaker | not tested | | |
| VOICE_RECOGNITION | Earpiece | not tested | | |
| VOICE_RECOGNITION | Speaker | not tested | | |
| UNPROCESSED | Earpiece | not tested | | |
| UNPROCESSED | Speaker | not tested | | |
| CAMCORDER | Earpiece | not tested | | |
| CAMCORDER | Speaker | not tested | | |
| VOICE_COMMUNICATION | Earpiece | not tested | | |
| VOICE_COMMUNICATION | Speaker | not tested | | |
| VOICE_PERFORMANCE | Earpiece | not tested | | |
| VOICE_PERFORMANCE | Speaker | not tested | | |
| Main recorder (D) | Speaker | not tested | | |

**Verdict**

| Question | Answer |
|---|---|
| Does any public capture path on the Redmi 14C 5G record **both** WhatsApp participants clearly? | **Unknown, not yet tested on the device.** Expected: no. |

**Raw diagnostic reports**

```
(paste the "Copy report" outputs here)
```

---

## 4. General app compatibility checklist (Redmi 14C 5G)

| Check | Result |
|---|---|
| Install debug APK via `adb` | not tested |
| Microphone and notification permission flow | not tested |
| Foreground service survives 30 min with the screen off (battery saver: No restrictions) | not tested |
| Foreground service survives 30 min with the screen off (battery saver: default) | not tested |
| Notification Pause / Resume / Stop | not tested |
| Silencing detected on an incoming cellular call | not tested |
| Recovery after `am force-stop` during recording | not tested |
| Recovery after a reboot during recording | not tested |
| Low-storage refusal and graceful stop | not tested |
| Corrupted chunk shows an error instead of crashing | not tested |
| Biometric lock (side fingerprint) | not tested |
| Keystore key is hardware-backed (TEE) | not tested |
| Merged manifest has no network permissions | Pass (CI `aapt2 dump permissions`: RECORD_AUDIO, FOREGROUND_SERVICE(_MICROPHONE), POST_NOTIFICATIONS, USE_BIOMETRIC/USE_FINGERPRINT only) |
| Unit tests: crypto, recovery, file store, repository | Pass (`testDebugUnitTest` in CI) |
| Debug APK builds | Pass (CI `assembleDebug`) |
