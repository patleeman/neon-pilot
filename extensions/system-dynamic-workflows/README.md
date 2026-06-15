# Dynamic Workflows

Dynamic Workflows lets a user run model-authored JavaScript coordinators that fan out daemon-backed subagents, track workflow phases, and persist run results.

## Ownership

This bundled extension owns the Workflows page, the `dynamic_workflow` transcript block renderer, saved workflow storage, and backend actions for starting, listing, inspecting, cancelling, saving, deleting, and running workflows.

Keep workflow orchestration in this extension. If a change needs a new host capability for runs, storage, conversations, or settings, add the smallest public extension/backend API seam instead of importing core or desktop internals.

## Surfaces

- Main page route: `/workflows`
- Transcript block type: `dynamic_workflow`
- Backend actions: `workflow`, `listWorkflows`, `getWorkflow`, `cancelWorkflow`, `listWorkflowTemplates`, `saveWorkflow`, `listSavedWorkflows`, `deleteSavedWorkflow`, `runSavedWorkflow`
- Storage: extension SQLite database plus extension settings

## Validation

```bash
pnpm run extension:build -- extensions/system-dynamic-workflows
pnpm exec vitest run extensions/system-dynamic-workflows/src/backend.test.ts
pnpm run check:extensions:static
```

For user-visible changes, open `/workflows` through the desktop app or extension host route, run a small workflow, and confirm the page, backend actions, and transcript block update through the real extension context.
