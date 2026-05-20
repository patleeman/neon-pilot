# Contributing

For contributors building from source:

```bash
pnpm install
pnpm run setup:hooks   # optional: enable the tracked pre-commit hook
pnpm run build
pnpm test
pnpm run lint
```

This repo intentionally has no first-party `postinstall`. Third-party build scripts are allowlisted in `pnpm-workspace.yaml`; review anything newly blocked with `pnpm ignored-builds`. ESLint is configured for actionable errors; dynamic extension/API boundary code may use `any` where stricter typing would add noise.

Useful dev commands:

```bash
pnpm run desktop:start      # launch the Electron app
pnpm run desktop:dev        # same dev launcher

# Extension integration validation (run before starting the app)
pnpm run check:extensions        # full suite (~30s, includes module runtime checks)
pnpm run check:extensions:quick  # quick check (~5s, skips slow dynamic import)
```

Platform prerequisites:

- **macOS arm64** (the desktop app targets macOS; no Windows or Linux build)
- **Node.js 20+** and **pnpm 11+** recommended
- **Python 3 + pipx** — required for the release supply-chain audit (see below)

### Supply-Chain Firewall

The release script runs [`scfw`](https://github.com/DataDog/supply-chain-firewall) to audit installed npm packages for known-malicious or advisory-flagged packages before any artifacts are signed or published. Install it once:

```bash
pipx install scfw
pipx ensurepath   # adds pipx bin dir to PATH if not already there
```

To verify: `scfw --version`. If the binary is missing at release time the script will fail with install instructions. To bypass in exceptional cases: `NEON_PILOT_RELEASE_SKIP_SCFW_AUDIT=1 pnpm run release:publish` (not recommended).

Set `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip code signing for local Electron builds.

See [CONTRIBUTING.md](CONTRIBUTING.md) for PR policy and issue guidelines.

---

## Release flow

Desktop releases are built, signed, notarized, and published to GitHub Releases locally.

```bash
pnpm run release:desktop:patch
pnpm run release:desktop:minor
pnpm run release:desktop:major
```

See [`docs/release-cycle.md`](docs/release-cycle.md) for the full details.
