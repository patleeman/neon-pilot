# 0002 Make apps the user-facing package boundary

Status: accepted

Date: 2026-07-02

## Context

Neon Pilot has extensions, tools, routes, commands, automations, and settings. Those are useful implementation pieces, but they are not the right user-facing unit for a local app platform.

Users need to build an app and pass everything related to that app to someone else for installation.

## Decision

Treat an app as the user-facing product and package boundary.

An app package should include:

- manifest
- frontend files
- optional service files
- migrations
- assets
- declared permissions
- contribution declarations
- package metadata
- optional seed data

Extensions or modules can exist underneath apps as implementation units.

## Consequences

Apps can be installed, launched, updated, packaged, exported, and shared.

The manifest becomes the main portability contract.

Packages must exclude raw secrets and machine-local credentials.

The Builder should create apps, not loose pages or ungrouped extensions.
