# 0001 Treat the product as a local desktop operating environment

Status: accepted

Date: 2026-07-02

## Context

The original Neon Pilot shell made many capabilities feel like pages in an agent chat app.

The stronger product idea is local-first app creation. A user should open one desktop app, build custom apps with an agent, install them into the same environment, and keep using them like real software.

## Decision

Build Local App OS as a desktop operating environment inside Electron.

The shell should have:

- a top bar
- a desktop canvas
- a dock
- internal app windows
- global commands
- system apps

The Builder app is one app inside the environment. It is not the whole product.

## Consequences

Local App OS can feel like a real app platform instead of a chat wrapper.

The shell must own window management, app lifecycle, app launch, app focus, and system-level state.

This increases platform complexity, but it gives the product a clearer identity.
