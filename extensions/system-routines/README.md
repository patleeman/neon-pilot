# Routines

Routines are prompt-based workflow blocks that run before or after user-visible lifecycle events. Extensions and tools call the `runHook` backend action with a hook id and context; this extension loads enabled routines for that hook, runs their instructions, records run history, and returns whether the lifecycle event can continue.

## Surfaces

- Main page route: `/routines`
- Backend actions: `getState`, `saveRoutine`, `deleteRoutine`, `reorderRoutines`, `runHook`, `listSkills`
- Storage: extension-scoped routine configuration and recent run history

## Routine types

- **Instruction**: run a prompt and continue, warn, or block on failure.
- **Decision**: run a prompt constrained to enum outcomes; each outcome continues, warns, blocks, asks, or branches to another routine.
- **Stop**: block the lifecycle event with a message.

Skills are referenced directly in routine instructions with `/skill:<id>`. The editor provides skill search for that syntax and the backend extracts those references for run records.

## Validation

```bash
pnpm run extension:build -- extensions/system-routines
pnpm exec vitest run extensions/system-routines/src/backend.test.ts extensions/system-routines/src/frontend.test.tsx
pnpm run check:extensions:static
```
