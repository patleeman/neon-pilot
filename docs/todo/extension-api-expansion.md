# Extension API expansion ideas

Living backlog for extension API pressure tests. Add use cases here when an extension idea exposes a missing platform seam. The goal is to keep product features in extensions and promote only reusable host primitives into core.

## Session syncer: transcript/session sync across devices

### Use case

Build an extension that syncs Personal Agent conversation transcripts/sessions across a user's devices through an online service.

Expected behavior:

- A user signs in or configures an endpoint/API token.
- The extension runs a background sync service.
- Saved conversations appear on each device with stable session IDs.
- New transcript blocks, title changes, archive/pin state, and forks propagate incrementally.
- Remote sessions can be restored without manual JSONL import/export.
- Sync status, conflicts, and errors are visible in the app.

Non-goals for the first version:

- Migrating an active in-flight agent process to another device.
- Replaying unfinished turns automatically after sync.
- Syncing secrets or machine-local credentials.
- Arbitrary filesystem/workspace sync.

### Current API fit

Feasible today:

- Backend service lifecycle via `backend.services`.
- Settings and secrets for endpoint/auth configuration.
- Extension storage for cursors and remote mapping state.
- Conversation reads through `ctx.conversations.list()`, `getMeta()`, `get()`, and `getBlocks()`.
- Manual session import/export exists as a host seam and is exercised by `system-session-exchange`.
- UI surfaces, notifications, status bar items, and top bar elements can show sync state.

Not clean today:

- No first-class incremental conversation change feed.
- No stable API to export/apply only changes since a cursor.
- Existing manual import behavior rewrites IDs on collision, which is wrong for device sync.
- No merge/conflict contract for concurrent edits across devices.
- No blob/resource sync API for transcript-adjacent assets.
- No explicit policy boundary for active/running conversations.

### Proposed APIs

Add a focused conversation sync seam rather than making extensions tail JSONL files.

```ts
ctx.conversations.sync.listChanges(input: {
  sinceCursor?: string | null;
  limit?: number;
}): Promise<{
  cursor: string;
  hasMore: boolean;
  changes: ConversationSyncChange[];
}>;

ctx.conversations.sync.exportChanges(input: {
  sinceCursor?: string | null;
  sessionIds?: string[];
  limit?: number;
}): Promise<ConversationSyncBundle>;

ctx.conversations.sync.applyChanges(input: {
  bundle: ConversationSyncBundle;
  conflictPolicy?: 'fail' | 'lastWriterWins' | 'appendOnlyMerge';
  preserveSessionIds?: boolean;
}): Promise<{
  cursor: string;
  applied: number;
  conflicts: ConversationSyncConflict[];
}>;

ctx.conversations.sync.getSessionSnapshot(input: {
  sessionId: string;
  includeBlobs?: boolean;
}): Promise<ConversationSyncSnapshot>;

ctx.conversations.sync.applySessionSnapshot(input: {
  snapshot: ConversationSyncSnapshot;
  preserveSessionId: boolean;
  conflictPolicy?: 'fail' | 'replace' | 'merge';
}): Promise<{ sessionId: string; conflicts: ConversationSyncConflict[] }>;
```

Potential change types:

- `session.created`
- `session.deleted` or `session.tombstoned`
- `session.metadata.updated` — title, cwd, model metadata, timestamps
- `session.workspace.updated` — open/pinned/archived state if this remains shared syncable state
- `transcript.block.appended`
- `transcript.block.updated`
- `transcript.block.deleted` or tombstoned, if supported
- `session.forked`
- `session.compacted`
- `blob.added`
- `blob.deleted`

### Host event subscriptions

Add persisted session events separate from live run lifecycle events:

```json
{
  "contributes": {
    "subscriptions": [{ "id": "session-sync", "source": "conversationSessions", "pattern": "*", "handler": "onSessionChange" }]
  }
}
```

Events should fire for durable session mutations, including changes created by import/apply APIs. The sync API still needs cursors because services can be offline or disabled.

