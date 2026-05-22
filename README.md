# Neon Pilot

<p align="center">
  <img src="packages/desktop/assets/icon-color.svg" alt="Neon Pilot logo" width="128" height="128" />
</p>

<p align="center">
  <strong>A self-extensible desktop agent harness, powered by the <a href="https://pi.dev/">Pi Coding Agent</a>.</strong>
</p>

<p align="center">
  <a href="https://neonpilot.net">Website</a> ·
  <a href="https://neonpilot.net/docs/">Docs</a> ·
  <a href="https://github.com/patleeman/neon-pilot/releases/latest">Download for macOS</a>
</p>

---

Neon Pilot is a durable AI agent runtime with a desktop app, background automation, extensions, and knowledge management. It is built for agents that can improve their own workspace instead of waiting for the next product release.

Ask for a workflow once, then keep it: commands, tools, automations, UI surfaces, skills, and local extensions are first-class runtime capabilities.

## What it does

- **Self-extensible workflows** — ask Neon Pilot to add commands, tools, pages, panels, settings, or reusable skills.
- **Extension-first product surface** — product workflows live in system or user extensions instead of bloating core.
- **Durable conversations** — conversations, transcripts, branches, checkpoints, artifacts, and background work persist across app restarts.
- **Background work** — daemon-backed background commands, subagents, automations, scheduled tasks, follow-ups, and deferred resumes.
- **Knowledge base** — git-backed durable knowledge, instruction files, skills, project notes, and managed sync.
- **Multi-provider models** — bring your own providers and pick the right model for each task.
- **Workbench UI** — conversation view plus workbench panes for files, diffs, artifacts, browser surfaces, knowledge, and extension tools.

## Architecture

Neon Pilot keeps core small and pushes user-facing behavior into extensions.

- `packages/core` — shared runtime primitives, resource resolution, prompt assembly inputs, conversation/storage utilities.
- `packages/desktop` — Electron app shell, desktop/server runtime, local API, extension host, daemon integration, UI.
- `packages/extensions` — public extension SDK types and frontend/backend seams.
- `extensions/system-*` — bundled first-party product features.
- `installable-extensions/*` — optional first-party extensions that install into runtime state as user extensions.
- `apps/site` — static marketing/docs site published at [neonpilot.net](https://neonpilot.net).
- `docs` — agent-facing product, architecture, extension, and development docs.

## Installation

Download the latest macOS `.dmg` from [GitHub Releases](https://github.com/patleeman/neon-pilot/releases/latest).

## Development

```bash
pnpm install
pnpm run setup:hooks   # optional: enable tracked git hooks
pnpm run build
pnpm run desktop:start
```

For the desktop dev app:

```bash
pnpm run desktop:dev
```

For the website:

```bash
pnpm run build:site
cd apps/site && python3 -m http.server 4173
```

## Documentation

Start with [neonpilot.net/docs](https://neonpilot.net/docs/) or [docs/README.md](./docs/README.md).

Important repo docs:

- [Development workflow](./docs/development.md)
- [Extension authoring](./docs/extensions.md)
- [Build an extension with your agent](./docs/build-an-extension.md)
- [Desktop app](./docs/desktop-app.md)
- [Release cycle](./docs/release-cycle.md)
- [Context glossary](./CONTEXT.md)

## License

[MIT](LICENSE)
