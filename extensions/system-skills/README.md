# Skills Extension

User-facing Skills marketplace and installed-skill manager.

The main route is `/skills`. It lets users browse upstream skill sources, install vetted skills through `system-skill-search`, and manage the skills available to agents.

The default marketplace view is source-first:

- OpenAI, Anthropic, Hugging Face, and NVIDIA are trusted upstream sources.
- Hermes is a community source and keeps the host-owned approval gate before install.
- Skills install through the existing preview, vetting, and persistence path owned by `system-skill-search`.

The Manage view lists all skills available to Prompt Assembly and lets users enable or disable them. Disabled skill IDs are stored in `<state-root>/skills-registry.json`; Prompt Assembly reads the same registry before injecting skills into agent context.