### Merge model

Recommended first version:

- Treat transcript blocks as append-only records with stable IDs.
- Preserve session IDs across devices.
- Use last-writer-wins for simple metadata fields.
- Use tombstones for deletes to avoid resurrection.
- Do not auto-resume or duplicate active runs.
- Represent active remote conversations as read-only/stale until the local device explicitly resumes them.

Open questions:

- Are session IDs globally unique enough as-is, or should sync introduce a device/account namespace?
- Which conversation sidebar state is personal-to-device vs syncable? Open tabs may be local; archived/pinned probably syncable.
- How should compaction summaries and hidden context windows merge?
- What is the blob identity model for images, attachments, artifacts, and tool output files?
- Should sync bundles be encrypted by the extension, by the host, or left to the remote provider?

### MVP extension shape

Manifest capabilities:

- `backend.services` for the sync loop.
- `contributes.settings` or `settingsComponent` for server/account config.
- `contributes.secrets` for API token.
- `contributes.topBarElements` or `statusBarItems` for sync status.
- Optional main page for sync diagnostics and conflict resolution.

MVP product constraints:

- Sync idle/saved sessions only.
- Poll with cursor until host subscriptions are available.
- No active run migration.
- No secret sync.
- Blob sync can be deferred unless transcript assets are already inline.

### Why this belongs in core

The extension should own the online-service integration, account UX, conflict UI, and sync policy. Core should own the durable conversation log boundary: change cursors, stable IDs, safe apply semantics, and resource/blob references. Letting an extension scrape session JSONL files would bypass storage invariants and create duplicate-tool-execution footguns.

## Kanban task board: one conversation per task

### Use case

Build a dark factory style Kanban board extension where each card is backed by one Personal Agent conversation. Moving a card through columns changes task state; opening a card opens or focuses the associated conversation.

Expected behavior:

- A board has columns such as Backlog, Ready, In Progress, Review, Blocked, Done.
- Creating a card creates a conversation seeded with the task prompt/context.
- Each card stores a stable `conversationId` and task metadata.
- Dragging a card between columns updates task state.
- The board can show live/running state from the backing conversation.
- A card can resume/run the agent on that conversation with a board-specific prompt.
- Conversation list rows can show board/task badges or status.
- Board state survives app restarts and can be filtered by workspace/project.

Nice-to-have behavior:

- Multiple boards/projects.
- WIP limits and swimlanes.
- Task dependencies.
- Bulk actions: start next task, continue all blocked tasks, summarize done column.
- Conversation templates per column transition.
- A workbench/right-rail companion for the current task.

### Current API fit

Feasible today:

- Main page React UI for the board.
- Extension storage for board/card/column state.
- `ctx.conversations.create()` to create one conversation per card.
- `ctx.conversations.setTitle()` to keep conversation title aligned with card title.
- `ctx.conversations.getMeta()`, `get()`, and `getBlocks()` to render card summaries.
- `ctx.conversations.runTurn()` or `sendMessage()` to drive/resume a backing conversation.
- `ctx.conversations.updateWorkspace()` to open/focus board conversations in the shared conversation workspace.
- Conversation decorators, activity tree item elements/actions, context menus, and message actions for light integration with the normal conversation UI.
- Commands/keybindings for quick card creation or moving selected cards.

Not clean today:

- Conversation metadata is not a first-class extension-owned index. The board can store `cardId -> conversationId`, but the conversation itself cannot reliably advertise `belongsToBoard/cardId/status` in a queryable host-owned way.
- No stable API to query conversations by extension metadata/tags.
- No first-class task/card object that can appear in the activity tree beside conversations/runs.
- No host-owned drag/drop model for activity tree or conversation rows; the board must own all Kanban drag/drop UI.
- No event subscription for durable conversation title/archive/delete changes, so board cards can drift if the user edits conversations outside the board.
- No explicit relationship API between conversations, e.g. `task conversation`, `parent board`, `dependency`, `blockedBy`.
- Running state is available through live lifecycle pieces, but durable indexing of run/task status needs clearer seams.

