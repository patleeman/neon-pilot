# Onboarding Extension

Owns Neon Pilot's first-run guided tour.

The tour is intentionally not a wizard and does not create a fake welcome
conversation. It opens real app routes, explains the surface the user is
looking at, and keeps the user oriented with a compact overlay.

## Product Model

The tour teaches the core Neon Pilot idea:

- Neon Pilot has a small core: conversations, runtime, routing, and the
  extension host.
- Most product capabilities are extensions.
- Extensions can add pages, workbench views, composer controls, tools,
  commands, settings, automations, model integrations, and agent context.
- If the user wants a feature, they can ask the agent to build or modify an
  extension, then iterate until it fits.

## Flow

On first launch from a landing/new-conversation route, the extension starts a
lightweight tour:

1. **Settings -> Providers** - connect the model provider Neon Pilot will use.
2. **Extensions** - explain that the app is built from extensions.
3. **Extensions** - explain that new capabilities can be built by talking to the
   agent.
4. **New conversation** - show Chat vs folder-based work.
5. **New conversation** - finish by drafting an extension-building starter
   prompt.

Users can skip at any point. Completed and skipped states are persisted in
extension storage under `onboarding:tour:v1`.

## Implementation Notes

- `src/backend.ts` owns persisted tour state only.
- `src/frontend.tsx` renders the top-bar bootstrap component and fixed tour
  overlay.
- The overlay navigates through real routes; if a highlighted selector is not
  present, it falls back to a compact panel without blocking the route.
- Do not reintroduce a static onboarding transcript. Onboarding should teach the
  real application by using the real application.
