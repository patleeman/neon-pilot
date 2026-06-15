# Plan 001: Unify app and extension surface styling through shared UI primitives

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9ccf5d077..HEAD -- docs/design-system.md packages/ui packages/extensions extensions/system-automations extensions/system-gateways extensions/system-telemetry extensions/system-extension-manager scripts/extension-visual-eval.mjs scripts/extension-visual-judge.mjs`
>
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `9ccf5d077`, 2026-06-15

## Why this matters

The visual evaluation workflow captured real host screenshots for core pages and first-party extension pages under `artifacts/extension-quality/app-style-audit-2026-06-15`. The strongest anchors are Settings and Extensions: both are compact, structured, and visibly use the shared component grammar. The weakest captures are Automations empty state and parts of Telegram Gateway/Telemetry: they still drift into sparse first-launch canvases, custom section dividers, local dashboard panels, or page-specific empty/loading wrappers.

This plan makes the shared UI package the default enforcement mechanism rather than relying on each extension to recreate taste locally. After it lands, the same visual-eval route set should pass or produce narrow per-surface failures instead of broad `too_sparse`, `box_in_box`, `title_description_noise`, or `missing_shared_primitives` findings.

## Current state

- `docs/design-system.md:17-29` already says agents should search `packages/ui`, use shared primitives for page shells/states/controls, and audit for local recipes like `rounded-md border border-border-subtle`, `bg-elevated p-`, local button constants, and hand-written empty/error/loading text.
- `docs/design-system.md:61-72` lists the public foundation: `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `AppPageEmptyState`, `DataTable`, `DataTableEmptyRow`, `RuntimePage`, `RuntimeSection`, `MetricTile`, `DashboardGrid`, `Field`, `SearchInput`, `SegmentedControl`, `IconButton`, `ToolbarButton`, and related primitives.
- `packages/ui/README.md:93-131` gives the relevant component selection rules. Pay special attention to `DataTableEmptyRow`, `RuntimePage`, `RuntimeSection`, `MetricTile`, `DashboardGrid`, `AppPageLayout`, `AppPageIntro`, and `AppPageSection`.
- `extensions/system-automations/src/frontend.tsx:4-42` imports many shared primitives, and `extensions/system-automations/src/frontend.tsx:829-870` already has the intended table pattern. The captured first launch still shows a mostly blank page with centered "No automations yet" copy instead of preserving filter/table/detail shell.
- `extensions/system-gateways/src/frontend.tsx:1-26` imports shared primitives, but the captured `/gateways` page relies on custom horizontal dividers and setup sections. It should read more like a `RuntimePage` or compact list/detail setup flow.
- `extensions/system-telemetry/src/frontend.tsx:69-87` hand-rolls centered loading/error wrappers, and `extensions/system-telemetry/src/frontend.tsx:90-139` uses an extension page shell plus many local trace panels. The screenshot shows useful density, but several panels look like local bordered dashboards rather than a consistent `DashboardGrid`/`MetricTile`/`RuntimeSection` grammar.
- `extensions/system-extension-manager/src/panels.tsx:1622-1660` is the best current app-page anchor: `AppPageLayout`, `AppPageIntro`, search, icon actions, and table-first content. Preserve this as the comparison target.

Visual evidence from the planning capture:

- `/automations`: `artifacts/extension-quality/app-style-audit-2026-06-15/judge-screenshots/automations.png` shows a large empty canvas and centered empty message. Failure tags: `sparse_empty_state`, `unjudgeable_first_launch`, `missing_secondary_state`.
- `/gateways`: `artifacts/extension-quality/app-style-audit-2026-06-15/judge-screenshots/gateways.png` shows a better workflow, but sections are separated by full-width dividers and sparse vertical gaps. Failure tags: `box_in_box` risk, `title_description_noise`, `wrong_workflow_representation` risk.
- `/telemetry`: `artifacts/extension-quality/app-style-audit-2026-06-15/judge-screenshots/telemetry.png` is dense enough but visually panel-heavy. Failure tags: `box_in_box` risk, `decorative_status` risk where metric panels compete with content.
- `/extensions`: `artifacts/extension-quality/app-style-audit-2026-06-15/judge-screenshots/extensions.png` is the positive anchor for compact table-first app pages.
- `/settings`: `artifacts/extension-quality/app-style-audit-2026-06-15/judge-screenshots/settings.png` is the positive anchor for compact row-list settings pages.

