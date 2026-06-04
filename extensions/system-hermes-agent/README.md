# Hermes Agent Extension

Connects Neon Pilot to a running Hermes Agent API server. Hermes remains the agent runtime; this extension only stores connection settings, lists Hermes sessions, renders session history, and sends turns into Hermes session APIs.

Expected Hermes server:

```text
http://127.0.0.1:8642
```

## API key setup

The API key is not issued by Neon Pilot. It is the bearer token you configure on the Hermes API server.

Add or update `~/.hermes/.env` on the machine running Hermes:

```sh
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
```

Restart the Hermes API server after changing `.env`, then paste the raw `API_SERVER_KEY` value into the extension's API key field. Do not include the `Bearer` prefix; the extension sends requests as:

```http
Authorization: Bearer change-me-local-dev
```

When binding Hermes to anything other than loopback, use a strong secret for `API_SERVER_KEY`. Hermes requires it for non-loopback binds because the API server can access the full Hermes agent toolset.

See the Hermes API server docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/

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
