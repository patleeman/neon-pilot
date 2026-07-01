# Release test inventory

This is the release checklist source of truth: every page, extension, context, agent tool, command, and user-facing interaction that should be covered before shipping Neon Pilot.

Use this as an inventory, not a test script. Each row implies happy path, error path, loading/empty state, persistence after reload, keyboard accessibility, and visual regression checks where UI exists.

## App shell and global contexts

### Desktop app shell

- App launch, runtime boot, daemon connection, reconnect after daemon restart.
- First window creation, close-to-hide behavior, reopen behavior, quit confirmation, external daemon warning.
- Menu bar/tray presence and context menu.
- Application menus: app menu, File, Edit, View, Window; Settings menu item; layout mode switchers.
- Auto-update dialogs: unsupported build OK, no update OK, update available Later, Restart to Update, update error OK.
- Deep links into conversations, pages, and extension views.
- Desktop shortcuts delivered into the active conversation window.
- Window layout modes: Conversation view and Workbench view.
- Navigation: sidebar, extension nav items, back/forward route behavior, refresh/reload.
- Theme/branding: Neon Pilot name, icon assets, light/dark/system themes.

### Conversation/workbench core

- Routes: `/`, `/conversations`, `/conversations/new`, `/conversations/:id`, and extension fallback routes.
- Conversation list: create, open, search/palette, duplicate, archive/delete if available, title updates.
- Left sidebar: conversation grouping, archived section, hover quick actions, close/archive controls, working directory quick select modal, new conversation button.
- Command palette: open/archived conversations scope, files/quick-open scope, extension commands, extension search providers, keyboard navigation, empty/search/error states.
- Composer: send prompt, multiline input, submit shortcuts, disabled/loading states, model selection, cwd display, context attachments, image/file attachments, dictation input, Excalidraw input.
- Bash shortcut parsing: whole-line `!command` and `!!command`; empty/inline bang ignored.
- Streaming transcript: user messages, assistant text, tool calls, tool results, errors, collapsed/expanded shelves, pinned tool rows.
- Stop/cancel running agent, retry/try again, continue/resume, compact/context-hardening flows.
- Branching/topology: alternate replies, branch navigation, transcript-native topology events.
- Conversation context menu: duplicate conversation, copy working directory, copy conversation ID, copy deeplink.
- Conversation header actions contributed by extensions, including Import Session when enabled.
- Working directory group context menu: copy working directory and grouped conversation behavior.
- Selection context menu: copy/selection actions.
- Workbench tool tabs and tab-local rails: open, close, switch tabs, detail panes, preserved sizing.
- Conversation resume after app restart: pending tool calls, background work, bash output, agent state.

### Agent tool execution baseline

- Tool permission display and transcript rendering for every built-in tool.
- Successful call, invalid input validation, thrown error, long-running call, cancellation if supported.
- JSON/schema rendering in transcript shelves.
- Tool availability changes when extensions are enabled/disabled.

## Built-in pages and extension surfaces

### `/settings` — Settings panels (`system-settings`)

- Nav item: Settings.
- Command: `open-settings`.
- Pages/views: Settings, Provider settings, Desktop settings.
- Settings keys: `secrets.provider` (`keychain`, `file`, `env-only`), `conversation.transcriptDisclosure` (`auto`, `expanded`), `conversation.diffDisclosure`, and `conversation.pinnedToolCalls`.
- Test provider add/edit/remove, model/provider validation, secrets redaction, desktop preferences, keyboard shortcut preferences, persistence after restart.
- Extension settings components hosted here: extension repositories, Knowledge Base when installed, Dictation, MCP tools, Image Probe, AI Gateway, Neon Pilot CLI.

### `/settings/providers` — Provider settings

- Provider list, add/edit provider, default model, API key/secret handling, invalid credential messaging.
- Model availability refresh and selected model propagation to composer/model picker.

### `/settings/desktop` — Desktop settings

- App mode preferences, keyboard shortcut validation, startup/runtime behavior, theme/display preferences.

### `/extensions` — Extension Manager (`system-extension-manager`)

