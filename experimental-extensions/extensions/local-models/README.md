# Local Models extension

Unified local model management for MLX and GGUF/llama.cpp runtimes.

The UI intentionally separates two workflows:

## Server

Use this page to run a model that already exists locally.

- Select one downloaded model.
- Configure serving settings such as context length, GPU layers, temperature, top-p, and max tokens.
- Save or reload the server after changing model/settings.
- Inspect the active endpoint and selected model metadata in the right detail rail.
- Smoke-test the runtime with a simple chat prompt or inspect logs.

MLX models are served through `mlx_lm.server` on `http://127.0.0.1:8011/v1`.
GGUF models are served through bundled `llama.cpp` on `http://127.0.0.1:8012/v1`.

## Library

Use this page to acquire and manage local models.

- Search Hugging Face for MLX and GGUF-compatible models.
- Inspect model details, README preview, and available files in the right detail rail.
- Download MLX models through the MLX setup flow.
- Download GGUF files by selecting a concrete `.gguf` file from model details.
- Track GGUF download progress and cancel in-flight GGUF downloads from the status banner.
- View downloaded models and send one to the Server page.

The older `qwen-mlx` and `llama-cpp` pages are retained as implementation references but should not be primary navigation surfaces.
