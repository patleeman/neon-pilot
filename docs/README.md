# Neon Pilot Documentation

Neon Pilot is a durable AI agent runtime with a desktop app, background automation, and knowledge management. It wraps an LLM with persistent state, tools, and async workflows.

## Quick start

Download the latest macOS app from [GitHub Releases](https://github.com/patleeman/neon-pilot/releases/latest), or let an agent install and bootstrap the packaged app:

```bash
curl -fsSL https://raw.githubusercontent.com/patleeman/neon-pilot/master/install.sh | bash -s -- --install-cli --bootstrap
```

After install, open **Neon Pilot.app** and create a conversation. If you installed the CLI, verify the runtime with:

```bash
neon-pilot bootstrap doctor
```

See [Getting Started](getting-started.md) for the user setup flow, or [Development workflow](development.md) for building from source.

## Start here

If you are new to Neon Pilot, read these first:

- [Getting Started](getting-started.md) — install the packaged app and verify the runtime
- [Desktop App](desktop-app.md) — understand the Electron shell, shortcuts, and app chrome
- [Views](views.md) — learn Conversation and Workbench layouts
- [Conversations](conversations.md) — work with live threads, branching, follow-ups, and async follow-through
- [Conversation context](conversation-context.md) — attach files, folders, images, drawings, and generated context
- [Knowledge base sync](knowledge-base.md) — set up git-backed durable knowledge
- [Extension distribution](extension-distribution.md) — install optional extensions and understand extension repositories

## Common Tasks

- **Install and verify Neon Pilot** — use [Getting Started](getting-started.md), then run the first conversation.
- **Give the agent useful context** — use [Conversation context](conversation-context.md) for files, folders, images, drawings, and generated context.
- **Keep work organized** — use [Conversations](conversations.md), [Projects](projects.md), and [Knowledge base sync](knowledge-base.md).
- **Let work continue later** — use [Conversations](conversations.md) for follow-ups/deferred resumes and [Daemon](daemon.md) for background runtime behavior.
- **Install more capabilities** — use [Extension distribution](extension-distribution.md) and the first-party optional extension repo.
- **Build a custom capability** — start with [Build an extension with your agent](build-an-extension.md).

## Reference

- [Agent bootstrap](agent-bootstrap.md) — packaged install, CLI setup, provider configuration, and external-agent verification
- [Projects](projects.md) — project records and workspace metadata
- [Configuration](configuration.md) — file-based config and settings stores
- [Neon Pilot CLI](cli.md) — local control plane; extensions add administration commands with `contributes.cliCommands`
- [CLI reference](cli-reference.md) — generated command contract reference for automation and scripts
- [Telemetry](telemetry.md) — local JSONL telemetry logs, SQLite observability indexes, exports, and runtime producers
- [Activity tree](activity-tree.md) — shared model for conversations, executions, and future sidebar sub-items
- [Performance diagnostics](performance-diagnostics.md) — renderer timing tripwires for conversation load and API latency

## Builder and Architecture Docs

- [Build an extension with your agent](build-an-extension.md) — agent-first guide for asking Neon Pilot to create, build, reload, validate, and test native extensions
- [Extension authoring](extensions.md) — native extension manifests, frontend/backend entries, tools, skills, agent hooks, event bus, notifications, stable SDK imports, and integration testing
- [Extension API types](../packages/extensions/README.md) — SDK package with exported types for frontend and backend code
- [Extension templates](extension-templates/README.md) — copy-paste stubs for data-dashboard, crud-page, and settings-section patterns
- [Design system](design-system.md) — shared UI package, Storybook, and extension-friendly component guidance
- [Development workflow](development.md) — validation, UI QA, checkpoints, and secret scanning
- [Desktop API Boundary](desktop-api-boundary.md) — HTTP data plane, WebSocket realtime plane, and native-only IPC policy
- [Daemon](daemon.md) — background process and runtime lifecycle
- [Sandboxing](sandboxing.md) — shared process execution launcher, wrapper extensions, and direct process API policy
- [Filesystem Authority](filesystem-authority.md) — shared scoped filesystem boundary, backend seam, policy hooks, and command-sandbox root grants
- [Renderer isolation](renderer-isolation.md) — process ownership, critical lanes, and transcript projection boundaries
- [System extensions](../extensions) — feature-owned docs and implementation packages
- [First-party optional extensions](https://github.com/patleeman/neon-pilot-extensions) — optional packages distributed from GitHub release artifacts

## Extension docs

Neon Pilot product features live in extensions. The normal way to create one is to ask your agent to build it; start with [Build an extension with your agent](build-an-extension.md). Agents should use this README as the map: read the owning extension's `README.md` before changing feature behavior, and read [Extension authoring](extensions.md) plus [Extension API types](../packages/extensions/README.md) before changing extension APIs.

System extensions are bundled under `extensions/system-*`. Optional first-party extensions live in [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions), are not bundled or auto-loaded, and become normal user extensions only after installation into `<state-root>/extensions/{extension-id}`. Users install released optional extensions from **Settings → Extensions → Install**; after installing, check the main extension registry to enable and inspect the extension.

Feature-specific documentation lives beside the owning extension package.

Bundled system extensions:

- [Artifacts](../extensions/system-artifacts/README.md) — rendered artifacts beside the active conversation
- [Automations](../extensions/system-automations/README.md) — scheduled and conversation-bound automations
- [Background Work](../extensions/system-runs/README.md) — background commands and subagents linked to conversations
- [Caffeinate](../extensions/system-caffeinate/README.md) — macOS caffeinate top-bar control
- [Codex Profile](../extensions/system-codex-profile/README.md) — Codex/OpenAI tool profile, including `apply_patch` and image generation
- [Composer Attachments](../extensions/system-composer-attachments/README.md) — composer attachment controls
- [Context Hardening](../extensions/system-context-hardening/README.md) — tool-output bounds before agent context
- [Context Usage](../extensions/system-context-usage/README.md) — composer status for context-window usage
- [Conversation Tools](../extensions/system-conversation-tools/README.md) — conversation inspection, titles, working directories, and CLI commands
- [Diffs](../extensions/system-diffs/README.md) — checkpoint and workspace diff inspection
- Dynamic Workflows — model-authored workflow coordinators that fan out daemon-backed subagents
- [Excalidraw Input](../extensions/system-excalidraw-input/README.md) — composer drawing input
- [Extension Manager](../extensions/system-extension-manager/README.md) — extension registry, validation, import/export, and diagnostics
- [File Explorer](../extensions/system-files/README.md) — workspace file browsing
- [Telegram Gateway](../extensions/system-gateways/README.md) — Telegram chat connections
- [Git Status](../extensions/system-git-status/README.md) — branch and diff status in the composer
- [Goal Mode](../extensions/system-auto-mode/README.md) — persisted goal tracking and automatic continuation
- [Host view components](host-view-components.md) — host-owned UI components reusable by extensions
- [Image Probe](../extensions/system-image-probe/README.md) — image attachment inspection with a vision agent
- [Local Dictation](../extensions/system-local-dictation/README.md) — Whisper.cpp dictation controls and settings
- [MCP](../extensions/system-mcp/README.md) — configured MCP server inspection, auth, and calls
- [Model Gateway](../extensions/system-model-gateway/README.md) — opt-in local Responses API gateway for external coding agents; disabled by default while Codex Desktop custom-model picker fixes are pending upstream
- [Model Picker](../extensions/system-model-picker/README.md) — composer model and thinking controls
- Neon Pilot CLI — unified CLI control plane for internal agents and external callers
- [OpenAI Desktop Plugin](../extensions/system-openai-desktop-plugin/README.md) — automatically installs the external Codex/OpenAI Desktop `neon-pilot` plugin with a CLI skill and focused delegated-agent MCP bridge
- [Onboarding](../extensions/system-onboarding/README.md) — first-run onboarding bootstrap and conversation flow
- [Prompt Assembly](../extensions/system-prompt-assembly/README.md) — prompt inputs, capabilities, and diagnostics inspection
- [Reply Actions](../extensions/system-reply-actions/README.md) — transcript selection actions and draft starters
- [Scratchpad](../extensions/system-scratchpad/README.md) — conversation-scoped markdown scratchpad
- [Settings](../extensions/system-settings/README.md) — native first-party settings routes
- [Skills](../extensions/system-skills/README.md) — backend compatibility actions for agent skills
- [Telemetry extension](../extensions/system-telemetry/README.md) — app traces, model usage, tool health, and performance
- [Terminal](../extensions/system-terminal/README.md) — PTY-backed terminal panel
- [Todos](../extensions/system-todo/README.md) — conversation-scoped execution todos
- [Web Fetch](../extensions/system-web-tools/README.md) — web content fetch tool

Optional first-party extensions from [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions):

- [Agent Browser](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-agent-browser) — agent-browser CLI integration
- [Auto Router](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-auto-router) — judge-based model routing controls
- [Browser](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-browser) — Workbench browser views and browser automation
- [DuckDuckGo Search](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-duckduckgo-search) — web search using DuckDuckGo's HTML page
- [DS4](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-ds4) — local DeepSeek V4 Flash provider/profile for antirez/ds4
- [Exa Search](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-exa-search) — Exa web search
- [Hermes Agent](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-hermes-agent) — Hermes Agent API session interface
- [Kitty Litter Mobile Pairing](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-alleycat) — mobile pairing bridge
- [Local Models](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-local-models) — MLX and GGUF model runtime management
- [Self Preservation](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-self-preservation) — process self-preservation guard
- [Suggested Context](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-suggested-context) — related conversation suggestions
- [Video Probe](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-video-probe) — video analysis via local or remote video-capable models
- [Writing Studio](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-writing-studio) — document-first collaborative writing surface

## Sections

**View Modes** — Conversation and Workbench views, plus conversation context attachments.

**Core Product Model** — conversations and projects. Core stays a small stable platform; product features should live in system or user extensions.

**Desktop App** — Electron shell and app-level behavior.

**Background Runtime** — daemon lifecycle and runtime operations.

**Connectivity** — runtime connectivity architecture.

**Operations** — development workflow, configuration file format, and release cycle.
