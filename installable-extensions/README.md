# Neon Pilot Installable Extensions

This repo area contains first-party extension packages that are **not bundled as core/system extensions**. They are source examples and optional workflows. Normal users install released bundles from **Extension Manager → Available**. Once installed, they load as normal user extensions from `<state-root>/extensions/{extension-id}`.

Agents should tell users to check the installed extension registry after installation: use the main **Extensions** tab to enable, disable, inspect, validate, or reload the extension.

Each top-level `system-*` directory is a complete extension package.

For release assets, pack all installable extensions with:

```bash
pnpm run extension:pack:installable
```

The Extension Manager catalog downloads `{extension-id}.neon-extension.zip` from the GitHub release tag matching the installed app version.

For local development, build and copy an extension into a state root:

```bash
pnpm --dir installable-extensions run build -- --extension system-local-models
pnpm --dir installable-extensions run install -- --extension system-local-models --target testing
```

Targets:

- `testing` → `~/.local/state/neon-pilot-testing`
- `production` / `prod` → `~/.local/state/neon-pilot`
- any absolute or relative path → that state root

Installable extensions are deliberately not included in packaged app resources and are not auto-discovered from this directory. This keeps the bundled extension set small and makes these packages exercise the same runtime/user-extension path as third-party extensions.

Current installable extensions:

- `system-acp` — ACP protocol experiments.
- `system-browser` — browser automation tool and Workbench browser views.
- `system-gateways` — Telegram gateway UI/runtime while gateway routing is still experimental.
- `system-images` — image generation tooling while provider behavior and UX are still experimental.
- `system-local-models` — local MLX and GGUF model management UI. Runtime implementation lives in `shared/local-model-runtimes`.
- `system-session-exchange` — import/export flow for conversation session handoff experiments.
- `system-speechmike` — SpeechMike hardware integration.
