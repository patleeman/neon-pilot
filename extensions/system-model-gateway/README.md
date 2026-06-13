# Model Gateway

Model Gateway is a bundled system extension that exposes an OpenAI Responses-compatible API for external coding agents.

When the extension is enabled, Neon Pilot starts a local loopback gateway automatically. Users configure it from Settings rather than from a
dedicated nav page:

1. Open Settings → Extensions → Model Gateway.
2. Confirm the endpoint, defaulting to `http://127.0.0.1:8766/v1`.
3. Change the port if needed; saving the port restarts the listener.
4. Use Install to add a managed Neon Pilot block to `~/.codex/config.toml`, or Remove to delete that managed block and restore the previous
   top-level Codex model settings captured during install.
5. Copy the Codex config snippet for disposable client testing. It includes `model_catalog_json`, which points Codex at the generated local
   model catalog for picker/model metadata.
6. Check Recent activity for loopback requests and errors.

The gateway uses Neon Pilot's normal app default model when clients send `model = "auto"`. Clients may also request any concrete model listed
by `GET /v1/models`. Codex clients do not use `/v1/models` to populate their model picker; they use the local `model_catalog_json` file.

The first validation target is Codex compatibility without touching the currently running Codex Desktop session:

1. Use the extension host routes for deterministic contract checks:
   - `GET /api/extensions/system-model-gateway/routes/health`
   - `GET /api/extensions/system-model-gateway/routes/v1/models`
   - `POST /api/extensions/system-model-gateway/routes/v1/responses`
2. Use the fake model `neon-pilot-fake` for credential-free smoke tests.
3. Point disposable clients at the Settings endpoint, normally `http://127.0.0.1:8766/v1`.

The Settings install/remove buttons write the user's real `~/.codex/config.toml` and create timestamped `.bak.neon-pilot-*` backups before
modifying an existing file. For compatibility testing, prefer a separate Codex CLI process with an isolated config/home, then manually test
Desktop after lower-level smoke checks pass.

## Validation

From the repo root:

```bash
pnpm --dir packages/desktop run build:server
pnpm run extension:build -- extensions/system-model-gateway
vitest run extensions/system-model-gateway/src/backend.test.ts extensions/system-model-gateway/src/frontend.test.tsx
```

Run `build:server` whenever gateway host behavior changes. The extension backend imports `@neon-pilot/extensions/backend/modelGateway`, and
that host API lazy-loads `packages/desktop/server/dist/modelGatewayRuntime.js` in worker-backed service/action paths. `build-main` alone does
not refresh that server bundle.

For live Codex CLI checks, use an isolated Codex home:

```bash
tmp_home=$(mktemp -d)
cat > "$tmp_home/config.toml" <<'EOF'
model_provider = "neon-pilot"
model = "auto"
model_catalog_json = "/path/to/neon-pilot/model-gateway/codex-model-catalog.json"
approval_policy = "never"
sandbox_mode = "read-only"

[model_providers.neon-pilot]
name = "Neon Pilot Model Gateway"
base_url = "http://127.0.0.1:8766/v1"
wire_api = "responses"
experimental_bearer_token = "local-neon-pilot"
EOF

CODEX_HOME="$tmp_home" /Applications/Codex.app/Contents/Resources/codex exec \
  --json --skip-git-repo-check -C /tmp \
  "Run pwd with the shell tool, then reply with exactly DONE." </dev/null
rm -rf "$tmp_home"
```

The fake model proves the Responses shape and SSE lifecycle without provider credentials. Real provider checks require Neon Pilot provider credentials in the runtime's normal Pi-backed model configuration.

Codex Desktop may still hide custom catalog entries behind its own picker allowlist. The catalog file gives Codex metadata for Neon Pilot models
and avoids the CLI's unknown-model metadata fallback for listed slugs, but it does not patch Codex Desktop's installed app bundle.

If the loopback endpoint does not bind after restart, the extension stays manageable from Settings and reports the listener error there. Change
the port or stop the other process, then Refresh or save the port again.
