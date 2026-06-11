# Extension Distribution

Neon Pilot extensions are distributed as prebuilt Neon packages, not npm packages. GitHub repositories and releases are the v1 distribution layer.

## Distribution model

There are four extension lanes:

- **Bundled system extensions** live in the Neon Pilot app repo under `extensions/` and ship inside the desktop app.
- **First-party optional extensions** live in the separate [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions) repo and install from GitHub release artifacts.
- **User/local extensions** live in runtime state under `<state-root>/extensions/{extension-id}` or in explicit development paths.
- **Third-party extension repos** are GitHub repos with a Neon source manifest and one or more extension packages.

Core owns the extension host, SDK, permissions, app shell integration, install/update plumbing, and validation. Product workflows should still be extensions; distribution no longer depends on keeping optional extension source inside the app repo.

## GitHub extension repositories

An extension repository must include a root `neon.extensions.json` file. Repos may hold one extension or many.

```json
{
  "schemaVersion": 1,
  "publisher": {
    "id": "example",
    "name": "Example Publisher",
    "url": "https://github.com/example"
  },
  "repository": {
    "type": "github",
    "owner": "example",
    "repo": "example-neon-extensions"
  },
  "packages": [
    {
      "id": "example-search",
      "path": "extensions/example-search",
      "channel": "stable"
    }
  ]
}
```

The app can inspect this file, show the packages in the repo, and let the user choose which extensions to install.

## Extension package format

The installable artifact is a `.neon-extension.zip`. It contains exactly one top-level extension directory:

```text
example-search/
  extension.json
  README.md
  LICENSE
  dist/
    frontend.js
    backend.mjs
  assets/
```

Package rules:

- Build before packing.
- Include `extension.json`.
- Include prebuilt `dist/` entries for all frontend and backend manifest entries.
- Do not include `node_modules`, `.dist.tmp-*`, local caches, or sidecar build output such as `sidecar/target`.
- Do not require install-time compilation, npm install, or postinstall scripts.
- Use only the public extension SDK imports supplied by the host.

Neon Pilot validates required runtime artifacts before import and again before enabling a backend extension. Invalid or partially removed runtime extensions must remain uninstallable; uninstall clears registry, quarantine, and failure state even when the package directory is already gone.

## Compatibility

Every distributed extension should declare the Neon Pilot and extension API versions it targets:

```json
{
  "schemaVersion": 2,
  "id": "example-search",
  "name": "Example Search",
  "version": "0.1.0",
  "compatibility": {
    "neonPilot": ">=0.10.0 <0.11.0",
    "extensionApi": "^2"
  }
}
```

Neon Pilot treats compatibility as an install-time warning, not a hard refusal. Compatibility belongs in the package manifest so a zip, local folder, catalog item, or GitHub release can explain the version range it was tested against, while package validation still enforces concrete runtime requirements such as safe paths, valid manifests, and built artifacts.

## Release artifacts

Normal installs should use immutable GitHub release artifacts, not branch source. A release may include:

- `<extension-id>-<version>.neon-extension.zip` or `<extension-id>.neon-extension.zip`
- `neon-extension-catalog.json`

The optional release catalog can include package versions, artifact URLs, SHA-256 checksums, compatibility, permissions, and display metadata:

```json
{
  "schemaVersion": 1,
  "source": {
    "type": "github",
    "owner": "example",
    "repo": "example-neon-extensions"
  },
  "packages": [
    {
      "id": "example-search",
      "version": "0.1.0",
      "artifact": "example-search-0.1.0.neon-extension.zip",
      "sha256": "..."
    }
  ]
}
```

Source-branch installs are development mode only. They require local build trust and should be visually distinguished from release artifact installs.

## Publishing your own extension repo

1. Create a GitHub repo.
2. Add one extension directory or several extension directories.
3. Add root `neon.extensions.json`.
4. Build each extension with `pnpm run extension:build -- <extension-dir>` from a Neon Pilot checkout.
5. Validate with `neon-pilot-extension doctor <extension-dir>`.
6. Pack with `neon-pilot-extension pack <extension-dir> --out <extension-id>.neon-extension.zip`.
7. Publish a GitHub release containing the zip artifacts.
8. Share the GitHub repo URL with users.

Users install from the GitHub repo URL, inspect the packages it exposes, select the packages they want, review permissions and compatibility, then install the release artifacts.

Repository-distributed extensions should declare `"packageType": "user"` in `extension.json`, even when the extension is first-party or has a `system-*` id. `"system"` is reserved for extensions bundled inside the Neon Pilot app repo; runtime-installed packages need the normal user-extension lifecycle so they can be disabled, uninstalled, reinstalled, and updated from the catalog.

Use [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions) as the reference repository. It includes repo-local scripts that resolve a Neon Pilot checkout from `NEON_PILOT_REPO` or a sibling `../neon-pilot` checkout:

```bash
pnpm run list
pnpm run build -- --extension example-search
pnpm run pack -- --extension example-search --out-dir /tmp/neon-extension-artifacts
pnpm run release:prepare -- --tag v0.9.1-rc.6
```

`release:prepare` builds all indexed packages, writes `<extension-id>.neon-extension.zip` assets, and writes `neon-extension-catalog.json` with checksums. Publish those files with GitHub CLI:

```bash
gh release create v0.9.1-rc.6 \
  release-artifacts/v0.9.1-rc.6/*.neon-extension.zip \
  release-artifacts/v0.9.1-rc.6/neon-extension-catalog.json \
  --repo example/example-neon-extensions
```

The current installer expects the release asset name `<extension-id>.neon-extension.zip` on the package tag. Declare both `version` and `tag` in `neon.extensions.json` when possible. Neon Pilot uses the explicit package `version` to detect updates and the explicit `tag` to resolve the release asset. If a package omits those fields, the app can still install it by falling back to the installed app version tag, but it cannot reliably detect package updates.

## User-configured sources

Users can add GitHub extension repositories from **Settings -> Extensions -> Extension repositories**. The install dialog also exposes the same repository control beside the installable package list. The app stores sources in the runtime settings file under `extensions.sources`:

```json
{
  "extensions.sources": [
    {
      "id": "example-extensions",
      "type": "github",
      "owner": "example",
      "repo": "example-neon-extensions",
      "enabled": true
    }
  ]
}
```

The first-party `patleeman/neon-pilot-extensions` repo is always present as the built-in source. Additional enabled sources are fetched from `neon.extensions.json` on `main` or `master`, then merged into the installable extension list.

The Extension Manager refreshes the installable catalog when opened, when the window regains focus, after extension registry changes, and periodically while the manager is open. Installed catalog extensions with a newer explicit package version appear in the Attention filter and expose an Update action that reinstalls the release artifact while preserving the enabled state.

Use the existing settings file for source configuration. A dedicated persistence table is only warranted once Neon Pilot tracks mutable source state such as refresh timestamps, trust decisions, signature validation, update history, or repeated fetch failures.
