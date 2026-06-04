# Knowledge Extension

This extension owns the Knowledge workbench surfaces and knowledge-file mention provider.

## What it contributes

- A left-nav **Knowledge** destination backed by the native `knowledge-page` extension view.
- A Knowledge left-sidebar browser while the Knowledge destination is active.
- A tab-local **Knowledge** tree for browsing local knowledge directories in the workbench.
- A paired workbench detail view for opening and editing knowledge files beside a conversation.
- A `knowledge-files` mention provider that adds knowledge folders and files to the conversation `@` menu.
- A quick-open provider for command-palette file open/search.
- A prompt-reference resolver that turns `@knowledge-file.md` mentions into hidden prompt context.
- A prompt assembly instruction provider that injects the active knowledge paths into the agent runtime context.
- A Settings page component for connecting a git-backed knowledge mirror and adding local knowledge directories.

## Runtime behavior

The extension renders native React surfaces declared in `extension.json`:

- `knowledge-page` renders the main `/knowledge` page and editor.
- `knowledge-sidebar` renders the left-sidebar file browser while `/knowledge` is active.
- `knowledge-tree` renders the tab-local rail browser.
- `knowledge-file` renders the workbench detail panel for the selected file.

The extension owns backend actions for knowledge state, managed sync, knowledge file operations, and prompt-reference resolution. It uses the generic extension backend context (`ctx.storage`, `ctx.shell`, UI invalidation, and local file APIs) instead of a Knowledge-specific core service:

- `readState` reads configured repository/sync status.
- `updateState` updates the managed knowledge repository configuration.
- `sync` runs a git-backed knowledge-base sync and invalidates knowledge UI state.
- `knowledge*` actions provide listing, reading, writing, searching, moving, renaming, deleting, importing, and uploading knowledge files.
- `resolvePromptReferences` resolves knowledge file mentions during prompt submission.
- `provideKnowledgeInstructions` contributes a small runtime instruction layer listing agent-visible knowledge paths.

The same repository controls are available from **Settings → Capabilities → Knowledge Base** for users who want to edit sync configuration after onboarding.

Knowledge UI should stay in this extension. Host code may render contributed surfaces, but it should not add shell-specific Knowledge pages or file-search paths.

## Knowledge directories

The knowledge base is a set of source-material directories. It resolves in this order:

1. `NEON_PILOT_KNOWLEDGE_ROOT` environment variable
2. Managed knowledge-base mirror at `<state-root>/knowledge-base/repo` when this extension has a repository URL saved in extension storage
3. User-selected local directories saved in extension storage
4. Legacy `knowledgeRoot` config value in the runtime settings or machine config file
5. `~/Documents/neon-pilot`

When more than one directory is active, file ids from secondary roots are qualified with a stable root id such as `knowledge-2:path/to/file.md`. The `@` mention provider and prompt-reference resolver use those ids so the agent can receive the correct source files.

## Knowledge contents

Docs are reusable reference material stored as files under any configured knowledge directory. They are pulled into a turn through explicit context such as `@` file/folder mentions or search-backed UI flows.

Instruction files define standing behavior and policy for the agent. They are selected in Settings, listed in config, and auto-discovered from the active project by walking from the repository root to the working directory. Project discovery recognizes `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, and root `.github/copilot-instructions.md`.

They can also be selected explicitly:

```json
{
  "instructionFiles": ["instructions/base.md", "instructions/code-style.md"]
}
```

Skills are reusable workflows, not knowledge-base content. Skills belong to prompt assembly and marketplace/skill installation flows even when their files happen to live near a knowledge directory for migration compatibility.

Projects are structured work packages with milestones, tasks, and durable status. See [Projects](../../docs/projects.md).

## Managed sync

Knowledge Base Sync uses git to synchronize a managed knowledge mirror across machines. When configured, the runtime maintains a managed clone and includes it in the effective knowledge directories.

```text
Machine A ──► Git remote ◄── Machine B
                 │
          Managed clone
          <state-root>/knowledge-base/repo
                 │
        Knowledge directory
```

Sync tracks local file snapshots, pulls remote changes, pushes local changes, and preserves recovery data when conflicts or errors occur. Sync state includes the configured repo URL, branch, configured local directories, effective knowledge paths, last sync timestamp, last synced head, and file snapshot.

Sync status values:

| Status     | Meaning                      |
| ---------- | ---------------------------- |
| `disabled` | No repo URL configured       |
| `idle`     | Synced, waiting for changes  |
| `syncing`  | Currently pulling or pushing |
| `error`    | Last sync failed             |

When idle, status can also include local change count plus ahead/behind counts.

## System prompt and AGENTS.md

Knowledge affects agent behavior through file-based layers, not runtime prompt mutation. Pi assembles the final prompt from:

1. `SYSTEM.md` in the agent dir
2. `APPEND_SYSTEM.md` in the agent dir, including concise runtime paths and knowledge guidance
3. discovered `AGENTS.md` / `CLAUDE.md` files from the CWD walk
4. available skills from the runtime skill loader
5. current date and working directory

`APPEND_SYSTEM.md` intentionally points at the primary knowledge path and skills directory instead of enumerating every skill; the skill loader owns the detailed skill list. Extensions cannot modify the system prompt at runtime. To influence behavior, install or edit behavior assets through Extensions, or add reference material to a knowledge directory.

## Permissions

The extension declares `knowledge:read` and `knowledge:write` because it browses, edits, configures, and syncs local knowledge-base files.
