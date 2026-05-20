# ACP Protocol

This extension exposes Neon Pilot as an ACP agent over stdio.

## Usage

Enable the extension, then run:

```bash
neon-pilot protocol acp
```

For Alleycat:

```bash
ACP_BRIDGE_AGENT_BIN=neon-pilot
ACP_BRIDGE_AGENT_ARGS="protocol acp"
```

Quick smoke test:

```bash
npm run acp:smoke
```

## Supported ACP surface

- `initialize`
- `authenticate`
- `session/new`
- `session/load`
- `session/list`
- `session/resume`
- `session/close`
- `session/fork` (unstable)
- `session/set_mode`
- `session/prompt`
- `session/cancel`

The implementation intentionally exposes only the ACP capabilities it fully supports.
