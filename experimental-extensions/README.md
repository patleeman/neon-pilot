# Personal Agent Experimental Extensions

This repo area is for rough Personal Agent extensions that should stay out of the bundled system extension set until they earn their keep.

Each folder under `extensions/` is a complete extension package. Build one with the root `build` script, then install it into a PA state root by copying the extension folder or using the `install` script.

```bash
pnpm run build -- --extension system-local-models
pnpm run install -- --extension system-local-models --target testing
```

Current experiments:

- `system-local-models` — unified local MLX and GGUF model management UI. Runtime implementation lives in `shared/local-model-runtimes`.
- `system-session-exchange` — import/export flow for conversation session handoff experiments.
- `system-gateways` — Telegram gateway UI/runtime while gateway routing is still experimental.
- `system-images` — Image generation tooling while provider behavior and UX are still experimental.
- `system-caffeinate` — default-disabled macOS `caffeinate` top bar toggle.

Release builds package these under `Resources/experimental-extensions/extensions` and load them as experimental extensions, separate from bundled `extensions/system-*`.
