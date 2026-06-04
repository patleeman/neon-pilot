# Hermes Agent Extension

Connects Neon Pilot to a running Hermes Agent API server. Hermes remains the agent runtime; this extension only stores connection settings, lists Hermes sessions, renders session history, and sends turns into Hermes session APIs.

Expected Hermes server:

```text
http://127.0.0.1:8642
```

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
