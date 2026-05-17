# MLX Local Models runtime

Backend/runtime implementation for the unified Local Models extension.

This package owns the MLX-specific runtime behavior:

- private `mlx-lm` virtualenv under `~/.cache/personal-agent/mlx-local-models`
- Hugging Face model download through the HF CLI
- `mlx_lm.server` on `http://127.0.0.1:8011/v1`
- selected model persistence
- setup/start/stop/delete/search backend actions

The user-facing UI is `experimental-extensions/extensions/local-models`.
This extension intentionally contributes no nav item and no main-page view.

Default model: `unsloth/Qwen3.6-35B-A3B-UD-MLX-4bit`.
