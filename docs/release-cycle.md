# Release Cycle

Desktop releases are built, signed, notarized, and published locally. Pushing a tag to `main` does not automatically produce a release — release is a manual local process.

## Current release

**v0.11.23** — stable release.

Release page: https://github.com/patleeman/neon-pilot/releases/tag/v0.11.23

Highlights in this train:

- Recovers cleanly when a conversation starts after the extension host has exited while the local backend is still alive, restarting the runtime instead of surfacing raw `fetch failed` errors.
- Improves extension-host RPC failure reporting so transport failures include the request and endpoint context needed to diagnose stale runtime state.
- Adds regression coverage for stale backend/extension-host process combinations and extension-host fetch failures.
- Confirms the release with a broad hands-on app QA pass across chat, tool execution, settings, extensions, automations, telemetry, notifications, attachments, workbench tabs, terminal, browser, scratchpad, and recovery states.
- Refreshes Pi runtime packages to `^0.79.8` for the stable 0.11.23 patch train.
- Keep this section aligned with `package.json`, `CHANGELOG.md`, and the tag being prepared.

## RC release operating instructions

RC releases are long, stateful, and easy to half-finish. Run them from a conversation with **goal mode enabled** and keep the goal active until artifacts are published, the GitHub release is verified, and the release notes/current-release section are aligned.

When publishing an RC, run the publish command in the foreground:

```bash
pnpm run release:publish
```

Do **not** start the RC publish as a background run. The script can require interactive attention for smoke-test prompts, signing/notarization failures, release-note validation, and GitHub publish errors; foreground output is the source of truth for deciding the next step.

## Release Commands

```bash
# Build and smoke test the full packaged app without notarizing, pushing, or uploading.
pnpm run release:verify-local

# Patch release (0.5.35 -> 0.5.36)
pnpm run release:desktop:patch

# Minor release (0.5.35 -> 0.6.0)
pnpm run release:desktop:minor

# Major release (0.5.35 -> 1.0.0)
pnpm run release:desktop:major
```

## Runtime channels

Runtime identity is centralized as `stable`, `rc`, `dev`, or `test`. The channel owns app presentation, state-root suffixes, ports, and updater support.

| Channel  | App name           | State root suffix | Updates  |
| -------- | ------------------ | ----------------- | -------- |
| `stable` | Neon Pilot         | none              | enabled  |
| `rc`     | Neon Pilot RC      | `-rc`             | enabled  |
| `dev`    | Neon Pilot Dev     | `-dev`            | disabled |
| `test`   | Neon Pilot Testing | `-testing`        | disabled |

Versions with an `-rc` prerelease suffix are packaged as **Neon Pilot RC** instead of **Neon Pilot**. The RC app uses a separate macOS bundle identifier (`com.neon-pilot.desktop.rc`), runtime state root (`neon-pilot-rc`), and artifact prefix (`Neon-Pilot-RC-*`), so it can be installed next to the stable app without replacing it. RC update checks are enabled for the RC runtime channel and stay isolated from stable by channel-specific app identity and artifact names. Installed RC apps keep the RC runtime channel by bundle/app identity even after consuming a stable-semver build, so the RC app can continue following the RC update path.

Stable versions keep the existing app name, bundle identifier, and `Neon-Pilot-*` artifact names. Dev/test launches disable update checks so local builds do not consume updater metadata.

The CLI surface is shared by name across channels: the command users and agents run is `neon-pilot`. Channel-local app shells prepend their managed `neon-pilot` launcher first, and global shell installation remains user-controlled through `neon-pilot cli install`.

Users can choose **Settings → App behavior → Update path** to follow either stable releases only or the test path, which allows release candidates and pre-release builds. Fresh RC runtime profiles default to the test path; stable profiles default to stable releases only.

## Release Flow

The release commands intentionally split versioning from publish and local verification:

- `pnpm run release:desktop:patch|minor|major` runs the semver bump first, then runs the publish flow.
- `pnpm run release:publish` publishes the already-current version/tag. Use this after a prepared version commit or when retrying a failed publish.
- `pnpm run release:verify-local` builds and smokes a local packaged app without notarizing, pushing, creating a GitHub release, or uploading artifacts.

The version bump path performs:

1. **Version bump** — `pnpm version` bumps the version following semver
2. **Pi update** — refreshes the direct Pi runtime packages to the latest published version
3. **Dependency sync** — updates workspace package versions and regenerates `pnpm-lock.yaml`
4. **Changelog scaffold** — adds a dated `CHANGELOG.md` section with a release-note TODO and commit count since the previous tag
5. **Release note edit** — replace the TODO with 3-6 human-written bullets summarizing user-visible outcomes and important reliability/build changes; do not dump raw commit messages

The publish path performs:

