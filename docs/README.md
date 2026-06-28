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

Pick the shortest path for what you are doing:

| Audience                            | First docs to read                                                                                                  | Success check                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **New user**                        | [Getting Started](getting-started.md), then [Views](views.md) and [Conversations](conversations.md)                 | App opens, provider is configured, and a first conversation gets a reply.                |
| **Power user organizing context**   | [Conversation context](conversation-context.md), [Memory](memory.md), [Legacy knowledge files](knowledge-base.md)   | Durable memory, useful files, notes, and project records are available to conversations. |
| **External agent or script author** | [Agent bootstrap](agent-bootstrap.md), [Neon Pilot CLI](cli.md), [CLI reference](cli-reference.md)                  | `neon-pilot bootstrap doctor` passes and reports usable provider setup.                  |
| **Extension builder**               | [Build an extension with your agent](build-an-extension.md), then [Extension authoring](extensions.md)              | The extension installs, its route/action works through the app, and its build passes.    |
| **Repo contributor**                | [Development workflow](development.md), then the owning package or extension README                                 | Focused validation passes and the app can still start when touched code affects startup. |
| **Release operator**                | [Release cycle](release-cycle.md), [Release QA](release-qa.md), [Release test inventory](release-test-inventory.md) | Release doctor, hardening tests, and hands-on smoke notes are complete.                  |

## Common Tasks

- **Install and verify Neon Pilot** — use [Getting Started](getting-started.md), then run the first conversation.
- **Give the agent useful context** — use [Conversation context](conversation-context.md) for files, folders, images, drawings, and generated context; use [Memory](memory.md) for durable agent behavior.
- **Keep work organized** — use [Conversations](conversations.md), [Projects](projects.md), and [Memory](memory.md).
- **Let work continue later** — use [Conversations](conversations.md) for follow-ups/deferred resumes and [Daemon](daemon.md) for background runtime behavior.
- **Install more capabilities** — use [Extension distribution](extension-distribution.md) and the first-party optional extension repo.
- **Build a custom capability** — start with [Build an extension with your agent](build-an-extension.md).

## Reference

- [Agent bootstrap](agent-bootstrap.md) — packaged install, CLI setup, provider configuration, and external-agent verification
- [Projects](projects.md) — project records and workspace metadata
- [Memory](memory.md) — Git-backed Markdown memory, scopes, memory skills, and the Memory page
- [Configuration](configuration.md) — file-based config and settings stores
- [Neon Pilot CLI](cli.md) — local control plane; extensions add administration commands with `contributes.cliCommands`
- [CLI reference](cli-reference.md) — generated command contract reference for automation and scripts
- [Telemetry](telemetry.md) — local JSONL telemetry logs, SQLite observability indexes, exports, and runtime producers
- [Activity tree](activity-tree.md) — shared model for conversations, executions, and future sidebar sub-items
- [Performance diagnostics](performance-diagnostics.md) — renderer timing tripwires for conversation load and API latency
- [SQLite migrations](sqlite-migrations.md) — shared versioned schema migration framework
- [Release QA](release-qa.md) — required release gate and hands-on smoke checklist
- [Release test inventory](release-test-inventory.md) — broad release-risk checklist
- [Feature inventory](feature-inventory.md) — user-perspective feature list for QA planning and coverage mapping

The public website docs are built from the page list in [`apps/site/build-docs.mjs`](../apps/site/build-docs.mjs). Update that list when a repo doc should appear on neonpilot.net; keep this README as the human and agent map for the source tree.

## Builder and Architecture Docs