### Proposed APIs

Add extension-owned conversation metadata so product extensions can attach small indexed facts to host conversations without owning the conversation store.

```ts
ctx.conversations.metadata.set(input: {
  conversationId: string;
  namespace?: string; // defaults to ctx.extensionId
  values: Record<string, string | number | boolean | null>;
}): Promise<void>;

ctx.conversations.metadata.get(input: {
  conversationId: string;
  namespace?: string;
}): Promise<Record<string, unknown>>;

ctx.conversations.metadata.query(input: {
  namespace?: string;
  where: Array<{ key: string; op: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
  orderBy?: Array<{ key: string; direction: 'asc' | 'desc' }>;
  limit?: number;
}): Promise<Array<{ conversationId: string; metadata: Record<string, unknown> }>>;
```

Add durable conversation/session events so board state stays consistent when users act outside the board:

```json
{
  "contributes": {
    "subscriptions": [
      { "id": "board-conversations", "source": "conversationSessions", "pattern": "session.*", "handler": "onConversationSessionChange" }
    ]
  }
}
```

Potential events:

- `session.created`
- `session.renamed`
- `session.archived`
- `session.unarchived`
- `session.deleted`
- `session.restored`
- `session.forked`
- `session.run.started`
- `session.run.ended`

Optional relationship API if this pattern repeats across extensions:

```ts
ctx.conversations.relations.add(input: {
  fromConversationId: string;
  toConversationId?: string;
  kind: string; // e.g. "board-card", "depends-on", "spawned-from"
  metadata?: Record<string, unknown>;
}): Promise<void>;

ctx.conversations.relations.query(input: {
  kind?: string;
  conversationId?: string;
}): Promise<ConversationRelation[]>;
```

Optional activity tree contribution if task cards should be first-class sidebar/activity items rather than only a main-page board:

```json
{
  "contributes": {
    "activityTreeProviders": [{ "id": "kanban-tasks", "provider": "listKanbanActivityItems", "title": "Tasks" }]
  }
}
```

### MVP extension shape

Manifest capabilities:

- Main page view and nav item for the Kanban board.
- Backend actions for create/move/update/delete card.
- `conversations:readwrite` for creating and driving backing conversations.
- `storage:readwrite` for board state.
- Conversation decorators or activity tree item elements for board status badges.
- Optional right-rail/workbench detail view for the selected card.

MVP product constraints:

- Store board/card state in extension storage.
- Use one conversation per card.
- Treat extension storage as the source of truth for column/status.
- Mirror card title into the conversation title.
- Navigate/focus the backing conversation when opening a card.
- Avoid syncing board state into conversation metadata until the metadata API exists.

### Why this mostly works as an extension

The board UI, workflow rules, dark factory styling, task prompts, and automation policy are extension-owned product behavior. Core only needs a better generic way to let extensions attach/query small metadata on conversations and subscribe to durable session mutations. Without that, the MVP still works, but it has a brittle split brain: the board knows about conversations, while conversations do not know they are board tasks. Classic tiny goblin database problem.

## RAG tool and skill search

### Use case

Build an extension that provides semantic/RAG search over local tools, extension tools, built-in skills, extension-contributed skills, docs, and possibly prior conversations. The agent can call a search tool when it needs the right capability or workflow instructions, and the UI can expose the same index through command palette or a main search page.

Expected behavior:

- Index skills, tool descriptions/schemas, extension READMEs, docs, and selected knowledge files.
- Expose an agent-callable search tool such as `search_capabilities`.
- Return ranked results with titles, snippets, source type, and stable references.
- Optionally inject selected result content into the prompt as hidden context.
- Keep the index fresh as extensions are enabled/disabled, skills change, or docs are edited.
- Let users inspect why a result matched.

### Current API fit

Feasible today:

