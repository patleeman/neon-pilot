# Routines Empty-State Redesign

Date: 2026-07-01

## Screenshot Read

The attached Routines empty state is the current implementation path for a profile with no lifecycle events selected or added. It renders:

- Global route nav with Routines selected.
- Routines contextual sidebar with an empty note.
- Main Routines page with an intro, `Add event`, and an explainer empty state.
- Right context rail with `No event selected` plus an empty Runs section.
- First-run product tour card floating over the lower-right work area.

The screen is not broken, but it feels ugly because multiple surfaces explain emptiness at the same time. The page, left sidebar, context rail, and tour are all competing to teach the first action. The result reads like scaffolding instead of a workbench.

## Problems To Fix

1. **Too many empty states**
   The main page, sidebar, and context rail all say variants of "nothing yet." Only one surface should own first-run guidance.

2. **The primary object is abstract**
   "Lifecycle event" is accurate, but the feature is unfamiliar. The first-run state should teach the object model first: events have Before and After lanes, and routines are prompt blocks placed in those lanes.

3. **The page body collapses into blank space**
   After the explanatory block, most of the editor region is empty. Routines is an editor page, so even the zero state should preview the editor structure: event list, Before lane, After lane, runs context.

4. **Context rail is too loud when there is no selection**
   `No event selected` plus `Runs` gives the rail equal visual weight to the main first action. In the no-event state, the rail should either be hidden by route state or reduced to a single quiet setup note.

5. **The tour steals hierarchy**
   The provider setup tour overlays the context rail and becomes the strongest visual object on the page, even though it is unrelated to Routines. Routines should remain useful behind it, and setup guidance should avoid covering route-owned context rails.

## Revised Design Direction

Use a compact educational workbench state instead of either a prose-only empty state or a picker-only empty state.

The strongest direction is **Concept A: Learn, then start** from the companion concept board. It treats first-run Routines as an unfamiliar workflow that deserves a short explanation, but the explanation is structured as product objects instead of a loose paragraph:

- Keep `AppPageIntro` concise, with the feature job in one sentence.
- Add an educational first-run panel with three compact concepts: `Events`, `Before / After`, and `Routine blocks`.
- Put concrete examples directly under the explanation instead of a separate manual event chooser.
- Write example labels as jobs the user recognizes, such as `Check before checkpoint` or `Ask before risky background work`.
- Let examples create editable starter routines.
- Make the context rail quiet until an event is selected.
- Keep the left contextual sidebar compact: section title, plus action, and a one-line message.

## Recommended Empty States

### No Events Added

Main page:

- Title: `Routines`
- Toolbar action: `Add event`
- Body heading: `Teach Neon Pilot what to do around key moments`
- Body copy: `Routines are prompt blocks that run before or after lifecycle events, such as checkpoint saves or background commands.`
- Educational model: `1 Event -> 2 Before/After lanes -> 3 Routine blocks -> 4 Run history`
- Example starts:
  - `Check before checkpoint`
  - `Write a checkpoint handoff`
  - `Ask before risky background work`
  - `Choose a path before agent start`
- Optional toolbar action: `Add event` for advanced/manual setup.

Left sidebar:

- Section: `Routines`
- Empty message: `No events yet.`

Context rail:

- Prefer hidden if the shell supports hiding route-owned rail while no event exists.
- If visible: one header only, `No event selected`, with no separate Runs section.

### Event Selected, No Routines

Main page:

- Title: selected event title.
- Working surface: visible `Before` and `After` lanes with inline `Add routine` rows.
- Compact helper: `Add a routine to run before this event starts or after it finishes.`
- Avoid a separate boxed empty state above the lanes.

Context rail:

- Show event metadata and a quiet `Runs will appear after this event executes.` line.
- Do not repeat general Routines explanation.

## Copy Direction

Use compact operational copy:

- `Teach Neon Pilot what to do around key moments`
- `Routines are prompt blocks that run before or after lifecycle events.`
- `Events are moments Neon Pilot can react to.`
- `Before runs setup checks. After runs follow-up work.`
- `Routine blocks run prompts, choose paths, ask you, warn, or stop the event.`
- `Try a ready-made routine`
- `Check before checkpoint`
- `Write a checkpoint handoff`
- `Ask before risky background work`
- `Choose a path before agent start`
- `Before`
- `After`
- `Runs appear after this event executes.`
- `No events yet.`

Avoid:

- `Editor page`
- Long unstructured "Routines let..." definitions inside the editor.
- Numbered steps when they repeat visible controls, but do use a compact model sequence when it teaches the feature.
- A second generic chooser under the examples.
- Group labels like `Common` or `Background work` in the first-run body when concrete examples would teach more clearly.
- Repeating "Add an event" in the page, sidebar, and context rail.

## Implementation Notes

- Keep using shared primitives from `@neon-pilot/extensions/ui`.
- The likely production change is in `extensions/system-routines/src/RoutinesPage.tsx`.
- Replace the no-selected-hook `AppPageEmptyState` with a compact educational section plus starter examples.
- Replace the selected-hook no-routine `EmptyState` with inline lane empty rows inside Before and After.
- Consider changing `RoutinesContextRail` so the no-selection rail is either hidden by route contribution state or uses a single quiet header/body note.
- Coordinate with the setup tour so it does not cover route-owned context rails when possible.

## Companion Artifact

Open `docs/design/routines-empty-state-concepts.html` to compare four static concepts:

1. Learn, then start.
2. Starter templates.
3. Empty timeline lanes.
4. Command-style chooser.

Concept A is the recommended first implementation target. Concept C is the recommended selected-event empty state.
