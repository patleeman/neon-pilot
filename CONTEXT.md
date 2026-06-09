# Context Glossary

This file defines the shared product language for Neon Pilot. It is a glossary only: no implementation details, specs, TODOs, or architecture decisions.

When a term is resolved or corrected, update this file immediately. If a decision needs rationale, use an ADR instead.

## Taxonomy

Use these groups when adding terms:

1. **Product boundary** — what Neon Pilot is and where core, runtime, app, and extensions begin/end.
2. **Agent capability model** — agent-facing inputs and capabilities: prompts, tools, skills, MCP, and prompt assembly.
3. **Conversation model** — user/agent dialogue objects, transcript structure, branching, and queued continuation behavior.
4. **Execution model** — foreground and background work: executions, runs, subagents, commands, automations, and scheduled tasks.
5. **Knowledge model** — durable reference knowledge, knowledge directories, projects, and sync.
6. **Desktop layout model** — app shell, sidebars, rails, panes, views, and workbench surfaces.
7. **Browser model** — the built-in Workbench Browser versus agent-owned browser automation.
8. **Development workflow** — repo/development-only terms such as checkpoints.

## 1. Product boundary

### Neon Pilot

The product in this repository: a durable AI agent runtime with a desktop app, background automation, extensions, and knowledge management.

### Runtime

The system that runs agents, tools, conversations, extensions, storage, and background work.

Use **runtime** for the operating environment, not for a single background job.

### Product runtime

The runtime lane that owns conversations, prompt assembly, transcript/session orchestration, daemon integration, model/provider selection, and the Pi/Codex adapter.

Use **product runtime** when contrasting agent/conversation ownership with extension execution.

### Extension host

The runtime lane that owns extension registry loading, backend extension execution, actions, tools, services, subscriptions, extension diagnostics, and extension capability mediation.

Use **extension host** for the host that executes or supervises extension backend code, not for React view hosts.

### Extension worker

An isolated runtime for one extension backend, or one trusted extension group, supervised by the extension host.

Use **extension worker** when discussing per-extension backend isolation.

### Daemon

The long-lived background process that owns durable runtime services such as scheduled automations, persisted runs, and background execution.

### Desktop app

The Electron user interface for conversations, workbench views, settings, automations, and other extension-provided surfaces.

### Core

The small stable platform: agent/conversation runtime, transcript/event stream, durable storage primitives, prompt assembly, extension host, security boundaries, desktop/web shell, routing, install/update plumbing, and shared UI primitives.

Do not use **core** for product workflows that should live in extensions.

### Design system

The shared UI component and documentation system used by the desktop app and extensions. Prefer **design system** for reusable components, Storybook examples, and agent-facing UI guidance.

### Extension

A package that contributes product features on top of core: pages, panels, tools, skills, commands, context providers, integrations, diagnostics, settings, and workflow UX.

Extensions are Neon Pilot's product concept for installable capabilities. A native extension is implemented directly against the Neon Pilot extension API; an imported extension may wrap another ecosystem's package format, such as a Codex plugin, Claude skill package, MCP bundle, instruction pack, or prompt template pack.

### Plugin

An external ecosystem's package format that can be imported or wrapped by a Neon Pilot extension.

Use **plugin** when referring to Codex-style or third-party plugin packages. Do not use **plugin** as a replacement for Neon Pilot **extension** in product copy.

### System extension

A bundled extension shipped with the app or repo. System extensions can still own product-facing features; they are not automatically core.

### User extension

A runtime-installed extension owned by the user rather than bundled with the app.

## 2. Agent capability model

### Agent

The AI actor executing a user request. An agent can call tools, read context, produce assistant messages, and delegate work to subagents.

Use **agent** for the executing AI worker. Use **assistant message** for text the agent writes into a conversation.

### Personal agent

A user-created long-lived agent identity with its own name, persona, instruction files, skills, memory scope, enabled gateways, automations, model/runtime defaults, and conversations.

Use **personal agent** for the user-facing entity that can be selected, configured, contacted, and resumed across sessions. Do not use **subagent** for this durable entity.

### Agent profile

The persisted configuration record for a personal agent: identity, persona, default model/runtime, permissions, connected gateways, schedule bindings, memory paths, and prompt assembly inputs.