1. **Supply-chain audit** — runs `scfw audit npm` through `scripts/scfw-pnpm-npm-adapter.mjs`, which presents the pnpm lockfile as npm list JSON; blocks the release if any critical/malicious findings are reported. Requires [`scfw`](https://github.com/DataDog/supply-chain-firewall) installed via `pipx install scfw`. Bypassable with `NEON_PILOT_RELEASE_SKIP_SCFW_AUDIT=1` in emergencies.
2. **Pre-release checks** — runs `pnpm run check:release` from a clean release snapshot: TypeScript build, system extension build/packaging checks, the full Vitest suite, extension static boundary checks, and the release reliability doctor
3. **Release QA** — run `pnpm run qa:release` and complete the hands-on checklist in `docs/release-qa.md` against the app build or packaged release candidate; record commit SHA, build, and pass/fail notes before continuing. `release:publish` requires `NEON_PILOT_RELEASE_QA_ACK=1` plus `NEON_PILOT_RELEASE_QA_NOTES=/path/to/notes.md`, or an explicit `NEON_PILOT_RELEASE_QA_WAIVED=1` with `NEON_PILOT_RELEASE_QA_WAIVER_REASON`, before any tag push or GitHub asset upload.
4. **First-party extension release gate** — before any desktop tag push or GitHub asset upload, `release:publish` checks the matching tag in `patleeman/neon-pilot-extensions` for `neon-extension-catalog.json` plus one `<extension-id>.neon-extension.zip` asset for every generated installable catalog entry. Override the repo with `NEON_PILOT_FIRST_PARTY_EXTENSIONS_RELEASE_REPO`; waive only with `NEON_PILOT_FIRST_PARTY_EXTENSIONS_RELEASE_WAIVED=1` and `NEON_PILOT_FIRST_PARTY_EXTENSIONS_RELEASE_WAIVER_REASON`.
5. **Build** — builds signed desktop artifacts locally
6. **Extension golden smoke** — launches the packaged app in isolated state, verifies the release-critical extension matrix, opens extension routes, and invokes representative extension backend actions
7. **Notarize** — submits the built `.app` for Apple notarization
8. **Smoke test** — launches the built app in an isolated environment and verifies basic functionality
9. **Git push** — pushes the version commit and tag to the remote
10. **GitHub release** — creates or updates the matching release in the releases repository, using the matching `CHANGELOG.md` section as the release notes

Use `pnpm run release:verify-local` for release-blocking repro and iteration before rerunning `pnpm run release:publish`. It builds the full signed desktop app with Electron Builder `--publish never`, packages installable extensions, validates packaged extensions, then runs the extension golden smoke, automated release smoke, seeded startup idle smoke, and full desktop performance smoke against `dist/release/*.app`. It intentionally does not notarize, push tags, create releases, or upload assets.

## Automated Smoke Test

The release script runs automated smoke tests after signing and notarization, before pushing the tag. The extension golden smoke launches the built `.app` with fresh-machine roots:

- An isolated temporary `NEON_PILOT_STATE_ROOT`
- An isolated temporary `NEON_PILOT_CONFIG_ROOT`
- An isolated temporary `NEON_PILOT_KNOWLEDGE_ROOT`
- Isolated HOME and XDG cache/config/data/state roots
- A dedicated daemon socket
- No interference from an already-running user daemon

The check verifies:

1. The app process starts successfully
2. The Electron renderer exposes a page over CDP
3. The initial route renders non-empty UI without startup errors
4. Agent-readable packaged resources exist (`docs/README.md`, bundled system extension READMEs, extension skills, and manifest-declared extension bundles)
5. Packaged renderer API endpoints return successful responses for extensions, gateways, and models
6. Packaged extension backends import successfully with Electron-style `process.resourcesPath`
7. The extension golden matrix in `scripts/release-extension-golden-matrix.json` passes against the packaged app: required extensions are enabled, release-critical extension routes render, representative backend actions execute through the real extension host route, expected agent tools appear in `/api/tools`, and safe action-backed tools invoke successfully
8. A live conversation can be created and its `bash` tool returns output
9. The Knowledge route renders
10. A conversation route renders
11. A seeded old-profile startup idle smoke passes with 2,500 synthetic historical conversations, no prebuilt conversation context DB, bounded CPU, and no local model process startup
12. The full desktop performance smoke reports usable startup readiness (`appUsableMs`, including composer and extension registry availability), draft submit click-to-visible latency, route-switch latency, conversation search latency, model fetch latency, long-transcript open latency, basic interaction timing, idle CPU, and renderer heap delta within the packaged-app gates

### Extension golden matrix

Release-critical extension behavior is owned by `scripts/release-extension-golden-matrix.json` and executed by:

```bash
pnpm run smoke:release-extensions -- --app="/Applications/Neon Pilot RC.app"
```

Use this matrix for workflows that have repeatedly caused post-release breakage or are part of the expected packaged app experience. A golden case should use the same path the user relies on: installed extension registry state, real nav route rendering, backend actions invoked through `/api/extensions/:id/actions/:actionId`, and agent tool visibility through `/api/tools`. Prefer a small number of high-signal workflows over exhaustive component coverage.

Agent tools should be tested in layers:

- **Inventory**: add the tool name to `agentTools.expectedNames` so `/api/tools` proves the packaged agent runtime can see and inject it.
- **Safe invocation**: add an `agentTools.invocations` case when the action can run without live model calls, network dependency, or user interaction.
- **Context-dependent tools**: keep them in inventory coverage, and add a conversation-backed smoke when correctness depends on `toolContext` fields such as `conversationId`, `cwd`, session state, streaming updates, or transcript rendering. Do not fake those through direct action calls.

For optional first-party extensions distributed from `patleeman/neon-pilot-extensions`, add their release zips to `installablePackages` or their catalog ids to `catalogInstalls` before promoting an RC to stable. The gate then proves the candidate app can install/load those artifacts instead of only proving the source tree builds.

Optional first-party extensions are distributed separately from the app bundle from [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions). Build their release bundles with the extension builder/packer, publish `.neon-extension.zip` artifacts to GitHub releases, and keep their `extension.json` compatibility ranges aligned with supported Neon Pilot versions.

### First-party extension release

Every stable Neon Pilot release must have a matching release in [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions). Publish **all indexed first-party extension packages every time**, not only extensions that changed. The desktop app looks for `neon-extension-catalog.json` at the app tag first; if it is missing, the Extension Manager can only fall back to the baked catalog and must mark stale artifacts unavailable.

After the app release tag exists, publish the extension repo release with the same tag:

```bash
cd ../neon-pilot-extensions
git status --short
pnpm run release:prepare -- --tag vX.Y.Z
gh release create vX.Y.Z \
  release-artifacts/vX.Y.Z/*.neon-extension.zip \
  release-artifacts/vX.Y.Z/neon-extension-catalog.json \
  --repo patleeman/neon-pilot-extensions
```

If the GitHub release already exists, upload replacement assets explicitly:

```bash
gh release upload vX.Y.Z \
  release-artifacts/vX.Y.Z/*.neon-extension.zip \
  release-artifacts/vX.Y.Z/neon-extension-catalog.json \
  --repo patleeman/neon-pilot-extensions \
  --clobber
```

Before publishing, verify each released package manifest has a `compatibility.neonPilot` range that includes the app version being released. After publishing, verify the GitHub release has `neon-extension-catalog.json` plus one `.neon-extension.zip` asset for every indexed package, and verify these URLs return `200`:

```bash
https://github.com/patleeman/neon-pilot-extensions/releases/download/vX.Y.Z/neon-extension-catalog.json
https://github.com/patleeman/neon-pilot-extensions/releases/download/vX.Y.Z/system-writing-studio.neon-extension.zip
```

`pnpm run build` also verifies the current daemon output under `packages/desktop/dist/server/daemon/` and rebuilds system extension backends with the same backend API alias used by the runtime loader. If a tool extension fails with missing `@neon-pilot/extensions/backend` exports, rerun the full build before cutting the release.

### Manual smoke test

If the automated check is unavailable, set:

```bash
NEON_PILOT_RELEASE_SKIP_AUTOMATED_SMOKE=1
```

The script will stop and ask you to manually test the built `.app` before continuing.

## Retrying Publish

If the version bump and build succeeded but the publish step failed:

```bash
pnpm run release:verify-local
pnpm run release:publish
```

First reproduce and fix release-blocking issues with the local packaged build. Once `release:verify-local` passes, rerun `release:publish` for the clean-snapshot release gate, notarization, push, and GitHub release creation. The publish step reads the matching `CHANGELOG.md` section and fails if it is missing or still contains the generated release-note TODO, so GitHub release notes stay aligned with a real summary. For non-interactive reruns of an already-tested build, set `NEON_PILOT_RELEASE_SMOKE_TESTED=1`.

## Release artifacts

Release assets must include Electron updater metadata plus signed macOS artifacts:

- `latest-mac.yml`
- signed `.zip` and `.zip.blockmap`
- optionally `.dmg` and `.dmg.blockmap`

The publish script loads Apple credentials from `NEON_PILOT_RELEASE_ENV`, then `.env`, then `~/.config/neon-pilot/release-env`. It maps `APPLE_PASSWORD` to `APPLE_APP_SPECIFIC_PASSWORD` for notarization and can target another public release repo with `NEON_PILOT_RELEASE_REPO`.

## Gotchas

- `pnpm version prerelease --preid=rc` only bumps the version and creates a git tag. It does not build or upload artifacts. Run `pnpm run release:publish` for the full signed release.
- `desktop:dist` runs the desktop package `clean`, `build:deps`, and `build:main` scripts before Electron Builder. It does not run the full workspace TypeScript build. If you need full TypeScript validation, run `pnpm run build:ts` or `pnpm run desktop:build` first. If pre-existing server TypeScript errors block the full desktop build but you need a local package for investigation, use the direct esbuild/electron-builder path:

  ```bash
  cd packages/desktop
  pnpm run build:deps
  node scripts/build-main.mjs
  npx electron-builder --config electron-builder.config.mjs --publish never
  ```

## Prerequisites

- **Apple Developer account** — for signing and notarization
- **GitHub access** — to push tags and create releases
- **Notarization credentials** — configured in the build environment
- **GitHub release repository** — configured for artifact uploads
