# neon-pilot repo instructions

neon-pilot is Patrick's personal AI agent runtime. Keep core small and build user-facing features as extensions by default.

## Always-on rules

- Prefer correct, complete implementations over compatibility shims or narrow safe cuts.
- If a feature needs a shared boundary — process execution, security policy, persistence, routing, extension APIs — implement the boundary and wire first-class call sites through it.
- Build product/workflow UX in extensions unless the work is core runtime, security, persistence, extension-host infrastructure, app-shell plumbing, routing, install/update plumbing, or shared UI primitives.
- If the extension API is missing a capability, add the smallest general-purpose API surface to core instead of hardcoding a one-off feature.
- Extension runtime code must not import `@neon-pilot/core`, `@neon-pilot/desktop`, `packages/desktop/*`, or `packages/core/*` directly. Route host access through `@neon-pilot/extensions` and narrow `@neon-pilot/extensions/backend/*` subpaths.
- Host backend API modules in `packages/desktop/server/extensions/backendApi/*` are boundary shims. Keep them small, typed from public extension contracts, and lazy-load host/core implementation through `serverModuleResolver`; do not statically re-export core or desktop internals.
- Do not introduce environment variables for app/runtime configuration. Pass state explicitly through typed config/context APIs; keep env reads only for unavoidable external-process compatibility with existing legacy variables.
- For web UI, prefer server-pushed updates over polling when the backend can publish events.
- Multiple agents may be working here. Do targeted changes and targeted checkpoints; stop if unrelated edits conflict with your work.

## Prompt and knowledge rules

- Use `CONTEXT.md` as the canonical glossary for product/domain vocabulary. Prefer its terms in code, docs, UI copy, and agent-facing instructions; update it immediately when a term is clarified. Keep it glossary-only: no implementation details, specs, scratch notes, or architecture decisions.
- Never modify the system prompt from extension `before_agent_start` handlers. Use file-based instruction layers instead: repo defaults, vault root `AGENTS.md`, or cwd `AGENTS.md`.
- Docs are for agents. Update docs whenever behavior or workflow changes.
- Before changing feature behavior, read the owning extension README plus relevant docs from `docs/README.md`.

## Validation and checkpoints

- Validate the actual work before calling it done. Use the narrowest meaningful check first, then broader checks when risk warrants it.
- For extension/core boundary work, run `pnpm run check:extensions:static` or at least `node scripts/check-core-extension-boundary.mjs && node scripts/check-extension-backend-api.mjs`.
- If you modify web UI, perform a visual check. Use the repo wrapper for agent-browser sessions and clean up only processes you started.
- Before final summary, use the `checkpoint` skill/tool for a targeted commit. Do not stage unrelated files.

## UI design bans

- Avoid nested bordered containers/cards unless truly unavoidable.
- Avoid decorative pills/chips as a default treatment; use spacing, typography, and alignment for hierarchy.
- Keep pages visually consistent; do not design in isolation.

## Workflow references

- Development, validation, UI QA, gitleaks, and checkpoint details: `docs/development.md`.
- Release process, current version, signed build flow, and release gotchas: `docs/release-cycle.md`.
- Extension authoring/API rules: `docs/extensions.md` and `packages/extensions/README.md`.
- Browser feature docs: `installable-extensions/system-browser/README.md`; Workbench Browser skill handles built-in browser context.
