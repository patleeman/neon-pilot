# neon-pilot repo instructions

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
- For desktop app UI, use shared primitives from `@neon-pilot/ui`/`@neon-pilot/ui/shared` instead of hand-rolled Tailwind component chrome. For first-party extension UI and settings surfaces, use `@neon-pilot/extensions/ui` and `@neon-pilot/extensions/settings`. If a raw HTML/Tailwind pattern is genuinely needed, keep the exception narrow and update the UI-pattern guardrail or docs so future agents do not silently bypass the design system.

## Prompt and knowledge rules

- Use `CONTEXT.md` as the canonical glossary for product/domain vocabulary. Prefer its terms in code, docs, UI copy, and agent-facing instructions; update it immediately when a term is clarified. Keep it glossary-only: no implementation details, specs, scratch notes, or architecture decisions.
- Never modify the system prompt from extension `before_agent_start` handlers. Use file-based instruction layers instead: repo defaults, vault root `AGENTS.md`, machine-local `~/.config/agents/AGENTS.md`, or cwd `AGENTS.md`.
- Docs are for agents. Update docs whenever behavior or workflow changes.
- Before changing feature behavior, read the owning extension README plus relevant docs from `docs/README.md`.
- For `system-skill-search`, preserve the product contract in `extensions/system-skill-search/README.md`: agents call `skill_search`, choose the best candidate themselves, then call `skill_install`; trusted sources install directly after vetting, while community sources use the host-owned timed approval shelf. Do not route approval through chat flags, ask the user to choose from raw candidates, or bypass vetting.

## Validation and checkpoints

- Validate the actual work before calling it done. Use the narrowest meaningful check first, then broader checks when risk warrants it.
- When auditing `docs/feature-inventory.md` rows, keep the audit tied to the named user-visible slice. Prefer concrete risks with source proof, repro or app-path validation ideas, smallest fix direction, and focused regression coverage. Reject broad refactors, style nits, and speculative issues without a visible failure mode; if the prompt says read-only, report findings only and do not edit.
- Run the relevant build before saying a task is complete. For desktop/app or shared package changes, include the affected package build or `node packages/desktop/scripts/build-main.mjs`/`pnpm --dir packages/desktop run build:ui` as appropriate; for extension changes, build the affected extension and reinstall it when validating through the app.
- Do not leave the app in a state where Patrick cannot start it locally. After TypeScript, desktop/app, extension host, build script, or shared package changes, run the startup path or its full blocking build equivalent before handing off: prefer `pnpm run desktop:dev -- --no-quit-confirmation` when app launch behavior could be affected, and at minimum run the package build that performs `tsc --noUnusedLocals`/production type checks. Treat unused symbols, stale generated code, or other build-only failures as blockers, even when focused tests pass.
- When changing behavior a user reaches through the desktop app, an extension page, a sidebar route, settings, transcript rendering, or a tool, validate the same path the user will use. Open the route/page/control or invoke the tool through the app/extension host, verify the rendered UI or visible output, and cover empty/error/loading states when relevant.
- Do not treat backend/unit tests, manifest checks, or worker smokes as substitutes for user-visible validation. They are necessary support checks, not proof that the user-facing path works.
- If full user-visible validation is impossible, say exactly what was not validated and why. Do not imply manual or app-path validation happened when only lower-level checks ran.
- For chat transcript, send/resume, realtime streaming, running-state, scroll, or sidebar conversation-state changes, prove the full visible conversation loop: the user's submitted message appears immediately, assistant/tool updates stream or visibly progress without a stuck blank/`Resuming...` state, Stop/working indicators match the run state, transcript scroll behavior does not fight reading, and reloading or reopening the conversation renders the persisted result. Use a real provider path, local mock provider, or deterministic live-session harness that exercises the same UI update path; stored-session reload alone is not enough.
- For extension pages, confirm the nav route opens, the frontend invokes its backend actions, and those actions work with the real action context shape, not only test-only context stubs.
- For workflow/tool features, run at least one representative invocation and confirm the transcript/page/status result the user would inspect.
- For extension/core boundary work, run `pnpm run check:extensions:static` or at least `node scripts/check-core-extension-boundary.mjs && node scripts/check-extension-backend-api.mjs`.
- If you modify web UI, perform a visual check. Use the repo wrapper for agent-browser sessions and clean up only processes you started.
- Before final summary, use the `checkpoint` skill/tool for a targeted commit when available; otherwise use git directly. Do not stage unrelated files.
- Before cutting a Neon Pilot release, run the release reliability gate and hands-on QA process in `docs/release-qa.md`. At minimum run `pnpm run check:release:doctor`, `pnpm run test:release-hardening`, and `pnpm run qa:release`, then record the app build, commit SHA, and pass/fail notes for the hands-on smoke checklist.

## UI copy rules

- Treat copywriting as product behavior, not decoration. User-visible labels, descriptions, empty states, errors, status text, settings, command titles, and tooltips must be understandable to someone who does not know Neon Pilot internals.
- Write from the user's mental model and outcome first. Prefer labels like `Default working directory`, `Update channel`, `Where secrets are stored`, and `Code changes`; avoid implementation words like `cwd`, `backend`, `runtime fallback`, `disclosure`, `manifest`, `provider`, or `repo` unless the surface is explicitly developer-only or the term is defined in `CONTEXT.md` and expected for the user.
- Every non-obvious setting or control needs earned secondary text that answers: what changes if I use this? Keep it compact and operational; do not add marketing copy or restate the label.
- Enum values must be human-readable in the UI. Do not expose raw values such as `auto`, `collapsed`, `env-only`, or `fileExplorer` when a clearer label like `Automatic`, `Start collapsed`, `Environment only`, or `File Explorer` is possible.
- Prefer concrete nouns and verbs over abstract platform language. Say what the app will do: `Launch Neon Pilot when you sign in`, `Keep important tool results visible`, `Clear default`, `Save API key`.
- Hide advanced/internal identifiers unless they help recovery or debugging. If shown, label them as advanced details, for example `Advanced name: EXA_API_KEY`.
- When touching a page, opportunistically fix adjacent confusing copy in the same surface if it is low-risk and covered by the same validation path.

## UI design bans

- Before creating or modifying user-visible app or extension UI, read `docs/design/neon-pilot-taste.md`. For generated extension UI, also read `benchmarks/extension-quality/visual-rubric.md` and use `docs/design/extension-visual-refinement.md` when iterating with screenshot-backed judges.
- Always choose the most user-friendly control for the job. Prefer constrained controls such as dropdowns, segmented controls, checkboxes, toggles, sliders, steppers, pickers, and resource choosers over free-form text inputs when the valid values are known. Prefer key/value or structured row editors for individual settings over a raw JSON textarea unless the data is genuinely large, deeply nested, or expert-only.
- User-reachable actions should be command-backed so they can appear in the command palette and be hot-keyed. Add command contributions for meaningful buttons, navigation actions, workflow operations, and toolbar actions; wire default or user-editable keybindings when a shortcut is part of the expected workflow.
- Avoid nested bordered containers/cards unless truly unavoidable.
- Avoid decorative pills/chips as a default treatment; use spacing, typography, and alignment for hierarchy.
- Keep pages visually consistent; do not design in isolation.

## Workflow references

- Development, validation, UI QA, gitleaks, and checkpoint details: `docs/development.md`.
- Release process, current version, signed build flow, and release gotchas: `docs/release-cycle.md`.
- Extension authoring/API rules: `docs/extensions.md` and `packages/extensions/README.md`.
- Browser feature docs: `installable-extensions/system-browser/README.md`; Workbench Browser skill handles built-in browser context.
