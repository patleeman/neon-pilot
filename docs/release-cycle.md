# Release Cycle

Desktop releases are built, signed, notarized, and published locally. Pushing a tag to `main` does not automatically produce a release — release is a manual local process.

## Current release

**v0.9.0-rc.5** — current repo version. Publish status: prepare and verify locally before cutting artifacts.

Release page after publish: https://github.com/patleeman/neon-pilot/releases/tag/v0.9.0-rc.5

Highlights in this train:

- Completed the Neon Pilot rebrand across app copy, metadata, packaging, docs, and runtime naming.
- Refreshed desktop shell styling with new logo assets, cobalt accent defaults, accent-aware surfaces, and tighter command palette/workbench behavior.
- Improved workspace, prompt assembly, knowledge onboarding, extension, and settings layouts.
- Hardened agent tooling, extension runtime activation, browser routing, and release test inventory coverage.
- Fixed rc.1 release smoke blockers around host-backed extension imports and isolated daemon socket paths.
- Added rc.2 local model server controls, live-session bash/API fixes, model-optional release smoke, memory diagnostics, and leaner package output.
- Added rc.3 video probe, fork/rewind topology fixes, extension templates, canonical web search tooling, and release supply-chain audit coverage.
- Retagged the same release train as rc.4 after confirming `master` was already up to date with rc.3.
- Retagged the same release train as rc.5 after confirming `master` was already up to date with rc.4.
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

Versions with an `-rc` prerelease suffix are packaged as **Neon Pilot RC** instead of **Neon Pilot**. The RC app uses a separate macOS bundle identifier (`com.neon-pilot.desktop.rc`), runtime state root (`neon-pilot-rc`), and artifact prefix (`Neon-Pilot-RC-*`), so it can be installed next to the stable app without replacing it.

Stable versions keep the existing app name, bundle identifier, and `Neon-Pilot-*` artifact names. Dev/test launches disable update checks so local builds do not emit packaged updater metadata warnings.

## Release Flow

Each release command performs these steps in order:

1. **Supply-chain audit** — runs `scfw audit npm` against installed packages; blocks the release if any critical/malicious findings are reported. Requires [`scfw`](https://github.com/DataDog/supply-chain-firewall) installed via `pipx install scfw`. Bypassable with `NEON_PILOT_RELEASE_SKIP_SCFW_AUDIT=1` in emergencies.
2. **Version bump** — `pnpm version` bumps the version following semver
3. **Pi update** — refreshes the direct Pi runtime packages to the latest published version
4. **Dependency sync** — updates workspace package versions and regenerates `pnpm-lock.yaml`
5. **Changelog scaffold** — adds a dated `CHANGELOG.md` section with a release-note TODO and commit count since the previous tag
6. **Release note edit** — replace the TODO with 3-6 human-written bullets summarizing user-visible outcomes and important reliability/build changes; do not dump raw commit messages
7. **Pre-release checks** — runs `pnpm run check:release` from a clean release snapshot, including TypeScript, Settings page render tests, extension smoke tests, and packaged extension validation
8. **Build** — builds signed desktop artifacts locally
9. **Notarize** — submits the built `.app` for Apple notarization
10. **Smoke test** — launches the built app in an isolated environment and verifies basic functionality
11. **Git push** — pushes the version commit and tag to the remote
12. **GitHub release** — creates or updates the matching release in the releases repository, using the matching `CHANGELOG.md` section as the release notes

## Automated Smoke Test

The release script runs an automated smoke test after signing and notarization, before pushing the tag. It launches the built `.app` with:

- An isolated temporary `NEON_PILOT_STATE_ROOT`
- A dedicated daemon socket
- No interference from an already-running user daemon

The check verifies:

1. The app process starts successfully
2. The Electron renderer exposes a page over CDP
3. The initial route renders non-empty UI without startup errors
4. Agent-readable packaged resources exist (`docs/index.md`, system and experimental extension READMEs, extension skills, and manifest-declared extension bundles)
5. Packaged renderer API endpoints return successful responses for extensions, gateways, and models
6. Packaged extension backends import successfully with Electron-style `process.resourcesPath`
7. A live conversation can be created and its `bash` tool returns output
8. The Knowledge route renders
9. A conversation route renders

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
pnpm run release:publish
```

This runs the smoke test, push, and GitHub release creation without repeating the version bump, changelog update, and build steps. The publish step reads the matching `CHANGELOG.md` section and fails if it is missing or still contains the generated release-note TODO, so GitHub release notes stay aligned with a real summary. For non-interactive reruns of an already-tested build, set `NEON_PILOT_RELEASE_SMOKE_TESTED=1`.

## Release artifacts

Release assets must include Electron updater metadata plus signed macOS artifacts:

- `latest-mac.yml`
- signed `.zip` and `.zip.blockmap`
- optionally `.dmg` and `.dmg.blockmap`

The publish script loads Apple credentials from `NEON_PILOT_RELEASE_ENV`, then `.env`, then `~/.config/neon-pilot/release-env`. It maps `APPLE_PASSWORD` to `APPLE_APP_SPECIFIC_PASSWORD` for notarization and can target another public release repo with `NEON_PILOT_RELEASE_REPO`.

## Gotchas

- `pnpm version prerelease --preid=rc` only bumps the version and creates a git tag. It does not build or upload artifacts. Run `pnpm run release:publish` for the full signed release.
- `desktop:dist` runs `tsc --build --force` through the desktop package build chain. If pre-existing server TypeScript errors block the build, use the direct esbuild/electron-builder path:

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
