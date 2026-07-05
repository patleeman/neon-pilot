# Windowed OS To-Do

Running beta/design notes for the separate Neon Pilot windowed desktop mode.

## Current Goal: App-First Windowed OS Migration

Complete the Windowed OS app-first cutover now. Apps are the user-facing product primitive; extensions/packages remain only where they are still useful implementation and runtime boundaries.

Keep this as a big-bang migration on the windowed branch: first-class app registry, app-facing launch/routing/settings/manager surfaces, inherited live-route polish, and real app-path validation before calling the beta branch ready.

### Product model direction

- Make **Apps** the user-facing product primitive.
- Keep extension/package mechanics only where they are still useful as implementation/runtime boundaries.
- Remove "Extensions" as normal user-facing language; replace it with **Apps**, **App Manager**, app capabilities, or developer/debug wording where unavoidable.
- Treat every user-openable surface as an app: Chat, Browser, Terminal, Files, Automations, Settings, App Manager, Model Arena, Gateways, Routines, Skills, Diagnostics, Workflows if still distinct.
- Treat smaller extension-like behavior as app-owned capabilities: reply actions, prompt assembly, setup/readiness, provider integrations, MCP, dictation, settings components, commands, tool surfaces, and background services.

### Active architecture direction

- Create a first-class app manifest/registry shape that owns app identity, routes, windows, settings, commands, tools, services, readiness, permissions/capabilities, accent, icon, and default window behavior.
- Replace extension-registry-driven desktop launch behavior with app-registry-driven launch behavior.
- Make Windowed OS the primary shell/root.
- Remove or retire the old stable sidebar/topbar shell assumptions instead of keeping both shells indefinitely.
- Update route/navigation semantics so opening a route means opening/focusing the owning app window.
- Update command semantics around app operations: open, focus, close, new window, child window, app-specific actions.
- Rebuild Settings around apps and app-owned sections instead of one giant extension contribution aggregation.
- Rebuild Extensions into App Manager, focused on installed apps, enabled state, permissions/capabilities, background services, version/source, settings, and developer details.

### First-party consolidation targets

- `system-browser` -> Browser app.
- `system-terminal` -> Terminal app.
- Files/workspace explorer surfaces -> Files app.
- `system-settings` -> Settings app.
- automation/scheduled task/run inspection surfaces -> Automations app.
- `system-model-arena` -> Model Arena app.
- `system-model-gateway` and routing/provider-facing config -> Gateways app.
- `system-skills` + `system-skill-search` -> Skills app.
- telemetry, logs, health, release/runtime diagnostics -> Diagnostics app.
- reply actions, prompt assembly, conversation-specific helpers -> Chat app/runtime capability.
- setup readiness and install/update management -> Settings/App Manager capability.

### Active migration buckets

1. Full live dark-mode QA pass.
   - Screenshot and inspect Chat, Settings, App Manager/Extensions, Skills, Gateways, Model Arena, Routines, Automations, Terminal, Browser, Files, and Diagnostics in light and dark.
   - Fix contrast, spacing, typography, control treatment, hover/focus states, and clipped/overlapping content as each issue is found.
   - 2026-07-05 progress: crowded live dark-mode taskbars now scroll the focused app button into view when a far-right window becomes active, keeping the active button out from under the trailing theme controls. Verified in Electron/CDP with Automations focused after opening the dark app matrix.
   - 2026-07-05 progress: live Electron/CDP dark-mode route sweep opened Automations, Gateways, AI Gateway, Model Arena, Routines, App Manager, Skills, and Diagnostics as desktop windows; after route data settled, each rendered content in the window layer with no old right-rail/inspector surfaces detected. Screenshot QA: `/tmp/windowed-os-dark-route-sweep-after-wait.png`.
   - 2026-07-05 progress: live Electron/CDP light-mode route sweep opened Chat, Settings, Automations, Gateways, AI Gateway, Model Arena, Routines, App Manager, Skills, and Diagnostics. Fixed the only route-layout issue found: Diagnostics model-usage tables now contain their header/row grids without widening the route body. Verified with `/tmp/windowed-os-light-diagnostics-after-overflow-fix.png`.
2. Settings live route polish.
   - Verify the real `shellPresentation="windowed"` Settings route, not only Storybook targets.
   - Polish provider settings, extension/app settings components, dense rows, section navigation, narrow window behavior, and the removal of unnecessary right-side/stable-shell panels.
   - 2026-07-05 progress: live Electron/CDP dark-mode sweep verified Settings uses the real `settings-page-windowed` two-column shell, renders a single routed section page, keeps the left section rail active across Appearance/Providers/Conversation/Workspace/Commands/Security/Apps/Desktop, and does not render the old inspector/right rail or Stable shell control. Screenshot QA: `/tmp/windowed-os-dark-settings-live.png`.
