# Skills Extension

System extension that owns the `/skills` page and backend actions for listing and enabling/disabling agent skills.

It aggregates skills from:

- extension manifests
- configured runtime skill directories
- the durable knowledge-base `skills/` folder

Disabled skill IDs are stored in `<state-root>/skills-registry.json`; the runtime skill filter reads the same registry before injecting `<available_skills>` into agent context.