- Nav item: Extensions.
- Actions: `listExtensions`, `createExtension`, `snapshotExtension`, `reloadExtension`, `validateExtension`, `listHostViewComponents`, `readSearchPaths`, `updateSearchPaths`, `manageExtension`.
- Page controls: extension list, enable/disable, reload, validate, snapshot, create extension, search paths editor, host component list.
- States: bundled system extension, installed user extension, invalid manifest, missing build artifact, action failure.
- Skills: `skills-and-capabilities`, `local-extension-development`.

### `/knowledge` and knowledge rail/detail (`system-knowledge`, installable)

- Nav item: Knowledge after installation.
- Views: Knowledge page, Knowledge left-sidebar file browser, Knowledge tree tab-local rail, Knowledge file workbench detail.
- Actions: `readState`, `updateState`, `sync`, `knowledgeListFiles`, `knowledgeTree`, `knowledgeReadFile`, `knowledgeWriteFile`, `knowledgeCreateFolder`, `knowledgeDeleteFile`, `knowledgeRename`, `knowledgeMove`, `knowledgeBacklinks`, `knowledgeSearch`, `knowledgeUploadImage`, `knowledgeImportUrl`, `resolvePromptReferences`.
- Prompt reference provider: `knowledge-files`.
- Quick open provider: `knowledge-files` in the command palette files section.
- Mentions provider: `knowledge-files` in the conversation `@` menu for note, folder, and file kinds.
- Settings component: `knowledge-base` / Knowledge Base.
- Test file tree, open file, edit/save, create folder, rename, move, delete, backlinks, search, image upload, URL import, sync status, conflict/error states.
- Context menu: knowledge entry actions.

### `/automations` — Automations (`system-automations`)

- Nav item: Automations.
- Agent tool: `scheduled_task` with actions `list`, `get`, `save`, `delete`, `validate`, `run`.
- Actions: `scheduledTask`, `deferredResume`.
- Page controls: automation list, create/edit automation, enable/disable, cron schedule, one-shot `at`, validate, run now, delete.
- Delivery modes: conversation callback, background-agent target, dedicated/existing/no conversation binding, steer vs follow-up, notify success/failure, require ack, auto-resume-if-open.
- Catch-up windows, timeouts, cwd/model/profile fields, missed schedule behavior.
- Skills: `async-attention`, `scheduled-tasks`.

### `/telemetry` — Telemetry (`system-telemetry`)

- Nav item: Telemetry.
- Test event list, filters, route timing records, extension/runtime producers, empty state, malformed log handling, export/inspection if available.
- Backend report routes/functions: summary, model usage, cost by conversation, tool health, context, agent loop, daily tokens, tool flow, cache efficiency, system prompt, auto mode, context pointers, session integrity.

### `/workflows` — Dynamic Workflows (`system-dynamic-workflows`, default disabled)

- Nav item: Workflows when enabled.
- Agent tool/action: `workflow`.
- Actions: `workflow`, `listWorkflows`, `getWorkflow`, `cancelWorkflow`, `listWorkflowTemplates`, `saveWorkflow`, `listSavedWorkflows`, `deleteSavedWorkflow`, `runSavedWorkflow`.
- Settings keys: default agent model, default allowed tools, max concurrent agents, max total agents, node timeout, workflow timeout.
- Test workflow template list, run/cancel, saved workflow create/delete/run, transcript block rendering, concurrent subagent limits, invalid JavaScript, timeout, and persisted run history.
- Skill: `dynamic-workflows`.

### `/gateways` — Telegram Gateway (`system-gateways`, bundled first-party extension)

- Nav item: Gateways.
- Gateway provider: `telegram`.
- Secret: `telegramBotToken`.
- Test Telegram setup state, token save/redaction, safe bot token check, approved user/chat ID persistence, start/stop/status, invalid token, incoming command routing, gateway sidebar, empty/error states, and extension disable cleanup.
- Test Hermes-style Telegram UX: BotFather command menu publishing, `/help`, `/whoami`, `/threads`, `/switch`, `/model` with inline keyboards, callback handling, separate streamed tool-call messages, working-message edit into final replies, failed prompt edit into error text, voice-note transcription/echo/prompt injection, HTML/rich markdown rendering, table/task-list normalization, link-preview suppression, and long-reply chunking.
- Live smoke with real credentials: save bot token, add the tester's Telegram user ID or chat ID, run Test bot, send `/whoami`, `/threads`, tap a thread button, send `/model` and tap a model, send a text prompt that uses at least one visible tool and confirm the bot sends a separate brief tool-status message before final response, send a markdown/table/task-list prompt, send a short voice note and confirm the bot echoes the transcript before the agent reply, and confirm an unapproved chat is rejected.

