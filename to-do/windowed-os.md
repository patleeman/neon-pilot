# Windowed OS To-Do

Running beta/design notes for the separate Neon Pilot windowed desktop mode.

## Fixes

1. Conversation window needs a full windowed styling and workbench affordance pass.
   - Add a control to collapse/hide the attached workbench panel from the chat window.
   - Workbench title/header bars do not match the windowed OS color/border language.
   - The chat composer/input box does not have the same dark bordered windowed treatment.
   - Some chat buttons use the dark bordered style while others still look like stable Neon Pilot controls.
   - Run a broader pass on chat transcript rows, tool blocks, composer, workbench tabs, empty workbench state, borders, spacing, typography, and button treatment so the whole conversation window matches the windowed OS design.
   - 2026-07-03 progress: attached workbench new-tab/empty surface now has scoped windowed hooks and a compact dark-bordered launch panel; verified live with the real chat window workbench.
   - 2026-07-03 progress: native browser/workbench bounds are allowed again for a single focused, unobstructed chat window in desktop mode while overlays, clipped windows, background focus, and overlapping windows still suppress the BrowserView. Static composer/model menus and resize handles no longer falsely block the browser host. Covered with focused browser/layout/main-process/design-system tests, desktop UI/main builds, and live `/?shell=windowed` QA for the unblocked single-chat case plus the overlapping Automations blocked case.
   - 2026-07-03 progress: attached workbench file bar, file actions, resize handle, and extension rail now expose stable class hooks and receive scoped windowed OS border/color treatment. Covered with layout/windowed design-system tests plus desktop UI and windowed package builds; still needs a broader transcript/composer visual sweep.
   - 2026-07-04 progress: attached workbench collapse/open states now have canonical Storybook examples in light and dark modes, plus collapsed one-column layout guards. Verified with windowed OS tests, Storybook/package builds, desktop UI build, and live `/?shell=windowed` QA toggling the real chat workbench from shown to collapsed.

2. Drawing/Scally mode needs windowed styling and sizing fixes.
   - Drawing mode colors do not match the windowed OS palette.
   - The current drawing modal is too large and visually heavy.
   - Modal chrome/actions should match the dark-bordered windowed button and surface treatment.
   - This likely should stop being a giant modal and become a child/sub-window.
   - 2026-07-03 progress: Excalidraw editor opens as a non-modal windowed child surface in desktop mode instead of inheriting the fullscreen extension modal class; verified live with `aria-modal=false`, `data-windowed-child-window=true`, click-through backdrop, and 860x560 sizing.

3. Add parent-attached sub-windows.
   - Need a sub-window concept for windows attached to a parent window.
   - Closing a parent window should close its sub-windows.
   - Minimizing a parent window should minimize its sub-windows.
   - Parent and sub-windows should share the same toolbar/titlebar color for simpler grouping.
   - Candidate first uses: drawing/Scally, terminal, browser, chat workbench tabs, and details/popovers that are currently oversized modals or right-side panels.
   - 2026-07-03 progress: chat parent windows now publish close/minimize lifecycle events, and the windowed Excalidraw child window attaches by stable parent window id. Verified live in `/?shell=windowed`: creating a drawing from New conversation opened a child window with `data-parent-window-id="chat:draft"`, and minimizing New conversation dismissed the drawing child window.
   - 2026-07-03 progress: parent minimize/restore is now reversible for the drawing child window. Verified live in `/?shell=windowed`: creating a drawing kept one mounted child window, minimizing New conversation set `data-parent-window-minimized="true"` and `display: none`, then restoring New conversation from the taskbar cleared the minimized flag and restored the child window.
   - 2026-07-03 progress: saved drawings picker now uses the same parent id lifecycle and reversible minimize/restore data hook as the drawing editor. Covered with focused picker/shell/design-system tests and desktop UI build; live app-path QA reached `/?shell=windowed`, but Automations owner-thread navigation did not open a persisted chat window in that run, so saved-picker visual lifecycle still needs a successful persisted-chat live pass.
   - 2026-07-03 progress: chat windows now expose a parent-attached Terminal child window from the window toolbar. The child hosts the real `system-terminal` surface in windowed presentation, carries parent id/title metadata, and closes with parent lifecycle events. Covered with focused shell/design-system tests, desktop UI/windowed package builds, and live `/?shell=windowed` QA for open, parent minimize/restore, and parent close.

4. Extract workbench tools into sub-windows.
   - Once sub-windows exist, explore pulling Chat, Terminal, Browser, and Drawing out of the attached two-pane workbench.
   - Chat can then become a cleaner primary conversation window, with workbench tools as parent-attached child windows.
   - After proving this in Chat, sweep other apps for modal/right-panel surfaces that should become sub-windows.
   - 2026-07-03 progress: Terminal is now the first real workbench tool available as a chat-attached child window while leaving the attached workbench tab path intact.

## Verified / Retired

- Start menu item hover/click hit area is shifted.
  - Verified in live `/?shell=windowed` QA on 2026-07-03: the leading edge hovers and launches Settings.
- Opening the Start menu hides window contents.
  - Verified in live `/?shell=windowed` QA on 2026-07-03: Automations stays visible with the Start menu open.
- Add a right-side taskbar injection area.
  - Implemented and checkpointed in `bb394f0c5`; verified Caffeinate renders in the taskbar extension action lane.
- Window resize handles overlap the top-right close button.
  - Verified in live `/?shell=windowed` QA on 2026-07-03: the close button receives center and right-half pointer hits.
- Start menu does not close when clicking the empty desktop background.
  - Verified in live `/?shell=windowed` QA on 2026-07-03: empty desktop clicks dismiss the Start menu.
- Start menu items can become unclickable with pointer input.
  - Fixed app launch on primary press before click dispatch; verified unit/layout coverage and live `/?shell=windowed` QA on 2026-07-03: pressing Automations opened/focused the Automations window and closed the Start menu.

## Theme Work

1. Add light/dark mode support.
   - Windowed OS needs both light and dark modes.
   - This should live in the separate windowed design system.
   - Cover surfaces, borders, text, accents, shadows, terminal/browser/workbench content, taskbar, start menu, windows, dialogs, hover states, and focus states.

2. Add time-of-day theme mode with gradual transitions.
   - Automatic theme mode based on local time.
   - Gradually interpolate between phases instead of jumping discretely.
   - Suggested phases: deep night, night, dawn, morning, bright noon, afternoon, dusk.
   - Include manual override modes: light, dark, and time-of-day.
   - Respect reduced motion where relevant, while keeping color transitions gentle.

## Product / Architecture

1. Explore an app-centric OS model above extensions.
   - Consider a higher-level abstraction than extensions: installable apps that provide core functionality.
   - Decide whether extensions remain as modifiers/plugins for apps, or whether everything becomes apps.
   - Possible direction: collapse many first-party extensions into apps.
   - Chat could become a real app that owns conversation, workbench, browser/terminal attachment, model controls, and related core workflow.
   - Other app candidates: Automations, Telemetry/Diagnostics, Model Routing/Gateways, Skills, Settings, Extension/App Manager.
   - Strategic motivation: Neon Pilot should feel less like another generic agent harness and more like an agentic operating system/application environment.
   - Needs product design and architecture exploration before implementation.
