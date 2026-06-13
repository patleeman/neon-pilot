# Model Gateway

Model Gateway is a bundled system extension that exposes an OpenAI Responses-compatible API for external coding agents.

The first validation target is Codex compatibility without touching the currently running Codex Desktop session:

1. Use the extension host routes for deterministic contract checks:
   - `GET /api/extensions/system-model-gateway/routes/health`
   - `GET /api/extensions/system-model-gateway/routes/v1/models`
   - `POST /api/extensions/system-model-gateway/routes/v1/responses`
2. Use the fake model `neon-pilot-fake` for credential-free smoke tests.
3. Start the loopback gateway from the Model Gateway page or the `modelGateway.start` command only when ready to test external clients.
4. Point disposable clients at `http://127.0.0.1:8766/v1`.

Do not update the active `~/.codex/config.toml` from inside a running Codex Desktop session. For Codex compatibility testing, use a separate Codex CLI process with an isolated config/home, then manually test Desktop after lower-level smoke checks pass.

## Validation

From the repo root:

```bash
pnpm run extension:build -- extensions/system-model-gateway
vitest run extensions/system-model-gateway/src/backend.test.ts extensions/system-model-gateway/src/frontend.test.tsx
```

The fake model proves the Responses shape and SSE lifecycle without provider credentials. Real provider checks require Neon Pilot provider credentials in the runtime's normal Pi-backed model configuration.