### Prompt Assembly runtime inspection (`system-prompt-assembly`)

- Product surface: Settings -> Extensions and Extension Manager details. Prompt Assembly does not contribute a standalone nav item or `/prompt-assembly` route.
- Actions: `inspectAgentRuntime`, `inspectPromptAssembly`, `updatePromptAssemblySkillEnabled`, `updateRuntimeCapability`.
- Test runtime capability inventory, instruction layers, skill enable/disable, runtime capability toggles, diagnostics display, reload persistence, and failure isolation.

## Workbench rails, workbench details, and transcript renderers

### Artifacts (`system-artifacts`)

- Views: Artifact workbench detail.
- Agent tool/action: `artifact` with `save`, `get`, `list`, `delete`; kinds `html`, `mermaid`, `latex`; `open` behavior.
- Transcript renderer: artifact tool block.
- Test create/update/open/delete, list ordering, malformed artifact content, sandboxing, render errors.

### Checkpoints (`system-diffs`)

- Agent tool/action: `checkpoint` with `save`, `get`, `list`; targeted `paths`, `message`, `checkpointId`.
- Transcript renderer: checkpoint pinned/tool block.
- Test targeted commits only, no unrelated files, get/list, diff rendering, large diff, binary file, error from dirty/conflicting state.

### Background work (`system-runs`)

- Views: activity shelf and inline transcript execution cards.
- Agent tools/actions: `bash`, `background_bash`, `subagent`.
- `bash`: foreground command, background command, timeout, task slug, cwd, deliver result to conversation.
- `background_bash`: `list`, `get`, `logs`, `start`, `rerun`, `cancel`.
- `subagent`: `list`, `get`, `logs`, `start`, `rerun`, `follow_up`, `cancel`; loop options; allowed tools.
- Test durable execution creation, logs tailing, rerun, cancel, completion delivery, failure delivery, linked conversation, reload recovery, activity shelf pinning.
- Skills: `runs`.

### File Explorer (`system-files`)

- Views: Workspace files tab-local rail, workspace file detail.
- Test tree load, cwd switching, file open, large file, binary/image file, diff view, readonly mode, missing file, permission errors.

### Terminal (`system-terminal`)

- View: PTY-backed terminal panel in the Workbench rail.
- Actions: `terminalCreate`, `terminalWrite`, `terminalDrain`, `terminalResize`, `terminalClose`; stream route `/stream`.
- Test create/write/read/resize/close, SSE output stream, cwd handling, shell startup failure, long output, process cleanup, and app reload cleanup.

### Browser (`system-browser`)

- Views: Browser workbench tabs.
- Commands/buttons/keybindings: open browser (`mod+shift+b`), new tab (`mod+t`), reopen closed tab (`mod+shift+t`), close tab (`mod+w`), focus location bar (`mod+l`).
- Agent tools/actions: `browser_snapshot`, `browser_cdp`, `browser_screenshot`.
- Transcript renderers: snapshot, CDP, screenshot tool blocks.
- Test navigation, address entry, tabs, close/reopen, page load errors, snapshots with element list, screenshots, CDP single/batched commands, invalid CDP, tab targeting, shared-browser warning boundary vs agent-browser.
- Skill: `browser`.

## Composer and inline extension features

### Model Picker (`system-model-picker`)

- Composer control: model preferences / model picker.
- Test selected model display, model change, persistence per conversation/global default, unavailable model handling.

### Composer Attachments (`system-composer-attachments`)

- Composer action: attach files.
- Test file picker, multiple files, remove attachment, prompt inclusion, missing/deleted file, large file, unsupported/binary files.

### Context Usage (`system-context-usage`)

