# 0004 Use a built-in database plus virtual files

Status: accepted

Date: 2026-07-02

## Context

Apps need to store structured data, files, settings, logs, package metadata, and runtime state.

A built-in database can make app data portable, queryable, transactional, and easier to package.

Files are still a useful abstraction for app source, assets, generated content, imports, and exports.

## Decision

Use a built-in database as the first persistence backend. SQLite is the preferred first implementation.

Expose storage and files as separate platform APIs:

- storage is for structured app data
- files are for virtual file paths and file-like content

Apps should use a private virtual filesystem by default. Real filesystem access should require explicit permission.

## Consequences

The platform can package app data and app files together more easily.

Apps do not need direct access to arbitrary local paths.

The first MVP can use an in-memory backend while keeping the API shape ready for SQLite.