3. Browser and Files child-window live QA.
   - Open from Chat, reload/restart with child windows open, minimize/restore parent, minimize children independently, close parent, toggle themes, overlap windows, clip windows, and verify native BrowserView/iframe behavior does not overlay desktop chrome.
   - 2026-07-04 progress: Browser and Files toolbar actions now resolve the parent chat by live window id before opening child windows, fixing the live no-op where enabled toolbar buttons did not spawn child windows after reload/focus changes. Verified in the running Electron app via CDP: Browser and Files opened as sibling desktop windows with chat parent metadata and taskbar entries.
   - 2026-07-04 progress: Browser, Files, and Terminal now have focused regression coverage for persisted child-window restore, parent metadata, taskbar parent labels, host instance ids, Files/Terminal cwd restoration, parent minimize/restore, and parent-close pruning. Browser and Files also cover draft-to-saved chat retargeting.
   - 2026-07-05 progress: restored child windows are pruned immediately when their parent chat is missing, preventing stale Browser/Files/Terminal windows from flashing as standalone desktop windows after localStorage restore.
   - 2026-07-05 progress: live Electron/CDP QA in dark mode verified Browser and Files open from Chat as sibling desktop windows with parent metadata, no nested window frames, no renderer iframes overlaying desktop chrome, and parent minimize/restore keeps taskbar focus on the parent while hiding/restoring attached child windows.
   - 2026-07-05 progress: live Electron/CDP QA verified Terminal opens from Chat as a sibling parent-attached child window with `system-terminal` host content, taskbar entry, and no nested frame rendering. Screenshot QA: `/tmp/windowed-os-dark-terminal-child-live.png`.
4. Inherited chat polish.
   - Continue the scoped windowed CSS/design-system pass for transcript rows, running/tool states, action buttons, menus, composer states, attachments, model picker, CWD/context indicator, and dark-mode readability.
   - 2026-07-04 progress: chat-attached child-window empty states now override warning tint with normal windowed ink contrast so Files/Browser unavailable copy stays readable in dark mode. Covered with windowed OS tests/builds, desktop UI build, and live dark-mode screenshot QA.
   - 2026-07-05 progress: live dark-mode Chat QA verified the compact top toolbar, CWD/context control, Browser/Files/Terminal icon actions, workspace picker, and composer controls render with readable contrast and no horizontal overflow in a clean New conversation window. Screenshot QA: `/tmp/windowed-os-dark-chat-current.png`.
5. Modal/right-panel to subwindow cleanup.
   - Sweep app surfaces for stable right panels, oversized modals, and detail drawers.
   - Convert appropriate detail/edit/inspect surfaces into parent-attached desktop subwindows with taskbar/lifecycle behavior.
6. App-first runtime cutover.
   - Create and wire a first-class Windowed OS app registry instead of deriving the desktop launcher and core app identity directly from extension nav/main-view contributions.
   - Make App Manager, Settings, command/search labels, and route chrome consume app-facing metadata where user-visible.
   - Keep extension ids, package loading, backend actions, and contribution plumbing as implementation details behind the app model.
   - Retire remaining normal-user "Extensions" language in favor of Apps/App Manager/app packages/developer details.
   - Keep each intermediate commit understandable and validated.
   - 2026-07-05 progress: added a first-class `windowedAppRegistry` projection for Windowed OS app identity, owner package metadata, canonical routes, accents, aliases, and window defaults. `WindowedLayout` now consumes this app registry instead of owning extension-derived launcher logic inline, and canonical apps now win over duplicate extension nav/view labels for Start menu/taskbar/window identity.
   - 2026-07-05 progress: App Manager build prompts and repository notices now use app-package/app-repository language, route loading fallbacks say app page, and Settings shortcut save/error copy says app shortcuts/apps instead of extension shortcuts/extensions.
   - 2026-07-05 validation: focused registry coverage, full `WindowedLayout` suite, route loading tests, Settings route/panel/desktop shortcut tests, and App Manager frontend/manifest tests pass with the app-first copy and canonical app IDs.
   - 2026-07-05 progress: Settings app-owned sections now use `/settings/apps` and `/settings/apps/:id` as the canonical app-facing route while preserving `/settings/extensions` as a legacy compatibility alias. App Manager settings links and readiness action tests now generate app routes, and the Settings manifest registers the app settings page at `/settings/apps`.
   - 2026-07-05 validation: focused Settings/App Manager/readiness tests, desktop UI build, and live Electron/CDP QA confirmed App Manager generated `/settings/apps/...` links with no `/settings/extensions` links and opened `neon-pilot://app/settings/apps/system-extension-manager` in the Settings window. Screenshot QA: `/tmp/windowed-os-settings-apps-route-live.png`.

