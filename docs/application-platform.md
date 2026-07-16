# Application Platform

Neon Pilot is a self-extending application platform with an agent application. The desktop shell provides predictable global navigation while extensions provide the applications and product workflows that fill the canvas.

This document defines the approved application-shell behavior and the extension boundary used to implement it.

## Product contract

The shell owns only:

- the Neon Pilot launcher and Command-K shortcut
- back and forward navigation
- the application taskbar and overflow
- pinned/open application persistence
- global readiness, notifications, and update status
- route-to-application resolution and unavailable-view recovery

An application owns:

- its internal navigation and page hierarchy
- left sidebars, inspectors, split panes, tabs, and other working layouts
- resource selection and lifecycle
- page actions and application-specific controls
- empty, loading, error, and unavailable states inside its canvas

The shell does not expose a global page selector, conversation controls, extension actions, or inspector toggle.

All routes owned by installed applications and extensions use client-side navigation. Moving between applications or pages must not reload the renderer document; application content may change, but the shell, extension registry, and shared runtime remain mounted.

## Extension and application boundaries

An extension is the installable package and permission boundary. An application is a top-level user experience contributed by an extension.

An extension may:

- define one or more applications
- contribute pages and navigation to applications owned by other extensions
- contribute commands, search results, inspectors, and services without defining an application
- combine those contribution types when the feature genuinely spans them

Restricting an extension to one application is not part of the contract. Application contributions use stable application IDs and named slots so the owning application controls placement and ordering.

## Application instances

Each shell-level open view is an application instance. Application manifests declare an instance policy:

- `singleton`: opening any route in the application reuses its existing instance
- `multiple`: the application may create multiple independently resumable instances

Pages and resources do not automatically become shell-level views. Applications may manage them internally. Agent is a singleton application: Chat, Automations, Channels, Evaluations, conversations, runs, and inspectors remain inside one Agent instance.

Closing an application view dismisses it from the taskbar. It does not delete, archive, or otherwise mutate application data.

## Taskbar behavior

- The taskbar shows open applications with an icon, label, active state, and direct close action.
- Clicking an inactive application restores its most recently active view.
- Closing an application removes it from the taskbar without deleting application data.
- Pinning belongs to the Launcher; pinned applications remain easy to launch but do not remain in the taskbar while closed.
- Narrow taskbars keep labels useful and allow horizontal access to additional open applications instead of replacing ordinary items with an ambiguous overflow control.
- The last active valid application view is restored after restart.

## Launcher behavior

The Neon Pilot control and Command-K open the same launcher. The launcher uses one search field and ranked, labeled sections for:

- applications
- application pages
- resources such as conversations and runs
- commands and actions

Selecting a result routes through the owning application. Singleton applications reuse their existing view. Multiple-instance applications reuse an exact matching resource view when one exists and otherwise create a view.

## First-party applications

### Home

Home is a normal first-party application and the default first-launch destination. It provides a focused application picker and launcher guidance. It can be disabled. If Home is unavailable, startup restores the last valid view and otherwise opens the first pinned application.

### Agent

Agent is a first-party singleton application implemented against public extension APIs. It owns its application sidebar, including Agent destinations and conversation navigation. Initial destinations include Chat, Automations, Workflows, Routines, Gateways, and Evaluations. Conversation resources remain internal to Chat.

### System

System groups product administration and platform inspection, including Settings, Extensions, Skills, and Diagnostics. Feature extensions may contribute to named System slots rather than becoming top-level applications.

## Contribution model

The public manifest model provides:

- `applications`: top-level application definitions
- application IDs on page/navigation contributions
- application-owned named navigation slots
- ordering within a slot
- application instance policy
- default route and optional default pinning

An extension route without an explicit application owner is treated as an application supplied by that extension, so existing and third-party extension pages remain discoverable without being injected into an unrelated first-party application.

## Failure and recovery

If an application extension becomes unavailable while its view is open, the shell preserves a recoverable placeholder rather than silently redirecting or losing state. Available actions may include Re-enable, Reinstall, Diagnostics, and Dismiss depending on the failure.

Application enablement and taskbar pinning are separate states. Per-contribution visibility is intentionally deferred until the product has a concrete customization workflow for it.

## Visual contract

The taskbar is compact, neutral, and shell-owned. Applications may compose shared page, sidebar, split-pane, tab, toolbar, and inspector primitives, but should not imitate the global taskbar or launcher inside their canvas.

Application interiors follow `docs/design/neon-pilot-taste.md`: dense, flat, divider-light, technical, command-backed, and built from shared design-system primitives.

## Acceptance criteria

- The desktop opens into Home or the last valid application view without a global left sidebar.
- The taskbar shows pinned and open applications, persists state, and handles overflow.
- Neon Pilot and Command-K open one launcher that can navigate applications, pages, resources, and commands.
- Agent renders its own internal navigation and conversation list inside its canvas.
- Existing first-party pages resolve to Agent or System through explicit manifest contributions.
- Right-side contextual UI is application-owned and no global inspector toggle remains in the taskbar.
- Disabled or missing applications produce recoverable UI.
- Public extension contracts, validation, docs, and examples describe the application model.
- Focused tests, desktop builds, Electron app-path tests, and screenshot-backed visual review pass.