- [Build an extension with your agent](build-an-extension.md) — agent-first guide for asking Neon Pilot to create, build, reload, validate, and test native extensions
- [Extension authoring](extensions.md) — native extension manifests, frontend/backend entries, tools, skills, agent hooks, event bus, notifications, stable SDK imports, and integration testing
- [Extension API types](../packages/extensions/README.md) — SDK package with exported types for frontend and backend code
- [Extension templates](extension-templates/README.md) — copy-paste stubs for data-dashboard, crud-page, and settings-section patterns
- [Design system](design-system.md) — shared UI package, Storybook, and extension-friendly component guidance
- [Neon Pilot taste](design/neon-pilot-taste.md) — mandatory UI taste and control-selection guidance for app and extension work
- [Extension visual refinement](design/extension-visual-refinement.md) — screenshot-backed iteration loop for generated extension UI
- [Design examples](design/examples/README.md) — positive and negative visual anchors
- [Development workflow](development.md) — validation, UI QA, checkpoints, and secret scanning
- [Client workflow tests](client-workflow-tests.md) — frontend workflow coverage matrix for chat, sidebar, extensions, settings, geometry, and recovery paths
- [Desktop API Boundary](desktop-api-boundary.md) — HTTP data plane, WebSocket realtime plane, and native-only IPC policy
- [Daemon](daemon.md) — background process and runtime lifecycle
- [Sandboxing](sandboxing.md) — shared process execution launcher, wrapper extensions, and direct process API policy
- [Filesystem Authority](filesystem-authority.md) — shared scoped filesystem boundary, backend seam, policy hooks, and command-sandbox root grants
- [Renderer isolation](renderer-isolation.md) — process ownership, critical lanes, and transcript projection boundaries
- [Product runtime and extension host split](product-extension-process-split.md) — architecture and validation for the product/extension process boundary
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
- [Dynamic Workflows](../extensions/system-dynamic-workflows/README.md) — model-authored workflow coordinators that fan out daemon-backed subagents
- [Excalidraw Input](../extensions/system-excalidraw-input/README.md) — composer drawing input
- [Agent Plugins](../extensions/system-agent-plugins/README.md) — Codex and Claude plugin import, update tracking, and compatibility reports
- [Extension Manager](../extensions/system-extension-manager/README.md) — extension registry, validation, import/export, and diagnostics
- [File Explorer](../extensions/system-files/README.md) — workspace file browsing
- [Git Status](../extensions/system-git-status/README.md) — branch and diff status in the composer
- [Goal Mode](../extensions/system-auto-mode/README.md) — persisted goal tracking and automatic continuation
- [Host view components](host-view-components.md) — host-owned UI components reusable by extensions
- [Image Probe](../extensions/system-image-probe/README.md) — image attachment inspection with a vision agent
- [Video Probe](../extensions/system-video-probe/README.md) — local video frame sampling and transcription tools
- [Local Dictation](../extensions/system-local-dictation/README.md) — Whisper.cpp dictation controls and settings
- [MCP](../extensions/system-mcp/README.md) — configured MCP server inspection, auth, and calls
- [AI Gateway](../extensions/system-model-gateway/README.md) — opt-in local Responses API proxy for external coding agents
- [Model Picker](../extensions/system-model-picker/README.md) — composer model and thinking controls
- [Neon Pilot CLI](../extensions/system-neon-pilot-admin-cli/README.md) — unified CLI control plane for internal agents and external callers
- [Onboarding](../extensions/system-onboarding/README.md) — first-run guided tour over real app pages
- [Prompt Assembly](../extensions/system-prompt-assembly/README.md) — prompt inputs, capabilities, and diagnostics inspection
- [Reply Actions](../extensions/system-reply-actions/README.md) — transcript selection actions and draft starters
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
- [Dynamic Workflows](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-dynamic-workflows) — workflow coordinators that fan out daemon-backed subagents
- [DS4](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-ds4) — local DeepSeek V4 Flash provider/profile for antirez/ds4
- [Exa Search](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-exa-search) — Exa web search
- [Knowledge](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-knowledge) — legacy knowledge/reference browsing and editing
- [Suggested Context](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-suggested-context) — related conversation suggestions
- [Writing Studio](https://github.com/patleeman/neon-pilot-extensions/tree/main/system-writing-studio) — document-first collaborative writing surface

## Docs maintenance checklist

When behavior, setup, or workflow changes, update the docs in the same change:

- Update the smallest owning doc first, then this README only if navigation changes.
- Keep first-run docs accurate: install path, provider setup, first task verification, and recovery hints.
- Update the owning extension README before changing extension behavior.
- Add public website coverage by updating [`apps/site/build-docs.mjs`](../apps/site/build-docs.mjs) only when a repo doc should appear on neonpilot.net.
- Prefer user-facing terms from [`CONTEXT.md`](../CONTEXT.md); keep implementation details in architecture docs, not onboarding docs.
- For docs-only edits, run formatting checks rather than the full product suite unless examples or generated references changed.

## Source Docs Scope

Treat root docs, `docs/`, `extensions/*/README.md`, `packages/*/README.md`, and benchmark docs as source documentation. Ignore generated or packaged copies under `dist/`, `packages/*/dist/`, app bundles, and other build outputs during docs audits unless the task is specifically about packaged resources.
