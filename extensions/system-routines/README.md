# Routines

Routines are prompt-based workflow blocks that run before or after user-visible lifecycle events. Extensions and tools call the `runHook` backend action with a hook id and context; this extension loads enabled routines for that hook, runs their instructions, records run history, and returns whether the lifecycle event can continue.

## Product shape

Routines is a top-level workflow surface, modeled after the Automations page rather than a Settings panel.

- The **real app sidebar** lists only lifecycle events that currently have routines, with search/filter state through the `routines-sidebar` view.
- `Add routine ▾` includes a searchable event picker so the full hook catalog stays available without filling the sidebar.
- The main route shows a compact Automations-like header, a timeline split only into **Before** and **After**, and a right inspector.
- The inspector edits the selected routine. It should stay dense and IDE-like: no nested card stacks, no decorative chips, no detached settings-page treatment.
- `Add routine ▾` opens a compact menu for choosing an event plus **Instruction**, **Decision**, and **Stop**.
- Skills are referenced inline in the instruction with `/skill:<id>`; do not add a separate skill picker field or use `@` syntax.
- Decision outcomes are enum rows. Branch behavior belongs on outcomes, not in a separate action column.

Use Automations as the visual comparison point for shell spacing, top toolbar behavior, right-inspector density, empty state treatment, and sidebar integration.

## Surfaces

- Main page route: `/routines`
- Sidebar view: `routines-sidebar`
- Backend actions: `getState`, `saveRoutine`, `deleteRoutine`, `reorderRoutines`, `moveRoutine`, `runHook`, `registerHookPoint`, `listSkills`
- Storage: extension-scoped routine configuration and recent run history

## Routine types

- **Instruction**: run a prompt and continue, warn, or block on failure.
- **Decision**: run a prompt constrained to enum outcomes; each outcome continues, warns, blocks, asks, or branches to another routine.
- **Stop**: block the lifecycle event with a message.

Skills are referenced directly in routine instructions with `/skill:<id>`. The editor provides skill search for that syntax and the backend extracts those references for run records.

## Required QA checklist

Before reporting Routines UI work as done, open `/routines` in the desktop app and verify the full app frame plus every touched interaction:

- Routines nav opens and only lifecycle events with routines appear in the real sidebar.
- Sidebar search filters active routine events and selecting an event updates the timeline/inspector.
- Add routine can create a routine for an event that is not yet shown in the sidebar.
- Add Instruction, edit name/instruction/failure behavior, use `/skill:` autocomplete, save, refresh/reopen, then delete.
- Add Decision, add an outcome, edit the enum and target text, save, refresh/reopen, then delete.
- Add Stop, edit the stop message, save, then delete.
- Drag routines within the same lane and between Before/After; order and lane persist after refresh/reopen.
- Runs toggle shows a useful empty state and can return to Timeline.
- Menus/autocomplete do not stay stuck open, overlap unrelated content, or clip under the inspector footer.
- Empty event timelines show useful empty text.
- Full-frame screenshot visually matches Automations-level density and shell language.

## Validation

```bash
pnpm exec vitest run extensions/system-routines/src/backend.test.ts extensions/system-routines/src/frontend.test.tsx
pnpm run extension:build -- extensions/system-routines
pnpm --dir packages/desktop run build:ui
pnpm run check:extensions:static
pnpm run smoke:routines-ui
```