### Next concrete implementation backlog

1. Make core app availability explicit in the Windowed OS launcher.
   - Current launcher still derives most apps from extension nav/main-view contributions.
   - Replace this with explicit app-registry coverage for core apps so nav/view contribution gaps do not remove primary apps from the Windowed OS launcher.
   - Validate by opening every Start menu app in the live windowed shell.
   - 2026-07-05 progress: the Start menu now fills missing canonical beta apps from the Windowed OS app roster after extension contributions are collected when the owning first-party app extension is enabled, so missing nav/main-view contributions no longer remove Automations, Gateways, AI Gateway, Model Arena, Routines, App Manager, Skills, or Diagnostics from the launcher. Disabled apps stay hidden instead of opening broken unregistered routes. Focused coverage verifies complete canonical ordering, fallback launch routing, and disabled-app pruning.
   - 2026-07-05 live QA: fresh Electron Windowed OS launch with CDP confirmed the dark Start menu shows Chat, Automations, Gateways, AI Gateway, Model Arena, Routines, App Manager, Skills, Diagnostics, and Settings; Workflows stays hidden because `system-dynamic-workflows` is disabled in this profile. Pointer-launch smoke opened Automations, Gateways, AI Gateway, Model Arena, Routines, App Manager, Skills, Diagnostics, and Settings as taskbar windows.
2. Retire App Manager's live right rail in favor of the existing parent-attached detail dialog.
   - 2026-07-05 progress: removed the `/extensions` route `rightSidebarView` contribution, deleted the stale rail export/implementation, and updated route-shell guardrails so App Manager stays main-only with details owned by the page/dialog flow.
   - Validate App Manager row click/details, narrow layout, dark mode, and no right-sidebar toggle in Windowed OS.
3. Clean remaining normal-user "Extensions" copy in Settings, App Manager, command/action metadata, and smoke tests.
   - Keep internal ids and developer/debug wording only where the implementation concept is still genuinely extension-specific.
   - Validate command/search aliases can still find App Manager, but visible labels read as Apps/App Manager.
   - 2026-07-05 progress: swept App Manager, Settings, command palette/slash-command categories, fallback route chrome, CLI help descriptions, and related tests so normal visible copy says Apps/App Manager/app package while preserving internal extension ids/routes/API names. Live Windowed OS smoke confirmed App Manager renders `Apps` and `APP / STATUS / CONTROLS` with no visible `Extensions` body copy.
4. Add narrow/dark Settings route coverage for Providers and App settings.
   - Validate long rows, provider editor controls, app setting rows, and action groups at narrow widths.
   - 2026-07-05 progress: persisted Settings windows now shrink restored bounds to the current desktop width instead of reopening mostly offscreen on narrow viewports, while exact maximized windows remain maximized. Windowed Settings also gained a narrow route-container collapse fix, a scroll-pane min-width guard, and dark-mode route-body status color remapping for inherited `text-danger`/`text-success` rows.
5. Convert remaining stable-shell right-rail detail surfaces into windowed detail/subwindow flows.
   - Parallel candidates: Model Arena, Skills, App Manager.
   - 2026-07-05 progress: Skills no longer contributes a route-owned right sidebar. Skill details now stay on the page/windowed dialog path, the stale `SkillsContextRail` entrypoint and component were removed, and the shared route-shell manifest guardrail now treats Skills as a main-only detail-dialog route alongside App Manager.
   - 2026-07-05 progress: Gateways no longer contributes a route-owned right sidebar. Gateway status/configuration/access/activity remain in the main page plus existing parent-attached windowed dialogs, and the stale `GatewaysContextRail` component/test path was removed.
   - 2026-07-05 progress: Model Arena no longer contributes a route-owned right sidebar. Challenger setup, sampling controls, status, and rankings remain inline in the windowed page, and the duplicate `ModelArenaContextRail` path was removed.
   - 2026-07-05 progress: Routines no longer contributes a route-owned right sidebar. Event selection remains in the route sidebar, routine edit and run history stay in parent-attached windowed dialogs, and the stale `RoutinesContextRail` path was removed.
