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
- Right rail/workbench tool slots: open, close, switch tabs, detail panes, preserved sizing.
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
- Settings keys: `secrets.provider` (`keychain`, `file`, `env-only`) and `conversation.transcriptDisclosure` (`auto`, `expanded`).
- Test provider add/edit/remove, model/provider validation, secrets redaction, desktop preferences, keyboard shortcut preferences, persistence after restart.
- Extension settings components hosted here: Knowledge Base, Dictation, MCP tools, Extension search paths, Alleycat host when enabled.

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

### `/knowledge` and knowledge rail/detail (`system-knowledge`)

- Nav item: Knowledge.
- Views: Knowledge page, Knowledge tree right rail, Knowledge file workbench detail.
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

### `/prompt-assembly` — Prompt Assembly (`system-prompt-assembly`)

- Nav item: Prompt Assembly.
- Actions: `inspectPromptAssembly`, `updatePromptAssemblySkillEnabled`.
- Test assembled prompt inspection, instruction layers, skill enable/disable, diagnostics display, reload persistence.

### `/ext/system-local-models` — Local Models (`system-local-models`, default disabled)

- Nav item/page: Local Models.
- Actions: `localModelsStatus`, `localModelsMlxSetModel`, `localModelsMlxSetup`, `localModelsMlxUpdateRuntime`, `localModelsMlxStart`, `localModelsMlxStop`, `localModelsMlxSearch`, `localModelsSearch`, `localModelsModelDetails`, `localModelsGgufDownload`, `localModelsGgufCancelDownload`, `localModelsGgufSaveSettings`, `localModelsGgufSetModel`, `localModelsGgufReveal`, `localModelsMlxDelete`, `localModelsGgufDelete`, `localModelsGgufInstallRuntime`, `localModelsGgufStart`, `localModelsGgufStop`, `localModelsGgufRunPrompt`, `localModelsDiscover`.
- Test MLX setup/start/stop/update/delete, GGUF download/cancel/settings/reveal/delete/runtime install/start/stop/run prompt, Hugging Face search/details, model selection propagation.

## Conversation right rails, workbench details, and transcript renderers

### Artifacts (`system-artifacts`)

- Views: Artifacts right rail, Artifact workbench detail.
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

- Views: Workspace files right rail, workspace file detail.
- Test tree load, cwd switching, file open, large file, binary/image file, diff view, readonly mode, missing file, permission errors.

### Browser (`system-browser`, default disabled)

- Views: Browser tabs right rail, Browser workbench.
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

### Suggested Context (`system-suggested-context`)

- Composer suggested context UI and prompt context provider.
- Action: `warmPointers`.
- Test pointer warming, suggestions list, accept/remove suggestion, stale/missing files, prompt injection.

### Reply Actions (`system-reply-actions`)

- Reply buttons/actions: agree, disagree, question, think harder, try again, do it.
- Test each action generates the expected follow-up prompt, disabled/running states, transcript placement.

### Goal Mode (`system-auto-mode`)

- Agent tool: `goal` with `objective`, `status`.
- UI: goal-mode indicator/control where present.
- Test start/replace goal, complete goal, invalid premature complete, conversation persistence, auto-mode behavior.
- Skill: `goal-mode`.

### Context Hardening (`system-context-hardening`)

- Extension ID: `system-context-hardening`.
- Test compact/context-hardening behavior from the conversation flow, context summaries, and failure/retry states.

### Excalidraw input (`system-excalidraw-input`)

- Composer action: Excalidraw.
- Test open editor modal, draw/save/cancel, insert into composer, image/reference handling, reload after draft if supported.

### Local Dictation (`system-local-dictation`)

- Dictation composer/control surface.
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

- Agent tool: `conversation`.
- Actions: ask user question, duplicate conversation, copy working directory, copy conversation ID, copy deeplink.
- Command/keybinding: `open-thread-palette` / Open conversation palette (`mod+k`).
- Conversation list context menu IDs: `duplicate-conversation`, `copy-working-directory`, `copy-conversation-id`, `copy-deeplink`.
- Transcript renderers: ask-user-question tool block, terminal bash tool block.
- Tool operations to test:
  - Ask: `question`, `details`, quick `options`, structured `questions` with radio/check styles.
  - Inspect: `list`, `search`, `query`, `diff`, `outline`, `read_window`; filters by ids, roles, types, tools, text, order, windows, limits.
  - Conversation mutation: set title, change cwd with optional continue prompt.
  - Deferred resume: delay/at, trigger, deliver as steer/follow-up, reason requirement.

### Web/search/image tools

