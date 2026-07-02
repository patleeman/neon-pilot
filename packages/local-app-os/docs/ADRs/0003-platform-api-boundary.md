# 0003 Route app capabilities through platform APIs

Status: accepted

Date: 2026-07-02

## Context

Electron apps can become slow or unsafe if app code talks directly to Node, Electron, SQLite, workers, or operating system services.

Local App OS needs generated apps to feel crisp. It also needs permission checks, logs, packageability, and stable app lifecycle behavior.

## Decision

Apps must use platform APIs instead of raw Electron or Node access.

The core API families are:

- apps
- windows
- storage
- files
- services
- processes
- jobs
- events
- contributions
- permissions
- network
- packages
- logs
- workspaces

IPC should be an implementation detail behind these APIs.

Heavy work should run in a backend process or worker. The renderer should remain responsive.

## Consequences

The platform can enforce permissions, lifecycle, logging, performance, and package boundaries.

The first MVP can keep the backend in memory, but the API boundary should allow the backend to move into a separate process later.

Generated apps get a simpler and safer programming model.