- Extension tools can implement the agent-callable RAG search surface.
- `contributes.searchProviders` can expose backend-powered global search.
- `quickOpen`, mentions, and prompt references can provide UI and prompt-context flows.
- Extension storage or extension-owned files can hold an index.
- `ctx.vault` and workspace filesystem APIs can read selected knowledge/workspace content.
- `ctx.extensions.listActions()` lists callable extension actions.
- Manifest-declared skills and tools are visible enough at registry time for host code, though not exposed as one clean catalog API.

Not clean today:

- No stable host API to list all enabled skills with resolved content, source path, extension id, and trigger description.
- No stable host API to list all active agent tools with final model-facing name, schema, provider/model conditions, replacement status, and prompt guidance.
- No extension lifecycle/catalog change events to incrementally refresh the index.
- No embedding/vector-store seam. Each extension would bring its own local embedding model, remote embedding API, or brute-force search.
- No first-class API to inject retrieved context into a turn except prompt references/slash commands or normal tool results.
- Tool availability is stable per agent session, so dynamic per-turn search-tool registration is intentionally not a thing.

### Proposed APIs

Add a read-only capability catalog seam:

```ts
ctx.capabilities.listSkills(input?: {
  enabledOnly?: boolean;
  includeContent?: boolean;
}): Promise<Array<{
  id: string;
  title?: string;
  description?: string;
  source: 'vault' | 'extension' | 'repo' | 'system';
  extensionId?: string;
  path?: string;
  content?: string;
}>>;

ctx.capabilities.listTools(input?: {
  enabledOnly?: boolean;
  includeSchemas?: boolean;
}): Promise<Array<{
  id: string;
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  source: 'builtin' | 'extension' | 'mcp';
  extensionId?: string;
  replaces?: string;
  when?: Record<string, unknown>;
  promptGuidelines?: string[];
}>>;
```

Add catalog change subscriptions:

```json
{
  "contributes": {
    "subscriptions": [{ "id": "capability-index", "source": "capabilities", "pattern": "*", "handler": "onCapabilityCatalogChange" }]
  }
}
```

Potential events:

- `skill.added`
- `skill.updated`
- `skill.removed`
- `tool.added`
- `tool.updated`
- `tool.removed`
- `extension.enabled`
- `extension.disabled`

Optional shared retrieval seam if multiple extensions need this:

```ts
ctx.retrieval.createIndex(input: { id: string; embeddingModel?: string; dimensions?: number }): Promise<void>;
ctx.retrieval.upsert(input: { indexId: string; documents: RetrievalDocument[] }): Promise<void>;
ctx.retrieval.search(input: { indexId: string; query: string; limit?: number }): Promise<RetrievalResult[]>;
ctx.retrieval.delete(input: { indexId: string; ids: string[] }): Promise<void>;
```

### MVP extension shape

Manifest capabilities:

- Agent tool for capability search.
- Backend service or startup action to build/update the index.
- Search provider and/or quick-open surface for UI search.
- Settings for sources and embedding provider.
- Optional prompt reference resolver for attaching selected skill/tool docs.

MVP product constraints:

- Start with lexical search over skill/tool metadata and content.
- Keep a private extension index in storage.
- Refresh on extension reload/startup until catalog events exist.
- Do not mutate the active tool list dynamically.

### Why this needs small core support

The search experience belongs in an extension, but the catalog does not. Core already assembles the active skills and tools; extensions need a safe, read-only view of that final catalog. Otherwise every RAG extension will rediscover capabilities by scraping manifests, vault files, and runtime internals like a possum in the walls.

## Per-turn reminder nudge

### Use case

Build an extension that injects a reminder into every agent turn, for example: "Remember to be concise", "Check tests before done", or "Prefer extension APIs over core edits." This could be global, workspace-specific, conversation-specific, or conditional based on model/provider/tool availability.

Expected behavior:

- User configures one or more reminder rules.
- Before each agent turn, matching reminders are added to the prompt/context.
- Reminders can be scoped by workspace, conversation, model, provider, mode, or tags.
- The UI can show which reminders were injected for the current turn.
- Reminders should not require modifying extension `before_agent_start` system prompts directly.