6. Run the live light/dark route matrix and file per-surface fixes.
   - Toggle Light/Dark/Time and inspect Chat, Settings, App Manager, Skills, Gateways, Model Arena, Routines, Automations, Terminal, Browser, Files, Diagnostics, and Workflows at normal and narrow sizes.

### Acceptance criteria for this push

- App launches into Windowed OS by default.
- Windowed OS has a first-class app registry/manifest shape for app identity, ownership, launch route, window defaults, accent/icon, aliases, and user-facing metadata.
- Start menu/taskbar/window route behavior is app-registry-driven for core apps, while extension packages remain a hidden implementation boundary.
- Start menu opens all beta-critical core apps.
- Chat works end-to-end as an app, with threads represented as windows/taskbar entries.
- Browser, Terminal, and Files work as first-class child windows with reload-safe lifecycle.
- Settings opens as an app and edits real settings.
- Automations list/detail and run inspection work.
- Model Arena and Gateways surfaces work.
- App Manager replaces the normal Extensions experience in user-facing Windowed OS routes.
- App Manager reads as an installed-apps/app-packages manager, with extension/package details moved to developer/advanced context only.
- Settings is organized around app-owned sections and app-facing labels where those settings are user-visible.
- Normal user UI avoids "Extensions" language except advanced/developer details.
- Light, dark, and time-of-day modes are usable across primary apps.
- Build, tests, app launch, and hands-on live QA pass before calling the branch beta-ready.

### Scope boundaries

- Do not remove the extension/package runtime, installer, backend action bridge, or contribution loader unless the new app boundary requires a narrow change.
- Do not break stable shell startup while this branch is beta-tested, but do not preserve old sidebar/topbar assumptions inside Windowed OS.
- Do not remove the attached Chat workbench yet. Browser, Terminal, Files, Drawing, and related tools can continue moving toward first-class child/app windows, but removal should wait until the independent window model is proven across live workflows.

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
   - 2026-07-04 progress: embedded chat workbench panes now identify as an attached workbench with a stable `data-windowed-attached-workbench` hook and accessible label, with the canonical CSS keyed to that hook for future chat/workbench styling. Covered with real embedded layout regression, windowed OS style tests, windowed package/Storybook builds, desktop UI build, and Storybook visual QA for inherited chat chrome plus attached workbench layout.
   - 2026-07-04 progress: attached workbench Storybook now exercises the same live workbench panel/tab classes and attached-workbench data hook, with dark-friendly surface mixing and container-query tab wrapping for narrow attached panes. Verified with windowed OS tests/builds and Storybook QA in light, dark, 520px, and 390px viewports with no horizontal overflow.
   - 2026-07-04 progress: inherited chat transcript tool blocks now use explicit windowed row padding, clipped rounded chrome, and separator borders so tool labels no longer sit on the block border. Verified with windowed OS tests/builds, Storybook build, and Chrome-rendered Storybook QA in light, dark, and narrow viewports with no horizontal overflow.
   - 2026-07-04 progress: chat workbench toolbar chrome now has a stable 42px compact row, wrapped action controls, and a bordered title chip so the inherited chat and browser workbench stories no longer show a loose pasted-on toolbar at 360px. Verified with windowed OS tests/builds, Storybook build, and Chrome-rendered dark/light compact screenshots with no horizontal overflow.
   - 2026-07-04 progress: composer warning notices use a full-surface warning tint instead of a left stripe, keeping "No workspace attached" readable in dark compact chat while matching the banned-left-stripe design rule. Verified with windowed OS tests/builds, Storybook build, and Chrome-rendered 360px dark inherited-chat QA with no horizontal overflow.
   - 2026-07-04 progress: composer attachment shelves now use denser wrapping chip tracks and a compact bordered sync-status pill, so medium chat windows keep attachments on one row while narrow windows still stack without overflow. Verified with focused windowed OS tests and Chrome-rendered dark inherited-chat QA at 520px and 390px.