Use **agent profile** for storage/API details. Use **personal agent** in product copy.

### Soul document

A primary instruction file that defines a personal agent's durable personality, boundaries, preferences, and collaboration style.

Use **soul document** only for the first-class persona file attached to a personal agent. It is an instruction file, not knowledge base content.

### Prompt assembly

The process that builds the agent’s effective prompt from system files, instruction files, AGENTS.md/CLAUDE.md files, available skills, selected context, tools, and runtime metadata.

### Instruction file

A durable markdown file that defines standing behavior or policy for the agent.

Instruction files are behavior inputs, not general reference docs.

### AGENTS.md

A repo or directory instruction file discovered from the current working directory walk and injected into prompt assembly.

### Skill

A reusable workflow stored as `SKILL.md` and loaded into agent context when available/relevant. Skills tell the agent how to perform a class of task.

Do not use **skill** for an agent-callable function; that is a tool.

### Tool

An agent-callable capability with structured input and output, such as reading files, running commands, searching, or calling extension-provided actions.

### MCP server

An external Model Context Protocol server that exposes tools or resources to the agent through MCP.

### Neon Pilot CLI

The core-owned `neon-pilot` command shell for product/runtime administration. Extensions add product-specific commands through `contributes.cliCommands`; agents should discover available commands with `neon-pilot commands --json`.

### DS4

The local DeepSeek V4 Flash runtime from `antirez/ds4`, surfaced in Neon Pilot as a model provider/profile plus DS4-compatible tool schemas.

### Prompt template

Reusable prompt text selectable or contributed through prompt assembly surfaces.

## 3. Conversation model

### Conversation

A live or saved agent thread with a transcript, composer, tool access, and message history.

Use **conversation** for the whole thread, not an individual message or model request.

### Thread

A conversation as a lineage item, especially when discussing parent/child relationships, branches, or automations posting into an existing conversation.

Prefer **conversation** for the product object; use **thread** when lineage or delivery binding is the point.

### Transcript

The ordered, persisted record rendered in a conversation: user messages, assistant messages, tool calls, tool results, compaction markers, branch landmarks, and pinned internal work.

### Turn

One user prompt and the agent work that responds to it, including any tool calls and assistant output produced before the agent yields.

### Composer

The input area used to send prompts, attach files, queue follow-ups, run slash commands, and start inline commands.

### Steer

Guidance queued while an agent is streaming that should affect the current turn before the next LLM call.

Do not use **steer** for a normal later prompt.

### Follow-up

A queued prompt that runs after the current agent work completes.

### Deferred resume

A scheduled continuation of the current conversation at a later time. Use this for “wait, then continue” requests.

Do not use a sleeping foreground shell command as a timer.

### Branch

A divergent path in conversation history or file lineage created by actions such as fork, rewind, duplicate, or side/subagent work.

### Fork

A new conversation created from an earlier user message with context up to that point.

### Rewind

Moving the active conversation state back to an earlier point so work can continue from there.

### Duplicate / clone

A copy of the current active branch into a new conversation file.

### Internal work

Tool-created side work pinned inside the transcript shelf, such as subagents, artifacts, checkpoints, prompts, and visual captures.

## 4. Execution model

### Run

A low-level durable execution record stored by the daemon/runtime.

Avoid exposing **run** in product copy when a more specific user-facing term exists.

### Execution

The app-level projection of durable background work used by routes, extension APIs, activity surfaces, and conversation-scoped UI.

Use **execution** at product/API boundaries that aggregate background work; use **run** only for the storage/runtime record.

### Background work

Detached work that continues outside the foreground agent turn. User-facing background work is grouped into background commands and subagents.

### Background command

A daemon-backed shell command with logs, status, cancel, and rerun behavior.

### Subagent

A daemon-backed delegated agent with its own prompt, model, transcript/result, follow-up, and cancel behavior.

Use **subagent** only for delegated agent work, not for shell commands.

### Automation

A user-managed scheduled behavior shown in the Automations UI. Automations may run background agents or post to conversation threads.

Use **automation** in product copy.

### Scheduled task

The persisted daemon task definition behind an automation, with schedule, target, prompt, model, cwd, timeout, catch-up window, and thread binding.

