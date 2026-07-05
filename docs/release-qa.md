# Release QA

Release QA is a required gate before cutting a Neon Pilot release. Automated checks catch contract regressions; hands-on QA catches broken seams in the running app.

## Required commands

Run from a clean working tree unless you are validating a focused fix before commit:

```bash
pnpm run check:release:doctor
pnpm run test:release-hardening
pnpm run qa:release
```

`qa:release` is an orchestrated checklist runner. It runs the release reliability doctor and prints the required hands-on checks that must be performed against a running app or packaged candidate.

`release:publish` requires an explicit acknowledgment before it pushes the tag or uploads GitHub release assets:

```bash
NEON_PILOT_RELEASE_QA_ACK=1 \
NEON_PILOT_RELEASE_QA_NOTES=/absolute/path/to/release-qa-notes.md \
pnpm run release:publish
```

Use `NEON_PILOT_RELEASE_QA_WAIVED=1` only for an intentional waiver, and include `NEON_PILOT_RELEASE_QA_WAIVER_REASON`.

## Hands-on smoke checklist

Record pass/fail notes, the commit SHA, and the app build used.

1. **Launch**
   - Start the current app build or packaged release candidate.
   - Confirm the main window renders, no startup error toast appears, and the sidebar populates.

2. **Conversation lifecycle**
   - Create a conversation through the canonical admin surface (`neon-pilot` externally or `neon_pilot` internally).
   - Confirm it appears in the sidebar without reload.
   - Open it and confirm an initial prompt produces visible transcript content, not an empty shell.

3. **Unified admin surface**
   - Confirm `neon-pilot` CLI works for external administration.
   - Confirm the internal agent surface exposes `neon_pilot` and does not expose duplicate Neon Pilot self-admin tools.
   - Confirm MCP is not a Neon Pilot self-admin path; `system-mcp` is only an external MCP client.

4. **Deferred resume lifecycle**
   - Schedule a short deferred resume.
   - Confirm pending UI/state appears.
   - Let it fire; confirm it is removed from pending state without reload.
   - Schedule a second deferred resume; confirm the pending state updates correctly.

5. **Extension lifecycle**
   - Disable and re-enable a safe extension.
   - Confirm nav/tools/registry state refresh without reload.
   - If testing an installable/runtime extension, uninstall it and confirm it is removed, not re-enabled.

6. **Heartbeat lifecycle**
   - Start a heartbeat with `neon-pilot heartbeats start` or `neon_pilot heartbeat_start`.
   - Confirm `heartbeats list` shows it.
   - Stop it and confirm it is disabled/absent as expected.
   - Confirm skip/coalesce policy is configured for recurring conversation callbacks.

7. **Extension registry and routes**
   - Open Extensions.
   - Confirm installed extensions render without diagnostics.
   - Open release-critical routes such as Knowledge, Automations, Settings, and any route changed in this release.

## Release rule

Do not cut a release until:

- automated release checks pass,
- this checklist is completed or explicitly waived with reasons,
- any release blockers are fixed and validated,
- the final status includes commit SHA, commands run, and hands-on QA notes.
