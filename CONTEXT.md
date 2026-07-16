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

### Application

A top-level user experience contributed by an extension and hosted by the Neon Pilot app shell. An application owns its internal navigation, pages, resources, inspectors, and working layout.

Use **application** for experiences such as Agent, Home, or a local-model workspace. Do not use **application** as a synonym for an extension: one extension may contribute an application, contribute to another application, or do both.

### Application contribution

An extension-provided addition to an application, such as an internal navigation destination, page, command, inspector, or launcher result.

Use **application contribution** when distinguishing an extension's user-facing placement from the extension package itself.

### Self-extensible harness

A harness whose agent can build, install, modify, and run its own extensions from inside the product workflow.

Use **self-extensible** when contrasting Neon Pilot and Pi-style agent extension systems with older extension models where users manually install packages or perform substantial framework work themselves.

### Plugin

An external ecosystem's package format that can be imported or wrapped by a Neon Pilot extension.

Use **plugin** when referring to Codex-style or third-party plugin packages. Do not use **plugin** as a replacement for Neon Pilot **extension** in product copy.

### System extension

A bundled extension shipped with the app or repo. System extensions can still own product-facing features; they are not automatically core.

### AI Gateway

A bundled system extension that exposes Neon Pilot model providers through an API surface external coding agents can use.

### Transcription service

The host-owned speech-to-text capability used by extensions for dictation, voice notes, and other audio-to-text workflows.

Use **transcription service** for the shared host boundary and **dictation** only for the composer microphone workflow.

### Multimedia probe

The bundled system extension and host-backed capability for inspecting image, video, audio, and document attachments.

Use **multimedia probe** for the product surface. Use **video media tools** when specifically referring to deterministic frame sampling and video transcription by stable `vid_<hash>` IDs.

### Required system extension

A bundled extension that owns a platform repair, configuration, routing, prompt assembly, terminal, or background-work surface that must stay available for the app to manage itself.

Required system extensions still use the extension API for their product surfaces, but the core extension host treats their availability as platform infrastructure: users cannot disable them, stale disabled config is ignored, and extension circuit-breaker failures are recorded without quarantining the surface.

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

A user-managed event-driven behavior shown in the Automations UI. Automations may be scheduled, script-created, agent-emitted, or subscription-driven, and may run background agents, scripts, threads, scheduled tasks, or publish follow-on events.

Use **automation** in product copy.

### Routine

A user-managed prompt workflow attached to a lifecycle event, such as before checkpointing or after a task failure. A routine contains ordered instruction, decision, or stop blocks and may continue, warn, branch, or block the lifecycle event.

Use **routine** for lifecycle-bound workflows. Use **automation** for event bus and scheduled behaviors.

### Lifecycle event

A named moment in the product workflow where routines can run, such as Checkpoint, Before agent starts, or Scheduled task.

Use **lifecycle event** for the user-visible trigger in the Routines UI. Use **hook** for extension/runtime APIs.

### Event bus

The automation backbone that accepts typed events from schedules, scripts, agents, and runtime services, matches subscriptions, records durable events when requested, and dispatches reactions.

Use **event bus** for the shared automation stream, not separate cron/script buses.

### Event

A typed message on the event bus with source, payload, metadata, occurrence time, and optional durable recording.

Use **event** for the message itself; use **reaction** for the work triggered by a subscription.

### Delayed event

A persisted request to emit an event at or after a due time. Processing a delayed event emits a normal event against the subscriptions available at processing time.

Use **delayed event** for deferred event emission, not **cron** or **schedule** unless the publisher is actually recurring.

### Publisher

A schedule, script, agent, service, or user action that emits events into the event bus.

Use **publisher** for the event source that can be paused, inspected, or administered.

### Subscription

A durable event bus rule that matches event types and dispatches one reaction: run a scheduled task, start an agent, start a thread, run a script, or publish another event.

Use **subscription** for the standing rule and **reaction** for an individual dispatch caused by an event.

### Reaction

The per-event result of a subscription match, including the consumer type, status, timing, output, and error when present.

### Event retention

The policy for pruning recorded event history while leaving the event bus able to dispatch new events.

Use **retention** for history cleanup; do not use it to describe whether an event dispatches reactions.

Use **reaction** for event-bus dispatch records, not for the subscription definition.

### Scheduled task

The persisted daemon task definition behind an automation, with schedule, target, prompt, model, cwd, timeout, catch-up window, and thread binding.

Use **scheduled task** for daemon/API/tooling details; use **automation** for the user-facing concept.

### Catch-up window

The time window in which a missed scheduled automation may still fire after the daemon restarts or wakes.

## 5. Knowledge model

### Memory

Git-backed Markdown files that define durable agent behavior and stable context. Memory is managed by Neon Pilot at `<knowledge-root>/memory`.

Use **memory** for agent-owned standing context such as `memory/system.md`, scoped memory files, and memory skills. Do not use **knowledge base** for this behavior layer.

### System memory

The always-loaded memory file at `memory/system.md`.

Use **system memory** for global standing preferences and instructions that should be injected into every agent run.

### Memory scope

A named memory subdivision under `memory/scopes/<scope>/memory.md`. Scopes can activate from frontmatter rules such as workspace roots, aliases, or an explicit thread selection.

Use **memory scope** rather than **project** when the grouping is generic or activation-based. A project can be represented as a memory scope, but not every memory scope is a project.

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

The persistent desktop frame around applications: the application taskbar, launcher, navigation history, global status, routing, and application hosting.

Use **app shell** for layout chrome, not for extension-owned feature content.

### Application taskbar

The shell-owned row of open applications. Each item shows the application identity, active state, and close action. Selecting an application restores its active application view; application-owned pages and resources do not become taskbar items. Pinning is managed in the Launcher and does not keep closed applications in the taskbar.

Use **application taskbar** or **taskbar**, not tab bar or window list.

### Launcher

The shell-owned searchable menu opened from the Neon Pilot control or Command-K. It finds applications, application pages, resources, and commands, and routes the result through the owning application.

Use **launcher** for this universal navigation surface. Do not describe it as a separate start menu and command palette.

### Application view

A resumable shell-level instance of an application. Singleton applications reuse one application view; applications that support multiple instances may open more than one.

Application-owned pages and resources may change inside an application view without becoming additional shell-level views.

### Application sidebar

An application-owned navigation region on the left side of its canvas. It may contain the application's destinations and resource navigation, such as Agent pages and conversations.

Use **application sidebar** when ownership matters. It is not global app-shell navigation.

### Inspector

An application-owned contextual region for selected-object details, metadata, logs, previews, or secondary actions.

Use **inspector** for application context UI. It is not a persistent global right sidebar.

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

An application or extension UI surface. Prefer the more precise **application view**, **page**, **inspector**, **extension rail**, or **detail view** when the ownership and role are known.

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