Use **scheduled task** for daemon/API/tooling details; use **automation** for the user-facing concept.

### Catch-up window

The time window in which a missed scheduled automation may still fire after the daemon restarts or wakes.

## 5. Knowledge model

### Knowledge base

The durable collection of reusable reference material that the agent can browse, search, cite, or inject through explicit context such as `@` file mentions.

Knowledge base content is source material, not behavior. Use instruction files, skills, tools, and extensions for agent behavior.

### Knowledge directory

A local filesystem root included in the knowledge base. Neon Pilot may use one or more knowledge directories, including a managed git mirror and user-selected local directories.

Use **knowledge directory** or **knowledge path** for local file resolution. Do not introduce new product copy that calls this a vault.

### Marketplace

The installable capability catalog for extensions, skills, instruction packs, agents, templates, and other behavior packages.

Marketplace packages may target multiple ecosystems such as Codex and Claude. Installing a package can add skills, instruction files, tools, or extensions, but those installed behavior assets are not knowledge base content.

### Machine agent directory

The machine-local secondary directory for personal agent files that are not part of synced or indexed knowledge directories. Its canonical path is `~/.config/agents`.

Use the machine agent directory for local fallback instructions, skills, and future file-backed agent capabilities.

### Managed sync

The git-based process that synchronizes the knowledge base across machines while preserving recovery state for conflicts or errors.

### Project

A structured work package with milestones, tasks, and durable status in the knowledge base.

Do not use **project** as a synonym for repository unless the context is explicitly the project-management object.

### Workspace

The user’s current working area in the desktop app, often including a conversation plus workbench panels.

### Working directory / cwd

The filesystem directory used for agent tools, shell commands, and context discovery.

Use **cwd** only when referring to the concrete execution field or command environment.

## 6. Desktop layout model

### App shell

The persistent desktop frame around product pages: top-level navigation, sidebars/rails, pane layout, shortcuts, and route hosting.

Use **app shell** for layout chrome, not for extension-owned feature content.

### Left sidebar

The primary navigation sidebar on the left side of the desktop app. It contains app-level destinations and conversation/thread navigation.

Use **left sidebar** for the app-level navigation area. Do not call it the right rail or a pane.

### Extension rail

A tab-local contextual tool rail owned by a workbench tab. It hosts compact selector/context surfaces such as file explorer, knowledge tree, or extension-contributed tool panels.

Use **extension rail** or **tab rail** when distinguishing it from the global app shell. Do not imply there is a persistent global right sidebar. If a surface needs substantial reading or editing space, it should open a workbench tab/detail view rather than live entirely in the rail.

### Pane

A major resizable content region inside the desktop layout.

Use **pane** for large content regions. Use **sidebar** or **rail** for navigation/chrome regions.

### Conversation pane

The main pane that renders a conversation transcript and composer.

In Conversation View this is the only content pane. In Workbench View it sits beside the workbench pane.

### Workbench pane

The secondary content pane shown beside the conversation pane in Workbench View. It renders larger conversation-adjacent detail surfaces such as files, diffs, artifacts, browser pages, or knowledge files.

Use **workbench pane** for the large right-hand detail area, not **extension rail**.

### Detail view

A focused content view for a selected item, often rendered in the workbench pane.

Examples include a file detail, knowledge file, diff detail, artifact preview, browser page, or extension-contributed workbench detail.

### Workbench

A split-pane workspace for conversation-adjacent surfaces such as file detail views, browser panels, knowledge files, and extension-provided detail views.

### View

An extension-contributed UI surface, such as a main page, tab-local rail panel, or workbench detail.

### Activity tree

The shared model and UI surface for conversations, runs/executions, and future sidebar sub-items.

### Tool shelf

A compact transcript shelf that groups low-level tool-call plumbing or internal work while keeping important side outputs visible.

## 7. Browser model

### Workbench Browser

The built-in desktop browser surface visible to the user inside Neon Pilot.

### agent-browser

The automation skill/CLI used by agents for autonomous browser or Electron validation.

Do not use Workbench Browser tools for unattended product testing when agent-browser is the right boundary.

## 8. Development workflow

### Checkpoint

A targeted git commit created by the checkpoint tool to save the agent’s current work.

Do not use **checkpoint** for arbitrary save points in conversation history.