- Composer context usage indicator.
- Test token/usage display, warning/overflow states, updates as attachments/context/model changes.

### Git Status (`system-git-status`)

- Composer git status indicator.
- Test clean/dirty repo, branch display, untracked files, non-git cwd, permission errors.

### Suggested Context (`system-suggested-context`, first-party optional)

- Installable new-conversation suggested context UI and prompt context provider.
- Action: `warmPointers`.
- Test install from the Settings → Extensions install dialog, enable/disable, pointer warming, suggestions list, accept/remove suggestion, stale/missing files, prompt injection.

### Reply Actions (`system-reply-actions`)

- Reply buttons/actions: agree, disagree, question, think harder, try again, do it.
- Test each action generates the expected follow-up prompt, disabled/running states, transcript placement.

### Goal Mode (`system-auto-mode`)

- Agent tool: `goal` with `objective`, `status`.
- Slash command: `/goal` for set/view/pause/resume/clear.
- Test start/replace goal, complete goal, invalid premature complete, conversation persistence, auto-mode behavior.
- Skill: `goal-mode`.

### Context Hardening (`system-context-hardening`)

- Extension ID: `system-context-hardening`.
- Test compact/context-hardening behavior from the conversation flow, context summaries, and failure/retry states.

### Excalidraw input (`system-excalidraw-input`)

- Composer action: Excalidraw.
- Command/hotkey: `composer.createDrawing` (`Cmd/Ctrl+Shift+X` default when available).
- Test open editor modal, draw/save/cancel, insert into composer, image/reference handling, reload after draft if supported.

### Local Dictation (`system-local-dictation`)

- Dictation composer/control surface.
- Command/hotkey: `dictation.toggle` (`Cmd/Ctrl+Shift+M` default when available).
- Actions: `readSettings`, `updateSettings`, `modelStatus`, `installModel`, `transcribeFile`.
- Test settings, model installed/missing/installing/error, recording/transcribe file, cancellation, microphone unavailable, inserted text.

### Caffeinate (`system-caffeinate`)

- Top bar element: `caffeinate-toggle` / Caffeinate toggle.
- Actions: `caffeinateStatus`, `caffeinateStart`, `caffeinateStop`, `caffeinateToggle`.
- Test start/stop/toggle/status, app sleep prevention indication, cleanup on quit.

### Onboarding top bar (`system-onboarding`)

- Top bar element: `onboarding-bootstrap` / Onboarding bootstrap.
- Action: `ensure` / Ensure onboarding conversation.
- Test first-run onboarding bootstrap, existing-user no-op, interrupted onboarding, generated conversation state.

## Agent tools without major pages

### Conversation tool (`system-conversation-tools`)

- Agent tool: `ask_user`.
- Actions: ask user question, conversation inspection/title/cwd helpers, deferred resume, duplicate conversation, copy working directory, copy conversation ID, copy deeplink.
- Command/keybindings: `open-thread-palette` (`mod+p`) and `open-command-palette` (`mod+shift+p`).
- Conversation list context menu IDs: `duplicate-conversation`, `copy-working-directory`, `copy-conversation-id`, `copy-deeplink`.
- Transcript renderer: terminal bash tool block.
- Tool/action operations to test: ask-user single and structured questions, inspect/list/search/query/diff/outline/read-window, title changes, cwd changes with optional continue prompt, deferred resume delay/at triggers, and conversation open-list state.

### Web/search/image tools

- `web_fetch` (`system-web-tools`): URL fetch, raw HTML option, invalid URL, network failure, large page.
- `web_search` (`system-duckduckgo-search`): DuckDuckGo HTML page search, query, count, page, empty/no-result, network failure.
- `web_search` (`system-exa-search`): query, count, page, API/config failure.
- `probe_image` (`system-image-probe`): image IDs, question, missing image, multiple images.

### MCP (`system-mcp`)

- Agent tool: `mcp` actions `list`, `get/info`, `grep`, `call`, `auth`, `logout`.
- Actions: `mcpTool`, `inspectSettings`, `saveExplicitConfig`, `testServer`, `authServer`, `logoutServer`.
- Settings component/section: MCP tools.
- Test server list with/without probe, tool info, glob search, tool call arguments JSON, OAuth auth/logout, failing server, config save, test server.

