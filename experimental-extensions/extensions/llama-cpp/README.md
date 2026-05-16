# llama.cpp extension

Experimental PA extension for running local GGUF models through llama.cpp.

The extension bundles the llama.cpp runtime instead of installing compilers or Homebrew on user machines. Model files are downloaded or selected at runtime because GGUF files are large.

## Runtime layout

Packaged builds should include prebuilt, Metal-enabled macOS arm64 binaries here:

```text
bin/darwin-arm64/llama-cli
bin/darwin-arm64/llama-server
```

For local development, fetch the latest upstream macOS arm64 release binaries with:

```bash
npm run fetch:runtime
```

The backend checks the bundled runtime first. A custom binary path can be added later if we want a power-user escape hatch.

## Model cache

Hugging Face GGUF downloads are stored under:

```text
~/.cache/personal-agent/llama-cpp/models
```

The UI asks for an exact GGUF filename from the repo, caches the file locally, and lists cached `.gguf` files with Use and Reveal in Finder actions.

## Notes

- This is intentionally `defaultEnabled: false` while experimental.
- The UI uses the shared local runtime workspace pattern: model/download controls on the left, prompt smoke testing on the right, runtime status in the header, and runtime details in a collapsible footer.
- When `llama-server` is bundled, the extension starts a persistent OpenAI-compatible server on `http://127.0.0.1:8012/v1`, registers the selected GGUF in the Personal Agent model picker, and runs prompt tests through `/chat/completions`.
- If the server is unavailable, prompt tests fall back to `llama-cli` one-shot execution.
