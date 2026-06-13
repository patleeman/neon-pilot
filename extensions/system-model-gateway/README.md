# Model Gateway

Model Gateway is a bundled system extension that exposes an OpenAI Responses-compatible API for external coding agents.

When the extension is enabled, Neon Pilot starts a local loopback gateway automatically. Users configure it from Settings rather than from a
dedicated nav page:

1. Open Settings → Extensions → Model Gateway.
2. Confirm the endpoint, defaulting to `http://127.0.0.1:8766/v1`.
3. Change the port if needed; saving the port restarts the listener.
4. Copy the Codex config snippet for disposable client testing.
5. Check Recent activity for loopback requests and errors.

The gateway uses Neon Pilot's normal app default model when clients send `model = "auto"`. Clients may also request any concrete model listed
by `GET /v1/models`.

The first validation target is Codex compatibility without touching the currently running Codex Desktop session:

1. Use the extension host routes for deterministic contract checks:
   - `GET /api/extensions/system-model-gateway/routes/health`
   - `GET /api/extensions/system-model-gateway/routes/v1/models`
   - `POST /api/extensions/system-model-gateway/routes/v1/responses`
2. Use the fake model `neon-pilot-fake` for credential-free smoke tests.
3. Point disposable clients at the Settings endpoint, normally `http://127.0.0.1:8766/v1`.

Do not update the active `~/.codex/config.toml` from inside a running Codex Desktop session. For Codex compatibility testing, use a separate Codex CLI process with an isolated config/home, then manually test Desktop after lower-level smoke checks pass.

## Validation

From the repo root:

```bash
pnpm run extension:build -- extensions/system-model-gateway
vitest run extensions/system-model-gateway/src/backend.test.ts extensions/system-model-gateway/src/frontend.test.tsx
```

The fake model proves the Responses shape and SSE lifecycle without provider credentials. Real provider checks require Neon Pilot provider credentials in the runtime's normal Pi-backed model configuration.