### Codex Compatibility (`system-codex-profile`)

- Agent tools/actions: `apply_patch`, `image`.
- Model profile: `codex-compatible`.
- Image tool: generate/edit, size, quality, background, source selection/count, transparent/opaque, failures.
- Test patch success, patch failure, write new file, overwrite file, invalid path, permissions, transcript output.

### Skills (`system-skills`)

- Actions: `listSkills`, `updateSkillEnabled`.
- Skills page/surface: list skills, enable/disable, search/filter if present, persistence, prompt assembly integration.

### Neon Pilot CLI (`system-neon-pilot-admin-cli`)

- Agent tool: `neon_pilot`.
- CLI commands: app update, app commands, control-plane doctor, heartbeats, bootstrap configure/doctor/defaults/provider setup.
- Settings component: Neon Pilot CLI.
- Skill: `neon-pilot-admin-cli`.
- Test command discovery, doctor output, bootstrap dry-run/setup flows, provider key stdin handling, app-command list/run, heartbeat start/list/stop, and structured JSON error output.

### AI Gateway (`system-model-gateway`, default disabled)

- Settings component: AI Gateway.
- Actions: `status`, `updateSettings`, `clearLogs`.
- Test disabled default, enable/start status, Responses-compatible loopback URL, client config copy, settings persistence, log clearing, port conflict, and disable cleanup.

## External gateway commands

### Telegram

- `/start`, `/help`, `/stop`, `/pause`, `/new`, `/model <model>`, `/rename <title>`.
- Bot mention variants, unknown command rejection, incomplete command rejection.
- Conversation attachment and force-new behavior.

## Cross-cutting release checks

- Extension enable/disable/reload changes nav, tools, skills, transcript renderers, and settings without restart where supported.
- Repo installable extensions are not visible in fresh profiles until installed into runtime state.
- All pages handle empty state, loading state, failure state, narrow window, and dark/light mode.
- All destructive actions ask for confirmation or are clearly reversible where intended.
- Secrets are never shown in transcript, logs, telemetry, exported sessions, or screenshots.
- Background/async work survives app reload and daemon restart.
- File-system operations respect scoped filesystem authority and sandbox policy.
- Telemetry records route views and important actions without sensitive payloads.
- Docs and skills linked from each extension remain loadable.
- Release build loads only prebuilt extension artifacts; missing artifacts fail loudly and understandably.

## Manifest contribution ID audit

Every contributed manifest ID below must appear in a release test plan. This section exists to catch exact buttons/actions/renderers by stable ID, even when the human-readable sections above describe them by title.

Bundled system-extension entries are derived from local `extensions/*/extension.json` manifests. First-party optional packages are listed separately because their manifests live in installable release artifacts; validate their exact IDs from the installed package manifest during release QA.

### Bundled system extensions

### system-artifacts — Artifacts

- skills: artifacts
- tools: artifact/artifact
- transcriptRenderers: artifact-tool-block for artifact
- views: conversation-artifacts, artifact-detail
- backend actions: artifact

### system-auto-mode — Goal Mode

- slashCommands: goal
- skills: goal-mode
- tools: goal/goal
- backend actions: handleSlashGoal

### system-automations — Automations

- cliCommands: tasks-list, tasks-get, tasks-save, tasks-delete, tasks-validate, tasks-run
- nav: nav (/automations)
- skills: async-attention, scheduled-tasks
- tools: scheduled-task/scheduled_task
- views: page (/automations)
- backend actions: scheduledTask, deferredResume

### system-caffeinate — Caffeinate

- commands: caffeinate.toggle
- keybindings: caffeinate.toggle [mod+shift+c]
- settings: caffeinate.autoStart
- topBarElements: caffeinate-toggle
- backend actions: caffeinateStatus, caffeinateStartup, caffeinateStart, caffeinateStop, caffeinateToggle

### system-codex-profile — Codex Compatibility

- modelProfiles: codex-compatible
- tools: apply-patch/apply_patch, image/image
- backend actions: applyPatch, image