### Current API fit

Feasible today, but with caveats:

- `backend.agentExtension` can hook `before_agent_start` and modify the system prompt.
- Settings/storage can hold reminder rules.
- Conversation lifecycle UI can show reminder state if the extension records it.

Not clean today:

- Repo rules explicitly say extensions should not modify the system prompt from `before_agent_start`; use file-based instruction layers instead.
- There is no first-class extension contribution for per-turn instruction/context injection.
- No structured priority/order model for multiple extensions adding turn context.
- No visibility/debug surface showing exactly which extension injected which reminder.
- No scoped enablement model for reminders beyond custom extension code.
- No token-budget policy for injected reminders.

### Proposed APIs

Add a manifest contribution for turn context providers. This keeps reminders out of raw system-prompt mutation and gives the host a debuggable, ordered context assembly pipeline.

```json
{
  "contributes": {
    "turnContextProviders": [
      {
        "id": "reminders",
        "handler": "provideTurnReminders",
        "title": "Turn reminders",
        "priority": 50,
        "scope": ["global", "workspace", "conversation"]
      }
    ]
  }
}
```

Backend handler shape:

```ts
export async function provideTurnReminders(
  input: {
    conversationId: string;
    cwd?: string | null;
    model?: string;
    provider?: string;
    runMode?: string;
    estimatedTokenBudget?: number;
  },
  ctx: ExtensionBackendContext,
): Promise<{
  blocks: Array<{
    id: string;
    title?: string;
    content: string;
    priority?: number;
    visibility?: 'hidden' | 'debug' | 'visible';
    maxTokens?: number;
  }>;
}>;
```

Add a turn context inspection surface:

```ts
ctx.conversations.getTurnContextTrace(input: {
  conversationId: string;
  turnId?: string;
}): Promise<Array<{
  source: 'core' | 'extension' | 'skill' | 'instruction-file';
  sourceId: string;
  title?: string;
  tokens?: number;
  contentPreview?: string;
}>>;
```

### MVP extension shape

Manifest capabilities:

- Settings/settings component for reminder rules.
- Turn context provider once the contribution exists.
- Optional conversation lifecycle banner or debug panel showing matched reminders.

MVP product constraints:

- Keep reminders short.
- Default to hidden/debug context, not visible transcript spam.
- Avoid direct system prompt mutation.
- If built before the new API exists, implement as a local instruction-file manager instead of an agent lifecycle hook.

### Why this belongs in core

The reminder rules are extension-owned, but turn context assembly is core runtime infrastructure. A first-class provider API gives ordering, token budgeting, and observability. Letting every extension monkey-patch `before_agent_start` is how we get prompt lasagna, and nobody likes prompt lasagna except future incident reports.

## Remote SSH runtime installer and session runner

### Use case

Build an extension that provisions a Personal Agent runtime on a remote machine over SSH, then lets selected conversations run on that remote host instead of the local machine.

Expected behavior:

- User configures an SSH target, authentication method, remote install directory, and default workspace paths.
- The extension checks remote prerequisites, installs or updates the agent runtime, and reports health/version.
- A user can choose a remote runtime when starting or resuming a conversation.
- Tool execution, shell commands, workspace filesystem access, and long-running agent work happen on the remote host.
- The local desktop still owns UI, transcript display, settings, and high-level session control.
- Remote runtime logs, status, and failures are visible locally.
- Remote sessions can be stopped, restarted, or brought back local when safe.

Nice-to-have behavior:

- Multiple named remote runtimes.
- Per-workspace default remote target.
- Remote runtime auto-update matching local app/runtime version.
- Port forwarding or reverse tunnel setup for event streams.
- Remote filesystem browser scoped to configured workspaces.
- Remote capability diagnostics: models, tools, env, sandbox policy, git status.

### Current API fit

Feasible today:

