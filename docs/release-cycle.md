# Release Cycle

Desktop releases are built, signed, notarized, and published locally. Pushing a tag to `main` does not automatically produce a release — release is a manual local process.

## Current release

**v0.9.3-rc.2** — release candidate being prepared.

Release page: https://github.com/patleeman/neon-pilot/releases/tag/v0.9.3-rc.2

Highlights in this train:

- Adds a dedicated Extensions use-cases page with 8 categories and richer nav link infrastructure.
- Improves Extension Manager label clarity: "Add-ons" renamed to "Installed" / "Installed Extensions".
- Fixes conversation reliability: SQL catalog sync on workspace changes, transcript boundary gating, and session meta event correctness.
- Polishes chat UX with capped tool output height, independent activity shelf mounting, and stuck-indicator fix on SSE disconnect.
- Hardens sidebar navigation with unread indicator cleanup, session cwd inclusion, and null workspaceCwd fallback.
- Includes the LM Studio extension as a first-party installable extension.
- Refreshes release dependencies, including the Pi runtime packages, for the `0.9.3-rc.2` candidate.
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

Users can choose **Settings → App behavior → Update path** to follow either stable releases only or the test path, which allows release candidates and pre-release builds. Fresh RC runtime profiles default to the test path; stable profiles default to stable releases only.

## Release Flow

Each release command performs these steps in order:

1. **Supply-chain audit** — runs `scfw audit npm` through `scripts/scfw-pnpm-npm-adapter.mjs`, which presents the pnpm lockfile as npm list JSON; blocks the release if any critical/malicious findings are reported. Requires [`scfw`](https://github.com/DataDog/supply-chain-firewall) installed via `pipx install scfw`. Bypassable with `NEON_PILOT_RELEASE_SKIP_SCFW_AUDIT=1` in emergencies.
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

Use `pnpm run release:verify-local` for release-blocking repro and iteration before rerunning `pnpm run release:publish`. It builds the full signed desktop app with Electron Builder `--publish never`, packages installable extensions, validates packaged extensions, then runs the automated release smoke, seeded startup idle smoke, and full desktop performance smoke against `dist/release/*.app`. It intentionally does not notarize, push tags, create releases, or upload assets.

## Automated Smoke Test

The release script runs an automated smoke test after signing and notarization, before pushing the tag. It launches the built `.app` with:

- An isolated temporary `NEON_PILOT_STATE_ROOT`
- A dedicated daemon socket
- No interference from an already-running user daemon

The check verifies:

1. The app process starts successfully
2. The Electron renderer exposes a page over CDP
3. The initial route renders non-empty UI without startup errors
4. Agent-readable packaged resources exist (`docs/README.md`, bundled system extension READMEs, extension skills, and manifest-declared extension bundles)
5. Packaged renderer API endpoints return successful responses for extensions, gateways, and models
6. Packaged extension backends import successfully with Electron-style `process.resourcesPath`
7. A live conversation can be created and its `bash` tool returns output
8. The Knowledge route renders
9. A conversation route renders
10. A seeded old-profile startup idle smoke passes with 2,500 synthetic historical conversations, no prebuilt conversation context DB, bounded CPU, and no local model process startup
11. The full desktop performance smoke reports usable startup readiness (`appUsableMs`, including composer and extension registry availability), draft submit click-to-visible latency, route-switch latency, conversation search latency, model fetch latency, long-transcript open latency, basic interaction timing, idle CPU, and renderer heap delta within the packaged-app gates

Optional first-party extensions are distributed separately from the app bundle. Build their release bundles with `pnpm run extension:pack:installable` and upload the generated `{extension-id}.neon-extension.zip` files to the GitHub release tag. Settings → Extensions downloads from the tag that matches the installed app version.

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
