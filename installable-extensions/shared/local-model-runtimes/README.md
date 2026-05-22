# Local model runtimes

Shared backend implementation for the `system-local-models` extension.

- `mlx.ts` owns Hugging Face MLX setup, download, server start/stop, delete, and search.
- `gguf.ts` owns GGUF model cache management, cancellable downloads, llama.cpp server start/stop, delete, reveal, and prompt testing.
- `bin/darwin-arm64` stores bundled llama.cpp runtime binaries and their `.dylib` dependencies for local development and packaging.

This directory is intentionally not an extension package. The user-facing extension is `installable-extensions/system-local-models`.
