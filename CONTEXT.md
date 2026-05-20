# Context Glossary

This file defines the shared product language for Neon Pilot. It is a glossary only: no implementation details, specs, TODOs, or architecture decisions.

When a term is resolved or corrected, update this file immediately. If a decision needs rationale, use an ADR instead.

## Product and runtime

### Neon Pilot

The product in this repository: a durable AI agent runtime with a desktop app, background automation, extensions, and knowledge management.

### Agent

The AI actor executing a user request. An agent can call tools, read context, produce assistant messages, and delegate work to subagents.

Use **agent** for the executing AI worker. Use **assistant message** for text the agent writes into a conversation.

### Runtime

The system that runs agents, tools, conversations, extensions, storage, and background work.

Use **runtime** for the operating environment, not for a single background job.

### Daemon

The long-lived background process that owns durable runtime services such as scheduled automations, persisted runs, and background execution.

### Desktop app

The Electron user interface for conversations, workbench views, settings, automations, and other extension-provided surfaces.

### Core

The small stable platform: agent/conversation runtime, transcript/event stream, durable storage primitives, prompt assembly, extension host, security boundaries, desktop/web shell, routing, install/update plumbing, and shared UI primitives.

Do not use **core** for product workflows that should live in extensions.

### Extension

A package that contributes product features on top of core: pages, panels, tools, skills, commands, context providers, integrations, diagnostics, settings, and workflow UX.

### System extension

A bundled extension shipped with the app or repo. System extensions can still own product-facing features; they are not automatically core.

### User extension

A runtime-installed extension owned by the user rather than bundled with the app.

## Conversations and transcript

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

## Work execution

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

## Prompt and capability model

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

### Prompt template

Reusable prompt text selectable or contributed through prompt assembly surfaces.

## Knowledge and files

### Knowledge base

The git-backed durable repository of Patrick’s reusable knowledge, docs, instruction files, skills, and project notes.

### Vault

The effective local root directory for durable knowledge files. The vault may be a managed clone of the knowledge base.

Use **vault** when discussing local file resolution; use **knowledge base** when discussing the durable collection or sync.

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

## UI surfaces

### Workbench

A split-pane workspace for conversation-adjacent surfaces such as file detail views, browser panels, knowledge files, and extension-provided detail views.

### View

An extension-contributed UI surface, such as a main page, right rail panel, or workbench detail.

### Right rail

A side panel in the desktop app, often used for conversation-specific context or navigation.

### Activity tree

The shared model and UI surface for conversations, runs/executions, and future sidebar sub-items.

### Tool shelf

A compact transcript shelf that groups low-level tool-call plumbing or internal work while keeping important side outputs visible.

### Checkpoint

A targeted git commit created by the checkpoint tool to save the agent’s current work.

Do not use **checkpoint** for arbitrary save points in conversation history.

## Browser terms

### Workbench Browser

The built-in desktop browser surface visible to the user inside Neon Pilot.

### agent-browser

The automation skill/CLI used by agents for autonomous browser or Electron validation.

Do not use Workbench Browser tools for unattended product testing when agent-browser is the right boundary.