- Main page/settings UI for remote targets.
- Secrets for SSH credentials or private key references.
- Backend actions/services for install, health checks, and background monitoring.
- `ctx.shell` can run local `ssh`/`scp` commands if the host policy allows it.
- `ctx.runs`/`ctx.executions` can represent long-running install/update/health jobs.
- Protocol entrypoints could support a custom bridge process if the extension owns both ends.

Not clean today:

- No first-class remote runtime registry.
- No supported way for an extension to say "run this conversation on runtime X".
- Tool execution and filesystem authority are currently local-host concepts; remoting them by shelling into SSH would bypass host policy and transcript invariants.
- No transport abstraction for agent runtime event streams, tool calls, cancellation, compaction, and session persistence across a remote boundary.
- No remote workspace authority model: allowed paths, path display, file reads/writes, and sandbox policy need host-owned semantics.
- No remote install/update lifecycle seam with version compatibility checks.
- Secrets and environment handling for remote hosts need explicit boundaries.
- Active run recovery is dangerous if reconnect semantics are not host-owned.

### Proposed APIs

Add a remote runtime provider seam. Extensions can own provisioning and connection details, while core owns the contract for running conversations against a runtime.

```json
{
  "contributes": {
    "runtimeProviders": [
      {
        "id": "ssh",
        "title": "SSH Remote Runtime",
        "handler": "provideSshRuntimes"
      }
    ]
  }
}
```

Provider shape:

```ts
export async function provideSshRuntimes(
  _input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{
  runtimes: Array<{
    id: string;
    title: string;
    kind: 'remote';
    status: 'unknown' | 'installing' | 'healthy' | 'degraded' | 'offline';
    version?: string;
    workspaceRoots?: Array<{ id: string; path: string; label?: string }>;
    capabilities?: Array<'agentSessions' | 'shell' | 'filesystem' | 'git' | 'executions'>;
  }>;
}>;
```

Conversation runtime selection:

```ts
ctx.conversations.create({
  title: 'Remote task',
  cwd: '/srv/app',
  runtimeId: 'system-remote-ssh/prod-box',
});

ctx.conversations.ensureLive(conversationId, {
  runtimeId: 'system-remote-ssh/prod-box',
  cwd: '/srv/app',
});
```

Runtime management APIs:

```ts
ctx.runtimes.list(): Promise<RuntimeSummary[]>;
ctx.runtimes.get(runtimeId: string): Promise<RuntimeDetail>;
ctx.runtimes.install(input: { providerId: string; targetId: string; version?: string }): Promise<ExecutionSummary>;
ctx.runtimes.update(runtimeId: string, input?: { version?: string }): Promise<ExecutionSummary>;
ctx.runtimes.healthCheck(runtimeId: string): Promise<RuntimeHealth>;
ctx.runtimes.remove(runtimeId: string): Promise<void>;
```

Remote session transport contract, owned by core/runtime rather than ad hoc SSH command output:

```ts
interface RemoteRuntimeConnection {
  startSession(input: RemoteSessionStartInput): Promise<RemoteSessionHandle>;
  resumeSession(input: { sessionId: string; conversationId: string }): Promise<RemoteSessionHandle>;
  send(input: { sessionId: string; message: string; mode?: 'steer' | 'followUp' }): Promise<void>;
  cancel(input: { sessionId: string }): Promise<void>;
  subscribe(input: { sessionId: string; onEvent(event: RemoteRuntimeEvent): void }): Promise<{ unsubscribe(): void }>;
}
```

Remote filesystem authority should reuse the existing filesystem boundary with a remote root kind:

```ts
ctx.filesystem.requestRoot({
  kind: 'remoteWorkspace',
  runtimeId: 'system-remote-ssh/prod-box',
  cwd: '/srv/app',
  access: ['read', 'write'],
  reason: 'Browse remote workspace for this conversation',
});
```

### Security and policy requirements

- Remote targets are trusted but explicit: users must approve host, workspace roots, and capabilities.
- SSH secrets should use `ctx.secrets`; private keys should be referenced, not copied into extension storage.
- The host should display when a conversation is remote and which machine owns execution.
- Remote tools must preserve normal transcript/tool-call accounting.
- Remote workspace access must be scoped and visible; no magic `ssh cat arbitrary path` nonsense.
- Remote runtime version compatibility must be checked before starting sessions.

