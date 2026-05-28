# Neon Pilot Documentation

Neon Pilot is a durable AI agent runtime with a desktop app, background automation, and knowledge management. It wraps an LLM with persistent state, tools, and async workflows.

## Quick start

```bash
pnpm install
pnpm run setup:hooks   # optional: enable the tracked pre-commit hook
pnpm run build
pnpm run desktop:start
```

The repo intentionally avoids a root `postinstall`; third-party build scripts are allowlisted in `pnpm-workspace.yaml`, and anything new shows up in `pnpm ignored-builds`.

See [Getting Started](getting-started.md) for the full setup.

## Start here

- [Getting Started](getting-started.md) — install from source and verify the app
- [Views](views.md) — Conversation, Workbench layouts
- [Conversation context](conversation-context.md) — attach files, folders, and generated context
- [Conversations](conversations.md) — live threads, branching, async follow-through
- [Projects](projects.md) — project records and workspace metadata
- [Desktop App](desktop-app.md) — Electron shell, shortcuts, and app chrome
- [Desktop API Boundary](desktop-api-boundary.md) — HTTP data plane, WebSocket realtime plane, and native-only IPC policy
- [Knowledge](../extensions/system-knowledge/README.md) — knowledge, docs, skills, instruction files, and managed sync
- [Knowledge base sync](knowledge-base.md) — git-backed knowledge base setup, local paths, and sync behavior
- [Configuration](configuration.md) — file-based config, env vars
- [Development workflow](development.md) — validation, UI QA, checkpoints, and secret scanning
- [Daemon](daemon.md) — background process and runtime lifecycle
- [Sandboxing](sandboxing.md) — shared process execution launcher, wrapper extensions, and direct process API policy
- [Filesystem Authority](filesystem-authority.md) — shared scoped filesystem boundary, backend seam, policy hooks, and command-sandbox root grants
- [Activity tree](activity-tree.md) — shared model for conversations, executions, and future sidebar sub-items
- [Performance diagnostics](performance-diagnostics.md) — renderer timing tripwires for conversation load and API latency
- [Renderer isolation](renderer-isolation.md) — process ownership, critical lanes, and transcript projection boundaries
- [Telemetry](telemetry.md) — local JSONL telemetry logs, SQLite observability indexes, exports, and runtime producers
- [Build an extension with your agent](build-an-extension.md) — agent-first guide for asking Neon Pilot to create, build, reload, validate, and test native extensions
- [Extension templates](extension-templates/README.md) — copy-paste stubs for data-dashboard, crud-page, and settings-section patterns
- [Extension authoring](extensions.md) — reference for native extension manifests, frontend/backend entries, tools, skills, agent hooks, event bus, notifications, stable SDK imports, and integration testing
- [Extension API types](../packages/extensions/README.md) — SDK package with exported types for frontend and backend code
- [System extensions](../extensions) — feature-owned docs and implementation packages
- [Installable extensions](../installable-extensions) — optional first-party extensions that install into runtime state as user extensions

## Extension docs

Neon Pilot product features live in extensions. The normal way to create one is to ask your agent to build it; start with [Build an extension with your agent](build-an-extension.md). Agents should use this README as the map: read the owning extension's `README.md` before changing feature behavior, and read [Extension authoring](extensions.md) plus [Extension API types](../packages/extensions/README.md) before changing extension APIs.

System extensions are bundled under `extensions/system-*`. Installable extensions live under `installable-extensions/*` in the repo, are not bundled or auto-loaded, and become normal user extensions only after installation into `<state-root>/extensions/{extension-id}`. Users install released optional extensions from **Settings → Extensions → Available**; after installing, check the main extension registry to enable and inspect the extension.

Feature-specific documentation lives beside the owning extension package:

- [Agent Browser](../installable-extensions/system-agent-browser/README.md)
- [Artifacts](../extensions/system-artifacts/README.md)
- [Auto Mode](../extensions/system-auto-mode/README.md)
- [Automations](../extensions/system-automations/README.md)
- [Browser](../installable-extensions/system-browser/README.md)
- [Caffeinate](../extensions/system-caffeinate/README.md)
- [Codex Profile](../extensions/system-codex-profile/README.md)
- [Composer Attachments](../extensions/system-composer-attachments/README.md)
- [Context Hardening](../extensions/system-context-hardening/README.md)
- [Context Usage](../extensions/system-context-usage/README.md)
- [Conversation Tools](../extensions/system-conversation-tools/README.md)
- [Diffs](../extensions/system-diffs/README.md)
- [DuckDuckGo Search](../installable-extensions/system-duckduckgo-search/README.md)
- [Exa Search](../installable-extensions/system-exa-search/README.md)
- [Excalidraw Input](../extensions/system-excalidraw-input/README.md)
- [Extension Manager](../extensions/system-extension-manager/README.md)
- [File Explorer](../extensions/system-files/README.md)
- [Git Status](../extensions/system-git-status/README.md)
- [Host view components](host-view-components.md)
- [Image Probe](../extensions/system-image-probe/README.md)
- [Images](../installable-extensions/system-images/README.md)
- [Kitty Litter Mobile Pairing](../installable-extensions/system-alleycat/README.md)
- [Knowledge](../extensions/system-knowledge/README.md)
- [Local Dictation](../extensions/system-local-dictation/README.md)
- [Local Models](../installable-extensions/system-local-models/README.md)
- [MCP](../extensions/system-mcp/README.md)
- [Model Picker](../extensions/system-model-picker/README.md)
- [Onboarding](../extensions/system-onboarding/README.md) — first-run onboarding bootstrap and conversation flow
- [Prompt Assembly](../extensions/system-prompt-assembly/README.md) — prompt inputs, capabilities, and diagnostics inspection
- [Reply Actions](../extensions/system-reply-actions/README.md)
- [Runs](../extensions/system-runs/README.md)
- [Session Exchange](../installable-extensions/system-session-exchange/README.md)
- [Self Preservation](../installable-extensions/system-self-preservation/README.md)
- [Settings](../extensions/system-settings/README.md)
- [Skills](../extensions/system-skills/README.md)
- [SpeechMike](../installable-extensions/system-speechmike/README.md)
- [Suggested Context](../extensions/system-suggested-context/README.md)
- [Telemetry extension](../extensions/system-telemetry/README.md)
- [Video Probe](../installable-extensions/system-video-probe/README.md)
- [Web Fetch](../extensions/system-web-tools/README.md)

## Sections

**View Modes** — Conversation and Workbench views, plus conversation context attachments.

**Core Product Model** — conversations and projects. Core stays a small stable platform; product features should live in system or user extensions.

**Desktop App** — Electron shell and app-level behavior.

**Background Runtime** — daemon lifecycle and runtime operations.

**Connectivity** — runtime connectivity architecture.

**Operations** — development workflow, configuration file format, and release cycle.