The direct judge runner was attempted and failed because the local model gateway was not reachable:

```sh
pnpm run eval:extension-visual-judge -- --capture=artifacts/extension-quality/app-style-audit-2026-06-15 --models=opencode-go/kimi-k2.5,opencode-go/mimo-v2.5,opencode-go/qwen3.6-plus --timeout-ms=300000
```

Observed result: every model returned `fetch failed`, so no model score from this planning pass should be treated as valid.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| UI package tests | `pnpm --dir packages/ui run test` | exit 0 |
| UI package build | `pnpm --dir packages/ui run build` | exit 0 |
| Build affected extensions | `pnpm run extension:build -- extensions/system-automations && pnpm run extension:build -- extensions/system-gateways && pnpm run extension:build -- extensions/system-telemetry && pnpm run extension:build -- extensions/system-extension-manager` | exit 0 |
| Extension static boundary | `pnpm run check:extensions:static` | exit 0 |
| Desktop UI build | `pnpm --dir packages/desktop run build:ui` | exit 0 |
| Visual capture | `pnpm run eval:extension-visual -- --out=artifacts/extension-quality/app-style-unification-after --baseline-routes=/conversations/new,/settings,/settings/providers,/settings/desktop,/extensions,/automations,/gateways,/telemetry --judge-image-max-px=1200` | screenshots and `visual-capture-summary.json` written |
| Visual judges | `pnpm run eval:extension-visual-judge -- --capture=artifacts/extension-quality/app-style-unification-after --models=opencode-go/kimi-k2.5,opencode-go/mimo-v2.5,opencode-go/qwen3.6-plus --timeout-ms=300000` | usable visual judges exist; no `fetch failed` |

## Scope

**In scope**:

- `packages/ui/src/primitives.tsx`
- `packages/ui/src/primitives.test.tsx`
- `packages/ui/src/stories/*.tsx`
- `packages/ui/README.md`
- `docs/design-system.md`
- `extensions/system-automations/src/frontend.tsx`
- `extensions/system-gateways/src/frontend.tsx`
- `extensions/system-telemetry/src/frontend.tsx`
- `extensions/system-extension-manager/src/frontend.tsx`
- `extensions/system-extension-manager/src/panels.tsx`

**Out of scope**:

- Core extension loader or registry behavior.
- Dynamic Workflows enable/install behavior.
- New theme/color palette work.
- New extension features beyond layout, state, and primitive migration.
- Changing app route ownership or sidebar information architecture.

## Git workflow

- Branch: `advisor/001-unify-app-extension-styling`
- Commit message style: current repo history uses conventional prefixes such as `ui: refactor settings to row-list pattern` and `feat: add sidebar tree section for extensions`; use `ui: unify extension surface styling`.
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add missing shared primitives only where real usage proves the need

Search before adding anything:

```sh
rg -n "EmptyState|AppPageEmptyState|DashboardGrid|MetricTile|RuntimePage|RuntimeSection|DataTableEmptyRow|CenteredLoadingState|CenteredMessage" packages/ui/src extensions/system-automations/src extensions/system-gateways/src extensions/system-telemetry/src extensions/system-extension-manager/src
```

If existing primitives cover the target UI, do not add new components. If they do not, add the smallest generic primitive to `packages/ui/src/primitives.tsx`, export it from `packages/ui/src/index.ts`, add focused tests in `packages/ui/src/primitives.test.tsx`, and add or update a Storybook story. Likely candidates are a denser `AppPageEmptyState` pattern that preserves table/list/detail layout, or a reusable runtime/setup section composition if `RuntimePage` is not flexible enough for Telegram Gateway.