### system-composer-attachments — Composer Attachments

- composerControls: attach-files

### system-context-hardening — Context Hardening

- agent extension: createContextHardeningAgentExtension

### system-context-usage — Context Usage

- statusBarItems: composer-context-usage

### system-conversation-tools — Conversation Tools

- cliCommands: conversations-list, conversations-search, conversations-activity, conversations-connections, conversations-inspect, conversations-transcript-read, conversations-create, ask, conversations-title, conversations-cwd, conversations-ensure-live, conversations-send, conversations-run-turn, conversations-abort, conversations-compact, conversations-fork, conversations-tools, conversations-rollback, conversations-workspace, conversations-workspace-update, conversations-open-list, conversations-open-add, conversations-open-remove, conversations-open-pin, conversations-open-unpin, conversations-open-active, conversations-archive, conversations-unarchive, conversations-delete, conversations-retention-prune, conversations-transcript-append, conversations-transcript-update
- commands: open-thread-palette, open-command-palette
- contextMenus: duplicate-conversation, copy-working-directory, copy-conversation-id, copy-deeplink
- keybindings: open-thread-palette [mod+p], open-command-palette [mod+shift+p]
- tools: ask_user/ask_user
- transcriptRenderers: terminal-bash-tool-block for bash
- backend actions: conversationTool, askUser, conversationInspect, conversationTitle, conversationCwd, deferredResume, duplicateConversation, copyWorkingDirectory, copyConversationId, copyDeeplink

### system-diffs — Diffs

- tools: checkpoint/checkpoint
- transcriptRenderers: checkpoint-tool-block for checkpoint
- backend actions: checkpoint

### system-dynamic-workflows — Dynamic Workflows (default disabled)

- nav: workflows-nav (/workflows)
- settings: dynamicWorkflows.defaultAgentModel, dynamicWorkflows.defaultAgentAllowedTools, dynamicWorkflows.maxConcurrentAgents, dynamicWorkflows.maxTotalAgents, dynamicWorkflows.nodeTimeoutMinutes, dynamicWorkflows.workflowTimeoutMinutes
- skills: dynamic-workflows
- tools: workflow/workflow
- transcriptBlocks: dynamic_workflow
- views: page (/workflows)
- backend actions: workflow, listWorkflows, getWorkflow, cancelWorkflow, listWorkflowTemplates, saveWorkflow, listSavedWorkflows, deleteSavedWorkflow, runSavedWorkflow

### system-excalidraw-input — Excalidraw input

- composerInputTools: excalidraw
- keybindings: excalidraw.createDrawing [mod+shift+x]
- views: drawings, drawing-detail

### system-agent-plugins — Agent Plugins

- settingsComponent: agent-plugins (settings-capabilities)
- backend actions: listPlugins, addPlugin, setPluginEnabled, setPluginAutoUpdate, checkPluginUpdates, updatePlugin, removePlugin

### system-extension-manager — Extension Manager

- cliCommands: extensions-list, extensions-create, extensions-snapshot, extensions-delete, extensions-catalog, extensions-install, extensions-update, extensions-install-url, extensions-validate, extensions-reload, extensions-smoke, extensions-enable, extensions-disable, extensions-paths, extensions-sources
- nav: extensions-nav (/extensions)
- settingsComponent: extension-repositories (settings-extension-repositories)
- skills: skills-and-capabilities, local-extension-development
- views: extensions-page (/extensions)
- backend actions: listExtensions, createExtension, snapshotExtension, reloadExtension, smokeExtension, validateExtension, listInstallableExtensions, installCatalogExtension, installExtensionFromUrl, updateCatalogExtension, listHostViewComponents, readSearchPaths, updateSearchPaths, readExtensionSources, updateExtensionSources, reloadExtensions, manageExtension

### system-files — File Explorer

- settings: systemFiles.transcriptPathLinkTarget
- views: workspace-files, workspace-file-detail

### system-gateways — Telegram Gateway (bundled first-party extension)

- gatewayProviders: telegram
- nav: gateways-nav (/gateways)
- secrets: telegramBotToken
- views: page (/gateways), gateways-sidebar

### system-git-status — Git Status