2. Drawing/Scally mode needs windowed styling and sizing fixes.
   - Drawing mode colors do not match the windowed OS palette.
   - The current drawing modal is too large and visually heavy.
   - Modal chrome/actions should match the dark-bordered windowed button and surface treatment.
   - This likely should stop being a giant modal and become a child/sub-window.
   - 2026-07-03 progress: Excalidraw editor opens as a non-modal windowed child surface in desktop mode instead of inheriting the fullscreen extension modal class; verified live with `aria-modal=false`, `data-windowed-child-window=true`, click-through backdrop, and 860x560 sizing.
   - 2026-07-04 progress: the live Excalidraw editor now exposes the same compact toolbar status pill as the canonical drawing subwindow target (`draft`, `rev N`, loading/error), and the window title reads `Drawing editor` in desktop mode. Covered with focused editor/modal-host tests, targeted extension build, desktop UI build, Storybook build, and dark drawing-editor Storybook visual QA.

3. Add parent-attached sub-windows.
   - Need a sub-window concept for windows attached to a parent window.
   - Closing a parent window should close its sub-windows.
   - Minimizing a parent window should minimize its sub-windows.
   - Parent and sub-windows should share the same toolbar/titlebar color for simpler grouping.
   - Reduce the height of each window title/top bar; current window chrome feels a little too tall and should be tightened without making drag or control targets feel cramped.
   - Candidate first uses: drawing/Scally, terminal, browser, chat workbench tabs, and details/popovers that are currently oversized modals or right-side panels.
   - 2026-07-04 progress: titlebar chrome now uses a 20px row with 18px controls across primary windows, reusable dialog subwindows, and scoped drawing picker/editor headers. Verified with windowed OS tests/builds, desktop UI build, Storybook build, and Chrome-rendered dark desktop/drawing subwindow QA.
   - 2026-07-03 progress: chat parent windows now publish close/minimize lifecycle events, and the windowed Excalidraw child window attaches by stable parent window id. Verified live in `/?shell=windowed`: creating a drawing from New conversation opened a child window with `data-parent-window-id="chat:draft"`, and minimizing New conversation dismissed the drawing child window.
   - 2026-07-03 progress: parent minimize/restore is now reversible for the drawing child window. Verified live in `/?shell=windowed`: creating a drawing kept one mounted child window, minimizing New conversation set `data-parent-window-minimized="true"` and `display: none`, then restoring New conversation from the taskbar cleared the minimized flag and restored the child window.
   - 2026-07-03 progress: saved drawings picker now uses the same parent id lifecycle and reversible minimize/restore data hook as the drawing editor. Covered with focused picker/shell/design-system tests and desktop UI build; live app-path QA reached `/?shell=windowed`, but Automations owner-thread navigation did not open a persisted chat window in that run, so saved-picker visual lifecycle still needs a successful persisted-chat live pass.
   - 2026-07-03 progress: chat windows now expose a parent-attached Terminal child window from the window toolbar. The child hosts the real `system-terminal` surface in windowed presentation, carries parent id/title metadata, and closes with parent lifecycle events. Covered with focused shell/design-system tests, desktop UI/windowed package builds, and live `/?shell=windowed` QA for open, parent minimize/restore, and parent close.
   - 2026-07-04 progress: parent-attached detail dialogs now size like subwindows instead of near-full-page overlays, keeping the parent app visible at desktop widths while preserving full available width on narrow screens. Verified with windowed OS tests/builds, Storybook build, and Chrome-rendered Extensions detail screenshots at 760px and 520px with no horizontal overflow.
   - 2026-07-04 progress: parent-attached detail dialog layers now open below the parent titlebar by default, preserving visible parent chrome and controls behind detail subwindows. Verified with windowed OS tests/builds, Storybook build, and Chrome-rendered Automations/Routines/Gateways dark screenshots at 680px with no horizontal overflow.
   - 2026-07-04 progress: narrow parent-attached detail dialogs now use compact mobile top padding instead of the desktop titlebar offset, giving small windows more usable vertical space while keeping the desktop layering behavior. Verified with windowed OS tests/builds, Storybook build, and Chrome-rendered Extensions/Automations dark screenshots at 520px and 390px with no horizontal overflow.

4. Extract workbench tools into sub-windows.
   - Once sub-windows exist, explore pulling Chat, Terminal, Browser, and Drawing out of the attached two-pane workbench.
   - Chat can then become a cleaner primary conversation window, with workbench tools as parent-attached child windows.
   - After Browser, Terminal, Drawing, file browser, and related tools are extracted into real app/window surfaces, remove the attached Workbench from Chat instead of maintaining both models.
   - The Chat window should become just conversation and chat-specific controls; tool surfaces should live as independent windows/apps with taskbar presence and their own lifecycle.
   - After proving this in Chat, sweep other apps for modal/right-panel surfaces that should become sub-windows.
   - 2026-07-03 progress: Terminal is now the first real workbench tool available as a chat-attached child window while leaving the attached workbench tab path intact.

