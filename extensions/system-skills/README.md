# Skills Extension

Compatibility backend for listing and enabling/disabling agent skills.

The user-facing management surface is `system-prompt-assembly` at `/prompt-assembly`, which shows skills alongside tools, prompt templates, context, and diagnostics.

Disabled skill IDs are stored in `<state-root>/skills-registry.json`; prompt assembly reads the same registry before injecting skills into agent context.