- `web_fetch` (`system-web-tools`): URL fetch, raw HTML option, invalid URL, network failure, large page.
- `web_search` (`system-duckduckgo-search`): query, count, page, empty/no-result, network failure.
- `web_search` (`system-exa-search`): query, count, page, API/config failure.
- `probe_image` (`system-image-probe`): image IDs, question, missing image, multiple images.
- `image` (`system-images`, default disabled): generate/edit, size, quality, background, source selection/count, transparent/opaque, failures.

### MCP (`system-mcp`)

- Agent tool: `mcp` actions `list`, `get/info`, `grep`, `call`, `auth`, `logout`.
- Actions: `mcpTool`, `inspectSettings`, `saveExplicitConfig`, `testServer`, `authServer`, `logoutServer`.
- Settings component/section: MCP tools.
- Test server list with/without probe, tool info, glob search, tool call arguments JSON, OAuth auth/logout, failing server, config save, test server.

### Codex Compatibility (`system-codex-profile`)

- Agent tools/actions: `apply_patch`, `write-file`, `apply-patch-edit`.
- Test patch success, patch failure, write new file, overwrite file, invalid path, permissions, transcript output.

### Skills (`system-skills`)

- Actions: `listSkills`, `updateSkillEnabled`.
- Skills page/surface: list skills, enable/disable, search/filter if present, persistence, prompt assembly integration.

### Session Exchange (`system-session-exchange`, default disabled)

- Actions: `exportSession`, `importSession`.
- Conversation list context menu: `export-session` / Export Session.
- Conversation header action: `import-session` / Import Session.
- Test export current conversation, import valid conversation, malformed import, conflicts/duplicates, transcript/tool preservation.

### Alleycat mobile pairing (`system-alleycat`, default disabled)

- Actions: `alleycatStart`, `alleycatStop`, `alleycatStatus`, `rotateToken`.
- Host/settings surface.
- Test host start/stop/status, pairing token rotation, mobile connect/disconnect, invalid token, port conflict.

## External gateway commands

### Telegram

- `/start`, `/help`, `/stop`, `/pause`, `/new`, `/model <model>`, `/rename <title>`.
- Bot mention variants, unknown command rejection, incomplete command rejection.
- Conversation attachment and force-new behavior.

### Slack MCP gateway

- `!agent`, `!agent help`, `!agent stop`, `!agent model <model>`, `!agent compact`, `!agent detach`.
- Unknown command rejection, normal message passthrough, outbound system messages.

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

### system-alleycat — Kitty Litter Mobile Pairing (Alleycat) (default disabled)

- settingsComponent: alleycat
- backend actions: alleycatStart, alleycatStop, alleycatStatus, rotateToken

### system-artifacts — Artifacts

- tools: artifact
- views: conversation-artifacts, artifact-detail
- transcriptRenderers: artifact-tool-block for artifact
- skills: artifacts
- backend actions: artifact

### system-auto-mode — Goal Mode

- tools: goal
- composerControls: goal-mode
- skills: goal-mode

### system-automations — Automations

- tools: scheduled-task/scheduled_task
- views: page (/automations)
- nav: nav (/automations)
- skills: async-attention, scheduled-tasks
- backend actions: scheduledTask, deferredResume

### system-caffeinate — Caffeinate

- topBarElements: caffeinate-toggle
- backend actions: caffeinateStatus, caffeinateStart, caffeinateStop, caffeinateToggle

### system-codex-profile — Codex Compatibility

- tools: apply-patch/apply_patch, write-file, apply-patch-edit
- modelProfiles: 0
- backend actions: applyPatch, applyPatchEdit, writeFile

### system-composer-attachments — Composer Attachments

- composerControls: attach-files

### system-context-usage — Context Usage

- statusBarItems: composer-context-usage

### system-conversation-tools — Conversation Tools

- tools: conversation
- commands: open-thread-palette
- keybindings: open-thread-palette [mod+k]
- transcriptRenderers: ask-user-question-tool-block for ask_user_question, terminal-bash-tool-block for bash
- contextMenus: duplicate-conversation on conversationList, copy-working-directory on conversationList, copy-conversation-id on conversationList, copy-deeplink on conversationList
- backend actions: conversationTool, duplicateConversation, copyWorkingDirectory, copyConversationId, copyDeeplink

### system-diffs — Checkpoints

- tools: checkpoint
- transcriptRenderers: checkpoint-tool-block for checkpoint
- backend actions: checkpoint

### system-duckduckgo-search — DuckDuckGo Search

- tools: duckduckgo-search/web_search
- backend actions: duckDuckGoSearch

### system-exa-search — Exa Search

- tools: exa-search/web_search
- secrets: exaApiKey
- backend actions: exaSearch

### system-excalidraw-input — Excalidraw input

- composerInputTools: excalidraw

### system-extension-manager — Extension Manager

- views: page (/extensions)
- nav: extensions-nav (/extensions)
- skills: skills-and-capabilities, local-extension-development
- settingsComponent: extension-search-paths
- backend actions: listExtensions, createExtension, snapshotExtension, reloadExtension, validateExtension, listHostViewComponents, readSearchPaths, updateSearchPaths, manageExtension