### MVP extension shape

Manifest capabilities:

- Main page/settings component for configured SSH runtimes.
- Backend actions for install, update, health check, remove.
- Backend service for periodic health checks.
- Secrets for SSH credentials.
- Runtime provider contribution once available.
- Conversation header/status bar element showing remote runtime for the active session.

MVP product constraints:

- Start with one remote runtime per configured SSH target.
- Support idle/new sessions only; no live migration in the first cut.
- Require explicit user selection of remote runtime per conversation or workspace.
- Remote runtime must match local compatible protocol version.
- Do not tunnel arbitrary local app internals; speak a narrow runtime protocol.

### Why this needs core support

Provisioning over SSH is extension-owned integration work. Actually running a conversation remotely is core runtime routing, filesystem authority, transcript persistence, cancellation, and tool accounting. If an extension fakes it with `ssh personal-agent run ...`, it will work until it absolutely does not, probably while holding a chainsaw. Core needs a runtime-provider boundary so remotes are boring instead of haunted.

## Built-in conversation implementation notes side panel

### Use case

Build a built-in conversation surface, exposed in the right side panel, that keeps running implementation notes while an agent works on a task. The notes capture decisions the agent had to make, spec gaps, changed assumptions, tradeoffs, risks, follow-up tasks, and anything the user should know after the implementation.

Expected behavior:

- The right side panel has a first-class Implementation Notes surface for the active conversation.
- Notes are stored in durable conversation metadata, not as a random workspace file by default.
- The agent is nudged to maintain notes during work, not just summarize at the end.
- The notes can be viewed and edited live while the agent works.
- The final response links to the notes and summarizes the most important decisions.
- The extension can optionally enforce that notes were updated before marking work done.

Nice-to-have behavior:

- Template sections: decisions, deviations from spec, tradeoffs, test/validation notes, risks, follow-ups.
- Diff-aware notes that link to changed files or transcript blocks.
- Per-task notes for Kanban cards or goal-mode runs.
- Automatic finalization: convert scratch notes into a clean handoff doc.
- Export notes to markdown/html/artifact when needed, while keeping conversation metadata as the source of truth.

### Current API fit

Feasible today as an extension prototype:

- A slash command or composer attachment provider can start a task with the implementation-notes instruction included.
- Extension storage can hold notes state.
- `ctx.conversations.appendTranscriptBlock()` can show extension-authored notes/status in the transcript.
- A right-rail extension view can show a notes editor for the active conversation.
- Conversation lifecycle UI can show whether notes are active for the current conversation.
- A message action or toolbar action can create/open/finalize notes.

Not clean today:

- This wants to be a built-in conversation surface, not a standalone product extension. Notes are a core conversation affordance like transcript, runs, diffs, and context.
- Conversation metadata currently is not a typed document store suitable for a first-class notes document with versioning/update semantics.
- Extensions can store notes keyed by `conversationId`, but the notes would not travel with the conversation metadata or participate in import/export/sync by default.
- No first-class per-turn context provider yet; the clean reminder to update notes overlaps with the proposed `turnContextProviders` API.
- No reliable "before final answer" hook where an extension can check/finalize notes before the assistant says done.
- No structured hook for "task started / task completed" across manual turns, goal mode, Kanban cards, and background agents.
- No host-owned way to require or validate notes before completing a turn.

### Proposed APIs

This feature should be a built-in conversation metadata document plus a right-rail surface. It still benefits from the same turn-context seam as the reminder nudge, plus a completion/checkpoint hook.

Conversation metadata API:

