# Hermes Agent Extension

Connects Neon Pilot to a running Hermes Agent API server. Hermes remains the agent runtime; this extension only stores connection settings, lists Hermes sessions, renders session history, and sends turns into Hermes session APIs.

Expected Hermes server:

```text
http://127.0.0.1:8642
```

For Tailscale or another remote host, use the reachable machine name instead:

```text
http://bender.tail5a01ec.ts.net:8642
```

## Hermes server setup

Add or update `~/.hermes/.env` on the machine running Hermes:

```sh
API_SERVER_ENABLED=true
API_SERVER_PORT=8642
API_SERVER_KEY=change-me-local-dev
```

For Tailscale or LAN access, Hermes must bind beyond loopback:

```sh
API_SERVER_HOST=0.0.0.0
```

Restart Hermes after changing `.env`:

```sh
hermes gateway
```

Then paste the Hermes URL and raw `API_SERVER_KEY` into the extension's Connection panel.

## API key setup

The API key is not issued by Neon Pilot. It is the bearer token you configure on the Hermes API server.

Paste the raw `API_SERVER_KEY` value into the extension's API key field. Do not include the `Bearer` prefix; the extension sends requests as:

```http
Authorization: Bearer change-me-local-dev
```

When binding Hermes to anything other than loopback, use a strong secret for `API_SERVER_KEY`. Hermes requires it for non-loopback binds because the API server can access the full Hermes agent toolset.

See the Hermes API server docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/

## Memory session key

The memory session key is optional. When set, the extension sends it as `X-Hermes-Session-Key` so Hermes can use a stable long-term memory scope across multiple API sessions.

Most local single-user setups can leave the default value alone. Change it only when you want Hermes memory to be partitioned, for example separate identities for `work`, `personal`, or different users.

The extension uses:

- `GET /health` and `GET /health/detailed`
- `GET /v1/capabilities`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/{id}/messages`
- `POST /api/sessions/{id}/chat`
- `PATCH /api/sessions/{id}`
- `POST /api/sessions/{id}/fork`
- `DELETE /api/sessions/{id}`

Hermes API keys stay backend-side in extension storage. The frontend never calls Hermes directly.