**Verify**: `pnpm --dir packages/ui run test && pnpm --dir packages/ui run build` -> both exit 0.

### Step 2: Fix Automations first-launch density

In `extensions/system-automations/src/frontend.tsx`, keep the table-first model from `AutomationTable` and the existing shared imports. Replace the centered empty state shown in the capture with a layout-preserving shell:

- Keep `AppPageIntro` and the `New automation` action visible.
- Keep filter/search controls visible if they are part of the normal non-empty list.
- Render a `DataTable` with headers plus `DataTableEmptyRow`, or use `AppPageEmptyState` inside a bounded list region.
- Add a selected-detail or guidance region if the normal workflow has a detail/editor pane. Do not center a message in the full page.
- Keep `New automation` as the primary path into the existing editor; do not invent a modal CRUD flow.

**Verify**: build `extensions/system-automations`, then capture `/automations` with the visual runner. The first viewport must show table/list structure, actions, and enough normal workflow chrome to judge the product before data exists.

### Step 3: Convert Telegram Gateway to shared runtime/setup chrome

In `extensions/system-gateways/src/frontend.tsx`, preserve backend calls and sidebar behavior. Refactor visual structure so setup uses shared primitives rather than full-width custom dividers:

- Prefer `RuntimePage`, `RuntimeHeader`, `RuntimeStrip`, and `RuntimeSection` if the gateway is best represented as a local runtime/configuration surface.
- Otherwise use `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `SettingsSection`, `KeyValueTable`, `DataTable`, `DataTableEmptyRow`, `Field`, `TextInput`, `StatusDot`, and `ToolbarButton`.
- Keep the sidebar route list compact; use sidebar primitives or the existing `ActivityTreeView` only where it matches native chrome.
- Replace broad "Get your credentials" and "Route messages" blocks with compact setup rows/sections. Secondary text must state operational consequences, not repeat the label.
- Keep token save/remove behavior and route attach/detach behavior unchanged.

**Verify**: build `extensions/system-gateways`, capture `/gateways`, and confirm the first viewport shows credential status, token field/action, route status/list shell, and recent activity without large blank gaps or decorative section dividers.

### Step 4: Normalize Telemetry panels to data-display primitives

In `extensions/system-telemetry/src/frontend.tsx` and trace subcomponents under `extensions/system-telemetry/src/traces`, keep the dense observability layout but reduce local panel chrome:

- Replace hand-rolled full-page loading/error wrappers with `CenteredLoadingState`/`ErrorState` or the closest shared feedback primitive.
- Use `StatGrid`, `Stat`, `DashboardGrid`, `DashboardGridCell`, `MetricTile`, `ProgressRow`, `DataTable`, and `DataTableEmptyRow` before local bordered panels.
- Preserve the time range `SegmentedControl` and refresh action.
- Empty chart/panel states should be compact and embedded inside the panel they describe; avoid giant empty areas.
- Remove emoji-like labels or decorative status treatments if they are present in visible headings; use `SectionLabel`, `MetaLabel`, or plain text.

**Verify**: build `extensions/system-telemetry`, capture `/telemetry`, and compare against the previous screenshot. Density should remain high, but repeated panels should share rhythm and anatomy.

### Step 5: Tighten Extension Manager as the positive anchor

In `extensions/system-extension-manager/src/panels.tsx`, avoid redesigning the page. Make only small consistency improvements discovered while applying the shared primitives:

- Keep the table-first layout from `renderExtensionTable`.
- Replace any local action or feedback chrome that now has a direct primitive from Step 1.
- Keep mobile fallback behavior, but do not let mobile cards influence desktop operational record layout.

**Verify**: build `extensions/system-extension-manager`, capture `/extensions`, and confirm the page still works as the positive anchor: compact search, icon actions, tab/filter row, table-first records, and no card grid on desktop.

### Step 6: Document the replacement rule so future extension work follows it

Update `docs/design-system.md` and `packages/ui/README.md` with any new primitive or clarified replacement rule from this work. Include:

- Which shared primitive owns layout-preserving empty states.
- Which primitive owns runtime/setup pages.
- Which primitives extension authors should use for metric dashboards.
- A short note that visual-eval route sets should exclude installable/default-disabled routes unless the eval installs them first.

**Verify**: `pnpm --dir packages/ui run build:storybook` -> exit 0.

### Step 7: Run the full visual-eval loop

Run:

```sh
pnpm run eval:extension-visual -- --out=artifacts/extension-quality/app-style-unification-after --baseline-routes=/conversations/new,/settings,/settings/providers,/settings/desktop,/extensions,/automations,/gateways,/telemetry --judge-image-max-px=1200
```

Then ensure the AI Gateway extension or local model gateway is listening at `http://127.0.0.1:8766/v1`, and run:

