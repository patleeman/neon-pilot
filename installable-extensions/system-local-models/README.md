# Local Models extension

Unified local model management for MLX and GGUF/llama.cpp runtimes.

The UI intentionally separates two workflows:

## Server

Use this page to run a model that already exists locally.

- Select one downloaded model.
- Inspect supported backend status for MLX and llama.cpp, including installed version, latest checked version, and update availability.
- Update MLX or llama.cpp runtimes from the Server page.
- Configure serving settings such as context length, GPU layers, temperature, top-p, max tokens, GGUF sampling/performance options, raw extra llama.cpp args, and GGUF speculative decoding. Context length is auto-detected from GGUF metadata or MLX `config.json` and defaults to the detected value capped at 131,072 tokens.
- Save or reload the server after changing model/settings.
- Inspect the active endpoint and selected model metadata in the right detail rail.
- Inspect live runtime logs; status and logs refresh automatically while the page is open.

MLX models are served through `mlx_lm.server` on `http://127.0.0.1:8011/v1`.
GGUF models are served through bundled `llama.cpp` on `http://127.0.0.1:8012/v1`. The server starts with `--parallel 1` so long-context local serving does not accidentally multiply KV-cache memory by the default parallel slot count. Advanced settings expose common llama.cpp sampling and performance flags plus a raw extra-args escape hatch. Qwen MTP GGUFs can enable llama.cpp speculative decoding with `--spec-type draft-mtp --spec-draft-n-max <n>` from the Server settings.

## Library

Use this page to acquire and manage local models.

- Search Hugging Face for MLX and GGUF-compatible models.
- Inspect model details, README preview, and available files in the right detail rail.
- Download MLX models through the MLX setup flow.
- Download GGUF files by selecting a concrete `.gguf` file from model details.
- Track GGUF download progress and cancel in-flight GGUF downloads from the status banner.
- View downloaded models and send one to the Server page.

Runtime implementation lives in `installable-extensions/shared/local-model-runtimes`; `system-local-models` owns the user-facing extension UI.

## Smoke testing

Use the headless smoke harness before testing through the desktop UI:

```bash
pnpm run smoke:local-models       # fast build/import/runtime integrity checks
pnpm run smoke:local-models:full  # starts GGUF and MLX servers and hits /v1 chat endpoints
```

The full smoke uses these defaults, overrideable with environment variables:

- `LOCAL_MODELS_GGUF_MODEL` — local GGUF file path. Defaults to Patrick's cached Qwen GGUF path.
- `LOCAL_MODELS_MLX_MODEL` — Hugging Face MLX model id. Defaults to `mlx-community/SmolLM-135M-Instruct-4bit`.

Run this before doing the slower build/install/click loop. If it fails, the bug is in runtime acquisition, process lifecycle, storage keys, or server compatibility — not the UI.
