# Configuration and Settings

Neon Pilot has several configuration stores. Do not treat `config.json` as the whole settings system: machine config, runtime agent settings, extension settings, provider definitions, credentials, desktop preferences, and browser-local UI state each have different owners.

Neon Pilot no longer has user-selectable profiles. Some storage paths and compatibility APIs still use the legacy word `profile`; treat those as the single shared runtime scope, not a product concept.

## Path roots

| Root                | Default                                                     | Override                       | Purpose                                                                         |
| ------------------- | ----------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `<state-root>`      | `~/.local/state/neon-pilot` or `$XDG_STATE_HOME/neon-pilot` | `NEON_PILOT_STATE_ROOT`        | Runtime state, daemon DBs, extension installs, active agent files               |
| `<config-root>`     | `<state-root>/config`                                       | `NEON_PILOT_CONFIG_ROOT`       | Machine-local durable config                                                    |
| Machine config file | `<config-root>/config.json`                                 | `NEON_PILOT_CONFIG_FILE`       | Knowledge root/sync, extra instruction files, skill folders, daemon/ui sections |
| Local config dir    | `<config-root>/local`                                       | `NEON_PILOT_LOCAL_PROFILE_DIR` | Local settings mirror for active runtime settings                               |

## Machine config

`<config-root>/config.json` is machine-local configuration. It is not a layered settings file and there is no active `<config-root>/local/config.json` overlay.

Current machine config keys:

| Key                    | Type     | Used for                                                            |
| ---------------------- | -------- | ------------------------------------------------------------------- |
| `vaultRoot`            | string   | Legacy explicit knowledge vault root                                |
| `knowledgeBaseRepoUrl` | string   | Managed git-backed knowledge base repo                              |
| `knowledgeBaseBranch`  | string   | Managed knowledge base branch, default `main`                       |
| `instructionFiles`     | string[] | Extra AGENTS.md-style files appended to runtime instructions        |
| `skillDirs`            | string[] | Extra skill directories loaded alongside the vault skills directory |
| `daemon`               | object   | Daemon machine config section                                       |
| `ui`                   | object   | UI machine config section, including fallback resume prompt         |

Example:

```json
{
  "knowledgeBaseRepoUrl": "git@github.com:user/neon-pilot-kb.git",
  "knowledgeBaseBranch": "main",
  "instructionFiles": ["/Users/me/agent/extra-AGENTS.md"],
  "skillDirs": ["/Users/me/agent/skills"]
}
```

## Runtime agent settings

The active agent/runtime settings file is:

```text
<state-root>/neon-pilot-runtime/settings.json
```

This file is materialized from resolved runtime resources and is also where app-level runtime preferences are written. The desktop Settings page writes through APIs that preserve existing settings and mirror writes to the legacy local settings path where needed.

Common runtime settings include:

| Key                                           | Purpose                                                            |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `defaultProvider`, `defaultModel`             | Default model for new conversations and runs                       |
| `defaultVisionProvider`, `defaultVisionModel` | Vision model used by `probe_image` for text-only models            |
| `defaultThinkingLevel`                        | Default reasoning level                                            |
| `defaultServiceTier`                          | Optional model service tier, e.g. fast/priority mode               |
| `defaultCwd`                                  | Default working directory for new chats and web actions            |
| `ui.*`                                        | Conversation list/layout preferences and conversation plan presets |
| `lastChangelogVersion`                        | Runtime UI bookkeeping                                             |

Do not put arbitrary product feature state here. Product features should own state through their extension storage, daemon/runtime DB tables, or a deliberate extension API.

## Extension settings

Extensions have two settings mechanisms:

1. **Scalar settings** declared in `extension.json` under `contributes.settings`. These are exposed through `/api/settings`, merged with manifest defaults, and persisted as overrides in:

   ```text
   <state-root>/settings.json
   ```

2. **Component-backed settings UI** declared by an extension as `contributes.settingsComponent`. The component renders inside the Settings page and should read/write through extension backend actions or stable SDK APIs.

The Settings page has an **Extension Settings** section for scalar manifest settings. Rich first-party panels, such as Dictation or Knowledge, should live in their owning system extension and use stable extension APIs rather than app-shell special cases.

## Models, providers, and credentials

Model/provider configuration is split on purpose:

| Store                         | Default path                                                  | Purpose                                                                        |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Provider/model definitions    | `<config-root>/runtime/shared/models.json`                    | Custom providers, model overrides, context windows, costs, compatibility flags |
| Active runtime model registry | `<state-root>/neon-pilot-runtime/models.json`                 | Materialized model definitions read by the runtime                             |
| Legacy provider credentials   | `<state-root>/neon-pilot-runtime/auth.json`                   | Existing API keys and OAuth tokens managed through Settings                    |
| Extension secrets             | macOS Keychain, `<state-root>/secrets.json`, or env-only      | Extension-declared secrets such as integration API keys                        |
| Environment credentials       | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc. | Runtime-only credential source; not persisted                                  |

Provider credentials should be managed through Settings. Manual edits to `auth.json` are possible but discouraged. New extension secrets should use `contributes.secrets`; the active backend is configured by `secrets.provider` (`keychain`, `file`, or `env-only`). Environment variables declared by the extension take precedence over stored values.

Enabled extensions may contribute `modelProfiles` that match provider/model refs with simple globs over `<provider>/<model>`, for example `openai-codex/*` or `*/gpt-5.5`. These are model compatibility profiles, not user-selectable app profiles. The owning extension implements runtime behavior through normal extension hooks and tools; disabled extensions do not participate, and models do not declare profiles.

If no enabled profile extension matches, Neon Pilot uses the normal default runtime behavior. Explicit per-run allowed tool lists still take precedence.

## Knowledge vault resolution

The effective knowledge vault root resolves in this order:

1. `NEON_PILOT_VAULT_ROOT`
2. Managed knowledge-base mirror at `<state-root>/knowledge-base/repo` when `knowledgeBaseRepoUrl` is configured
3. Legacy `vaultRoot` from machine config
4. `~/Documents/neon-pilot`

Knowledge UI and sync behavior live in the Knowledge system extension. Machine config only stores the machine-level root/sync inputs.

## Desktop, daemon, and local UI state

Not every Settings-page control writes to the same JSON file:

| Area                                                    | Source of truth                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| Appearance theme picker                                 | Browser/Electron `localStorage` plus contributed extension themes     |
| Conversation defaults                                   | `<state-root>/neon-pilot-runtime/settings.json`                       |
| Workspace default cwd                                   | `<state-root>/neon-pilot-runtime/settings.json`                       |
| Skills and extra instruction files                      | `<config-root>/config.json`                                           |
| Provider/model definitions                              | `<config-root>/runtime/shared/models.json`                            |
| Provider credentials                                    | `<state-root>/neon-pilot-runtime/auth.json` and environment variables |
| Extension secrets                                       | macOS Keychain, `<state-root>/secrets.json`, or environment only      |
| Desktop update/startup/keyboard preferences             | `<state-root>/desktop/config.json`                                    |
| Extension enablement and extension keybinding overrides | `<state-root>/extensions/registry.json`                               |
| Extension scalar settings                               | `<state-root>/settings.json`                                          |
| Automations, reminders, durable executions              | Daemon runtime database                                               |

## Rule of thumb

Use machine config for machine-wide roots and discovery inputs. Use runtime settings for active agent defaults. Use extension settings/storage for product features. If an extension needs a new kind of configuration, add a reusable extension API instead of hiding feature-specific config in core.