### system-files — File Explorer

- views: workspace-files, workspace-file-detail

### system-git-status — Git Status

- statusBarItems: composer-git-status

### system-image-probe — Image Probe

- tools: probe-image/probe_image
- backend actions: probeImage

### system-knowledge — Knowledge

- views: knowledge-page (/knowledge), knowledge-tree, knowledge-file
- nav: knowledge (/knowledge)
- promptReferences: knowledge-files
- quickOpen: knowledge-files
- mentions: knowledge-files
- settingsComponent: knowledge-base
- backend actions: readState, updateState, sync, knowledgeListFiles, knowledgeTree, knowledgeReadFile, knowledgeWriteFile, knowledgeCreateFolder, knowledgeDeleteFile, knowledgeRename, knowledgeMove, knowledgeBacklinks, knowledgeSearch, knowledgeUploadImage, knowledgeImportUrl, resolvePromptReferences

### system-local-dictation — Local Dictation

- composerButtons: dictation
- settingsComponent: dictation
- backend actions: readSettings, updateSettings, modelStatus, installModel, transcribeFile

### system-mcp — MCP

- tools: mcp
- settingsComponent: mcp-tools
- backend actions: mcpTool, inspectSettings, saveExplicitConfig, testServer, authServer, logoutServer

### system-model-picker — Model Picker

- composerControls: model-preferences

### system-onboarding — Onboarding

- topBarElements: onboarding-bootstrap
- backend actions: ensure

### system-prompt-assembly — Prompt Assembly

- views: prompt-assembly-page (/prompt-assembly)
- nav: prompt-assembly-nav (/prompt-assembly)
- backend actions: inspectPromptAssembly, updatePromptAssemblySkillEnabled

### system-reply-actions — Reply Actions

- selectionActions: reply-agree, reply-disagree, reply-question, reply-think-harder, reply-try-again, reply-do-it

### system-runs — Background Work

- tools: bash-background/bash, background-bash/background_bash, subagent
- composerShelves: activity-shelf
- skills: runs
- backend actions: bash, background_bash, subagent

### system-settings — Settings panels

- views: settings (/settings), providers (/settings/providers), desktop (/settings/desktop)
- nav: settings-nav (/settings)
- commands: open-settings
- settings: secrets.provider, conversation.transcriptDisclosure

### system-skills — Skills

- backend actions: listSkills, updateSkillEnabled

### system-suggested-context — Suggested Context

- newConversationPanels: suggested-context
- promptContextProviders: provide-prompt-context
- backend actions: warmPointers

### system-telemetry — Telemetry

- views: page (/telemetry)
- nav: telemetry-nav (/telemetry)

### system-todo — Todos (default disabled)

- tools: todo
- composerShelves: todos
- turnContextProviders: todos
- backend actions: getState, addItem, updateItem, deleteItem, clearItems, todoTool, provideTurnContext

### system-web-tools — Web fetch

- tools: web-fetch/web_fetch
- backend actions: webFetch

### system-browser — Browser (default disabled)

- tools: browser_snapshot, browser_cdp, browser_screenshot
- views: browser-tabs, browser-workbench
- commands: open-browser
- keybindings: open-browser [mod+shift+b], new-browser-tab [mod+t], reopen-browser-tab [mod+shift+t], close-browser-tab [mod+w], focus-browser-location [mod+l]
- transcriptRenderers: browser-snapshot-tool-block for browser_snapshot, browser-cdp-tool-block for browser_cdp, browser-screenshot-tool-block for browser_screenshot
- skills: browser
- backend actions: browserSnapshot, browserCdp, browserScreenshot

### system-images — Images (default disabled)

- tools: image
- backend actions: image

### system-local-models — Local Models (default disabled)

- views: main (/ext/system-local-models)
- nav: system-local-models (/ext/system-local-models)
- modelDiscovery: {"action":"localModelsDiscover"}
- backend actions: localModelsStatus, localModelsMlxSetModel, localModelsMlxSetup, localModelsMlxUpdateRuntime, localModelsMlxStart, localModelsMlxStop, localModelsMlxSearch, localModelsSearch, localModelsModelDetails, localModelsGgufDownload, localModelsGgufCancelDownload, localModelsGgufSaveSettings, localModelsGgufSetModel, localModelsGgufReveal, localModelsMlxDelete, localModelsGgufDelete, localModelsGgufInstallRuntime, localModelsGgufStart, localModelsGgufStop, localModelsGgufRunPrompt, localModelsDiscover

### system-session-exchange — Session Exchange (default disabled)

- contextMenus: export-session on conversationList
- threadHeaderActions: import-session
- backend actions: exportSession, importSession