- statusBarItems: composer-git-status

### system-image-probe — Image Probe

- settingsComponent: image-probe-settings (settings-image-probe)
- tools: probe-image/probe_image
- backend actions: probeImage

### system-local-dictation — Local Dictation

- composerControls: dictation
- keybindings: dictation.toggle [mod+shift+m]
- settingsComponent: dictation (settings-dictation)
- backend actions: readSettings, updateSettings, modelStatus, installModel, transcribeFile

### system-mcp — MCP

- settingsComponent: mcp-tools (settings-capabilities)
- tools: mcp/mcp
- backend actions: mcpTool, inspectSettings, saveExplicitConfig, testServer, authServer, logoutServer

### system-model-gateway — AI Gateway (default disabled)

- settingsComponent: model-gateway-settings (settings-model-gateway)
- backend actions: status, updateSettings, clearLogs

### system-model-picker — Model Picker

- composerControls: model-preferences

### system-neon-pilot-admin-cli — Neon Pilot CLI

- cliCommands: app-update, app-commands-list, app-commands-run, control-plane-doctor, heartbeats-start, heartbeats-list, heartbeats-stop, bootstrap-doctor, bootstrap-configure, bootstrap-defaults-set, bootstrap-provider-set-key, bootstrap-provider-save, bootstrap-provider-model
- settingsComponent: neon-pilot-cli (neon-pilot-cli)
- skills: neon-pilot-admin-cli
- tools: neon-pilot-admin/neon_pilot
- backend actions: neonPilotAdmin, manageAppCommands, controlPlaneDoctor, neonPilotTool, neonPilotAgent, readSettings, updateSettings

### system-onboarding — Onboarding

- topBarElements: onboarding-bootstrap
- backend actions: ensure

### system-prompt-assembly — Prompt Assembly

- backend actions: inspectAgentRuntime, inspectPromptAssembly, updatePromptAssemblySkillEnabled, updateRuntimeCapability

### system-reply-actions — Reply Actions

- settings: systemReplyActions.emojiPickerItems
- selectionActions: emoji-picker-item

### system-runs — Background Work

- cliCommands: background-commands-list, background-commands-get, background-commands-logs, background-commands-start, background-commands-rerun, background-commands-cancel
- composerShelves: activity-shelf
- skills: runs
- tools: bash-background/bash, background-bash/background_bash, subagent/subagent
- backend actions: bash, background_bash, subagent

### system-settings — Settings panels

- cliCommands: settings-list, settings-schema, settings-get, settings-set, settings-reset
- commands: open-settings
- nav: settings-nav (/settings)
- settings: secrets.provider, conversation.transcriptDisclosure, conversation.diffDisclosure, conversation.pinnedToolCalls
- views: settings (/settings), providers (/settings/providers), desktop (/settings/desktop), settings-sidebar
- backend actions: manageSettings, manageCli

### system-skills — Skills

- backend actions: listSkills, updateSkillEnabled

### system-telemetry — Telemetry

- nav: telemetry-nav (/telemetry)
- views: page (/telemetry)
- backend actions: getTelemetryData

### system-terminal — Terminal

- views: terminal-panel
- backend actions: terminalCreate, terminalWrite, terminalDrain, terminalResize, terminalClose

### system-todo — Todos

- composerShelves: todos
- conversationConnectionProviders: todos
- tools: todo/todo
- turnContextProviders: todos
- backend actions: getState, addItem, updateItem, deleteItem, clearItems, setPlan, todoTool, provideTurnContext, listTodoConnections

### system-web-tools — Web fetch

- tools: web-fetch/web_fetch
- backend actions: webFetch

### First-party optional catalog

Validate these by installing from the catalog or release artifact and reading the installed extension manifest:

- system-agent-browser — Agent Browser
- system-auto-router — Auto Router
- system-ds4 — DS4
- system-duckduckgo-search — DuckDuckGo Search
- system-dynamic-workflows — Dynamic Workflows
- system-exa-search — Exa Search
- system-knowledge — Knowledge
- system-suggested-context — Suggested Context
- system-video-probe — Video Probe
- system-writing-studio — Writing Studio