```sh
pnpm run eval:extension-visual-judge -- --capture=artifacts/extension-quality/app-style-unification-after --models=opencode-go/kimi-k2.5,opencode-go/mimo-v2.5,opencode-go/qwen3.6-plus --timeout-ms=300000
```

If the judge runner returns `fetch failed`, do not claim model-judged pass. Fix the gateway state or record the limitation clearly.

## Test plan

- Unit tests: add/update `packages/ui/src/primitives.test.tsx` only if new primitive behavior or class contract is introduced.
- Extension builds: build all touched extensions with `pnpm run extension:build -- <extension-dir>`.
- Static boundary: run `pnpm run check:extensions:static`.
- Desktop UI: run `pnpm --dir packages/desktop run build:ui`.
- User-visible validation: use `pnpm run eval:extension-visual` for `/automations`, `/gateways`, `/telemetry`, `/extensions`, `/settings`, and `/conversations/new`.
- Model-backed visual validation: run `pnpm run eval:extension-visual-judge` and require at least one usable judge with `imageAccess: true`.

## Done criteria

All must hold:

- [ ] `pnpm --dir packages/ui run test` exits 0.
- [ ] `pnpm --dir packages/ui run build` exits 0.
- [ ] Affected extension builds exit 0.
- [ ] `pnpm run check:extensions:static` exits 0.
- [ ] `pnpm --dir packages/desktop run build:ui` exits 0.
- [ ] Visual capture exists under `artifacts/extension-quality/app-style-unification-after`.
- [ ] Visual judges produce at least one usable `imageAccess: true` result, or the final report explicitly says the gateway was unavailable.
- [ ] `/automations` no longer presents a mostly blank centered empty state on first launch.
- [ ] `/gateways` uses shared section/runtime/setup primitives and avoids broad custom divider blocks.
- [ ] `/telemetry` keeps dashboard density while reducing local panel chrome.
- [ ] `/extensions` remains table-first and remains the positive anchor.
- [ ] No route set includes `/workflows` unless `system-dynamic-workflows` is installed/enabled for that eval.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The shared UI package lacks a primitive and adding it would require broad theming or shell changes outside this plan.
- Any touched extension requires backend API or persistence changes to complete visual unification.
- Visual capture cannot launch the desktop app after two reasonable attempts.
- Direct visual judges remain unavailable after confirming the AI Gateway/model gateway is supposed to be running.
- Improving one target surface requires changing route ownership, extension registry behavior, or default-enabled extension policy.

## Maintenance notes

- Future extension UI work should start from the route captures in `artifacts/extension-quality/app-style-audit-2026-06-15` and compare against the post-change captures from this plan.
- Reviewers should scrutinize whether new components are truly generic. Product-specific workflow logic belongs in the extension, not `packages/ui`.
- Keep this as a style-system consolidation, not a feature pass. Avoid adding new gateway, automation, or telemetry capabilities while executing it.
