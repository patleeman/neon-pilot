# AI Gateway

AI Gateway is a bundled system extension that exposes an OpenAI Responses-compatible proxy for external coding agents. The extension is
bundled but disabled by default.

When the extension is enabled, Neon Pilot starts a local loopback gateway automatically. Users configure it from Settings rather than from a
dedicated nav page:

1. Open Settings → Extensions → AI Gateway.
2. Confirm the endpoint, defaulting to `http://127.0.0.1:8766/v1`.
3. Change the port if needed; saving the port restarts the listener.
4. Copy the client config values for external clients that support OpenAI Responses-compatible endpoints.
5. Check Recent activity for loopback requests and errors.

The gateway uses Neon Pilot's normal app default model when clients send `model = "auto"`. Clients may also request any concrete model listed
by `GET /v1/models`. The extension also writes a local model catalog file for clients that prefer file-based model metadata.

The first validation target is the local Responses-compatible contract:

1. Use the extension host routes for deterministic contract checks:
   - `GET /api/extensions/system-model-gateway/routes/health`
   - `GET /api/extensions/system-model-gateway/routes/v1/models`
   - `POST /api/extensions/system-model-gateway/routes/v1/responses`
2. Use the fake model `neon-pilot-fake` for credential-free smoke tests.
3. Point disposable clients at the Settings endpoint, normally `http://127.0.0.1:8766/v1`.

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

For live client checks, configure a disposable external client with:

```text
base_url="http://127.0.0.1:8766/v1"
auth_token="<generated gateway token>"
default_model="auto"
model_catalog="/path/to/neon-pilot/model-gateway/model-catalog.json"
```

The fake model proves the Responses shape and SSE lifecycle without provider credentials. Real provider checks require Neon Pilot provider credentials in the runtime's normal Pi-backed model configuration.

If the loopback endpoint does not bind after restart, the extension stays manageable from Settings and reports the listener error there. Change
the port or stop the other process, then Refresh or save the port again.