5. Audit inherited interface CSS against the new windowed design.
   - Go through every existing Neon Pilot surface rendered inside windowed OS and identify old-styled controls, spacing, typography, borders, hover states, empty states, and panel chrome that do not match the canonical windowed design.
   - Start with the chat interface: transcript rows, tool blocks, composer, model controls, attachment buttons, workbench/browser surfaces, terminal chrome, popovers, menus, and status text still have mixed legacy styling.
   - Convert recurring fixes into scoped windowed design-system primitives or stable class hooks instead of one-off CSS patches.
   - Validate both light and dark themes while doing this pass so contrast and readability issues are caught before the styles spread.
   - 2026-07-04 progress: paused BrowserView overlays now scroll-contain their state block in short/narrow workbench panes, so the URL chip no longer clips at the bottom in dark attached-browser QA.

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
- Terminal child windows should render in the desktop window layer, not clipped inside chat.
  - Verified in `WindowedLayout` focused coverage on 2026-07-04: the Terminal child opens as a sibling desktop `WindowFrame`, carries chat parent metadata/lifecycle, hosts `system-terminal` with windowed presentation, and closes/minimizes/restores with the parent chat window.
- Browser child windows need a canonical isolated design target.
  - Added a `BrowserWindow` Storybook example on 2026-07-04 using the chat-owned child-window frame, browser controls, and paused native-browser state; verified the built story visually at `windowed-os-desktop-shell--browser-window`.

## Theme Work

1. Add light/dark mode support.
   - Windowed OS needs both light and dark modes.
   - This should live in the separate windowed design system.
   - Cover surfaces, borders, text, accents, shadows, terminal/browser/workbench content, taskbar, start menu, windows, dialogs, hover states, and focus states.
   - Audit dark mode specifically for unreadable or low-contrast text, especially inherited chat/workbench/terminal/browser UI that was not designed for the windowed OS palette.
   - Do a page-by-page visual pass in dark mode and fix the obvious readability failures before calling the theme usable.

2. Add time-of-day theme mode with gradual transitions.
   - Automatic theme mode based on local time.
   - Gradually interpolate between phases instead of jumping discretely.
   - Suggested phases: deep night, night, dawn, morning, bright noon, afternoon, dusk.
   - Include manual override modes: light, dark, and time-of-day.
   - Respect reduced motion where relevant, while keeping color transitions gentle.
   - 2026-07-04 progress: taskbar theme mode now exposes the automatic option as "Time of day" to assistive tech and hover/tooltips while keeping the compact visible "Time" label. Covered by windowed design-system and desktop shell tests.

## Product / Architecture

1. Explore an app-centric OS model above extensions.
   - Consider a higher-level abstraction than extensions: installable apps that provide core functionality.
   - Decide whether extensions remain as modifiers/plugins for apps, or whether everything becomes apps.
   - Possible direction: collapse many first-party extensions into apps.
   - Chat could become a real app that owns conversation, workbench, browser/terminal attachment, model controls, and related core workflow.
   - Other app candidates: Automations, Telemetry/Diagnostics, Model Routing/Gateways, Skills, Settings, Extension/App Manager.
   - Strategic motivation: Neon Pilot should feel less like another generic agent harness and more like an agentic operating system/application environment.
   - Needs product design and architecture exploration before implementation.

2. Fork Neon Pilot around the windowed OS branch and make it the primary UI/runtime direction.
   - Create a fork where the current windowed OS branch becomes the main branch, then remove the old dual UI code paths instead of maintaining both shells.
   - Replace the old application shell with the windowed OS UI so deeper architectural changes can happen without compatibility pressure from the original Neon Pilot layout.
   - Reorganize the harness around an operating-system model where browser, terminal, file browser, chat, automations, settings, and other capabilities are first-class apps.
   - Decouple browser, terminal, file browser, and other workbench tools from chat transcripts so they can exist as independent app windows with their own lifecycle and tabs where appropriate.
   - Give agents desktop-level tools to inspect, screenshot, and interact with the full windowed environment, including individual app views and the same desktop state the user sees.
   - Agent desktop tools should be able to move, focus, minimize, maximize, resize, snap, close, and otherwise operate windows, plus inspect app/window metadata and visible UI state.
   - Use this fork to iterate on deeper harness and desktop-control architecture without preserving old shell compatibility.
