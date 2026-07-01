# Setup Readiness Audit

Setup readiness items should cover extension features that are enabled but need host-machine setup before they work reliably. They are not a replacement for normal settings pages; use them for missing binaries, local model downloads, native runtime dependencies, OS permissions, and external services that make the enabled feature unusable until resolved.

Current checked-in setup readiness registrations:

| Extension                     | Item              | Covers                                                                |
| ----------------------------- | ----------------- | --------------------------------------------------------------------- |
| `system-neon-pilot-admin-cli` | `cli-shell-link`  | User shell link for the `neon-pilot` command                          |
| `system-local-dictation`      | `dictation-model` | Selected Whisper model install and local Whisper runtime availability |
| `system-computer-use`         | `cua-driver`      | Cua Driver install and doctor/permission readiness                    |

Audit notes:

- `system-local-dictation` was missing readiness even though it requires a selected local Whisper model and native Whisper runtime dependencies.
- `system-computer-use` already warned through startup toasts when Cua Driver was missing or permissions were incomplete; it now also registers the same state through setup readiness.
- `system-ds4` is not checked into this repo. It is listed as an optional first-party installable extension from `patleeman/neon-pilot-extensions`; its source/catalog artifact needs a separate readiness registration for provider install, runtime bootstrap, and managed server status.
- Settings-managed capabilities such as MCP servers, model providers, and AI Gateway already have dedicated configuration/status surfaces. They should add setup readiness only when an enabled extension has a concrete missing prerequisite that makes its contributed tools/controls unusable.
