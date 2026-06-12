# Local Dictation

Dictation is implemented by the bundled `system-local-dictation` extension.

The extension contributes the composer mic button through `contributes.composerButtons`, contributes its panel to the main Settings page through `contributes.settingsComponent`, and exposes backend actions for reading/updating settings, installing local Whisper models, checking model status, and transcribing captured PCM audio.

The composer button keeps microphone capture in the extension frontend while recording, then sends one full PCM buffer to the extension backend on stop. Avoid periodic partial transcription for now; repeatedly running local Whisper on growing snapshots can saturate the app and beachball the desktop UI.

Dictation also supports the host command `dictation.toggle`, bound by default to `Cmd/Ctrl+Shift+M`, which starts recording when idle and stops/transcribes when recording. Rebind this command from Settings → Commands for hardware controllers. Pair it with `composer.submit` when a hardware button should send the current composer message after dictation inserts text.

The Settings panel lets users pick a curated Whisper.cpp model (`tiny`, `base`, `small`, or `medium`, with English-only `.en` variants) or enter a custom direct Hugging Face `/resolve/` URL to a Whisper.cpp-compatible `ggml-*.bin` file. Curated models download from `ggerganov/whisper.cpp`; custom URLs are cached in the same `transcription-models` directory by file name. The extension manager controls availability: enabling the extension enables dictation, and disabling the extension removes the composer mic button.

The backend loads `whisper-cpp-node` from the desktop package dependency, not from the extension folder. Keep this explicit resolver in place because bundled system extension backends run from `extensions/<id>/dist`, where normal Node resolution will not find `packages/desktop/node_modules`.

Release packaging must include `node_modules/whisper-cpp-node` and `node_modules/@whisper-cpp-node` as unpacked resources. The backend loads the native binding at runtime via `createRequire`, so a working waveform with no transcript usually means the release app is missing those native dictation dependencies.
