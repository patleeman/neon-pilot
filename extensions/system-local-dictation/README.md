# Local Dictation

Dictation is implemented by the bundled `system-local-dictation` extension.

The extension contributes the composer mic button through `contributes.composerControls`, contributes its panel to the main Settings page through `contributes.settingsComponent`, and exposes backend actions for reading/updating settings, installing local Whisper models, checking model status, and transcribing captured PCM audio.

The composer button keeps microphone capture in the extension frontend while recording, then sends one full PCM buffer to the extension backend on stop. Avoid periodic partial transcription for now; repeatedly running local Whisper on growing snapshots can saturate the app and beachball the desktop UI.

Dictation also supports the host command `dictation.toggle`, bound by default to `Cmd/Ctrl+Shift+M`, which starts recording when idle and stops/transcribes when recording. Rebind this command from Settings → Commands for hardware controllers. Pair it with `composer.submit` when a hardware button should send the current composer message after dictation inserts text.

The Settings panel lets users pick a curated Whisper.cpp model (`tiny`, `base`, `small`, or `medium`, with English-only `.en` variants) or enter a custom direct Hugging Face `/resolve/` URL to a Whisper.cpp-compatible `ggml-*.bin` file. Curated models download from `ggerganov/whisper.cpp`; custom URLs are cached in the host-owned `transcription-models` directory by file name so other extension backends can reuse the same model through `@neon-pilot/extensions/backend/transcription`. The composer path installs the selected model automatically on first transcription if it is missing, while Settings remains available for preinstalling, switching, or reinstalling models. The extension manager controls composer availability: enabling the extension enables dictation, and disabling the extension removes the composer mic button without removing the host transcription service used by other features such as Telegram voice notes.

The backend action calls the host transcription API instead of importing Whisper.cpp directly. The host service owns `whisper-cpp-node` loading, model cache paths, normal audio decoding, timestamped transcript segments, and native runtime packaging.

Release packaging must include `node_modules/whisper-cpp-node`, `node_modules/@whisper-cpp-node`, and `node_modules/@ffmpeg-installer` as unpacked resources. The host loads the native binding and ffmpeg binary at runtime via `createRequire`, so a working waveform with no transcript usually means the release app is missing those native transcription dependencies.

## Validation

Run the focused dictation safety net before shipping dictation changes:

```bash
pnpm run test:dictation
node scripts/extension-build.mjs extensions/system-local-dictation
```

`test:dictation` covers the capture boundary, backend action contract, host local Whisper provider contract, and the composer control behavior. In particular it verifies that recording exposes a visible stop control and that completed transcriptions insert through the composer API instead of a global window event.

A full live microphone smoke still requires manual app validation because macOS microphone permission and real audio devices are outside jsdom/Vitest. When possible, validate in the desktop app by opening a conversation, clicking the mic, confirming the stop-square control appears, stopping recording, and confirming dictated text appears in the composer.