```ts
ctx.conversations.notes.get(input: {
  conversationId: string;
}): Promise<ConversationImplementationNotes | null>;

ctx.conversations.notes.update(input: {
  conversationId: string;
  expectedVersion?: number;
  patch?: Array<{ op: 'add' | 'replace' | 'remove'; path: string; value?: unknown }>;
  document?: ConversationImplementationNotes;
}): Promise<{ notes: ConversationImplementationNotes; version: number }>;

ctx.conversations.notes.export(input: {
  conversationId: string;
  format: 'markdown' | 'html';
}): Promise<{ content: string; filename: string }>;
```

Document shape:

```ts
interface ConversationImplementationNotes {
  schemaVersion: 1;
  enabled: boolean;
  updatedAt: string;
  summary?: string;
  decisions: Array<{ id: string; text: string; createdAt: string; sourceBlockId?: string }>;
  specGaps: Array<{ id: string; text: string; createdAt: string; sourceBlockId?: string }>;
  tradeoffs: Array<{ id: string; text: string; createdAt: string; sourceBlockId?: string }>;
  changes: Array<{ id: string; text: string; paths?: string[]; createdAt: string; sourceBlockId?: string }>;
  validation: Array<{ id: string; text: string; status?: 'passed' | 'failed' | 'skipped'; createdAt: string }>;
  followUps: Array<{ id: string; text: string; status?: 'open' | 'done' | 'wont-do'; createdAt: string }>;
}
```

Right panel contribution could be core-owned rather than extension-owned:

```ts
conversationPanels.registerBuiltIn({
  id: 'implementation-notes',
  title: 'Implementation Notes',
  scope: 'conversation',
  activation: 'on-open',
});
```

If kept extensible, expose the same notes API so other extensions can read/update notes safely without owning the storage format.

```json
{
  "contributes": {
    "turnContextProviders": [
      {
        "id": "implementation-notes-reminder",
        "handler": "provideImplementationNotesContext",
        "title": "Implementation notes reminder",
        "priority": 60,
        "scope": ["conversation", "workspace"]
      }
    ],
    "turnCompletionChecks": [
      {
        "id": "implementation-notes-check",
        "handler": "checkImplementationNotes",
        "title": "Implementation notes check",
        "severity": "advisory"
      }
    ]
  }
}
```

Completion check handler shape:

```ts
export async function checkImplementationNotes(
  input: {
    conversationId: string;
    cwd?: string | null;
    turnId: string;
    isLikelyFinalResponse: boolean;
  },
  ctx: ExtensionBackendContext,
): Promise<{
  ok: boolean;
  message?: string;
  actions?: Array<{ title: string; command: string; args?: unknown }>;
}>;
```

Optional durable task/run lifecycle events would make this cleaner:

```json
{
  "contributes": {
    "subscriptions": [{ "id": "notes-task-lifecycle", "source": "agentTasks", "pattern": "*", "handler": "onAgentTaskEvent" }]
  }
}
```

Potential events:

- `task.started`
- `task.updated`
- `task.completed`
- `task.failed`
- `checkpoint.started`
- `checkpoint.completed`

### MVP extension shape

MVP product shape:

- Built-in right side panel for the active conversation.
- Conversation metadata storage for notes.
- Slash command or toolbar action to enable/disable notes for the current conversation.
- Optional conversation lifecycle banner showing notes status.
- Export action to markdown/html.
- Agent-facing tool or context provider for updating notes.

MVP product constraints:

- Store notes in conversation metadata as source of truth.
- Inject the reminder through a slash-command-generated prompt until `turnContextProviders` exists.
- Keep completion checks advisory at first; hard blocking final responses is annoying unless very explicit.
- Do not require every task to use notes. Make it opt-in per conversation/workspace.

### Why this should be built in

The original prompt-helper version mostly works as an extension, but the desired product is a conversation-native side panel with notes stored in conversation metadata. That makes it part of the conversation object: it should import/export/sync with the session, survive extension disablement, and be available to any extension or agent workflow through a stable notes API. Core should own the storage shape and side-panel surface; extensions can still add templates, enforcement rules, exporters, or project-specific note processors. Otherwise we get yet another sidecar store keyed by `conversationId`, which is technically fine and spiritually cursed.
