# llama.cpp runtime

Backend/runtime implementation for the unified Local Models extension.

This package owns GGUF/llama.cpp behavior:

- bundled Metal-enabled `llama-cli` and `llama-server`
- local GGUF cache under `~/.cache/personal-agent/llama-cpp/models`
- selected model persistence
- cancellable GGUF download jobs with progress
- start/stop/status/delete/reveal/prompt backend actions
- OpenAI-compatible server on `http://127.0.0.1:8012/v1`

The user-facing UI is `experimental-extensions/extensions/local-models`.
This extension intentionally contributes no nav item and no main-page view.

## Runtime layout

Packaged builds should include prebuilt macOS arm64 binaries here:

```text
bin/darwin-arm64/llama-cli
bin/darwin-arm64/llama-server
```

For local development, fetch the latest upstream macOS arm64 release binaries with:

```bash
npm run fetch:runtime
```

The backend checks its bundled runtime first. When imported by the unified Local Models extension during local development, it falls back to this extension's runtime directory via `PERSONAL_AGENT_REPO_ROOT`.
