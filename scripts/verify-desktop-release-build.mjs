#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const releaseDir = resolve(repoRoot, 'dist', 'release');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    stdio: 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function collectPackagedAppPath() {
  if (!existsSync(releaseDir)) {
    return null;
  }

  const entries = readdirSync(releaseDir, { withFileTypes: true });
  const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
  if (app) {
    return resolve(releaseDir, app.name);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const nestedDir = resolve(releaseDir, entry.name);
    const nestedApp = readdirSync(nestedDir, { withFileTypes: true }).find(
      (nestedEntry) => nestedEntry.isDirectory() && nestedEntry.name.endsWith('.app'),
    );
    if (nestedApp) {
      return resolve(nestedDir, nestedApp.name);
    }
  }

  return null;
}

rmSync(releaseDir, { recursive: true, force: true });

console.log('Running release checks before local packaged build...');
run('pnpm', ['run', 'check:release']);

console.log('Building signed desktop artifacts locally without publishing...');
run('pnpm', ['run', 'desktop:dist']);

console.log('Packing installable extensions locally...');
run('pnpm', ['run', 'extension:pack:installable']);

const appPath = collectPackagedAppPath();
if (!appPath) {
  fail(`Packaged desktop app not found under ${releaseDir}.`);
}

console.log('Validating packaged extensions against the built app...');
run('node', ['scripts/check-packaged-extensions.mjs', appPath]);

console.log('Running automated release smoke test against the built app...');
run('node', ['scripts/smoke-desktop-release.mjs', appPath]);

console.log('Running seeded-profile startup idle smoke test against the built app...');
run('node', ['scripts/smoke-startup-idle.mjs', `--app=${appPath}`, '--seconds=30', '--sessions=2500', '--blocks=80', '--max-cpu=130']);

console.log('Running full desktop performance smoke test against the built app...');
run('node', [
  'scripts/perf-desktop-smoke.mjs',
  `--app=${appPath}`,
  '--seconds=30',
  '--sessions=2500',
  '--blocks=80',
  '--max-ready-ms=15000',
  '--max-cpu=130',
  '--max-draft-submit-visible-ms=15000',
  '--max-long-transcript-open-ms=10000',
]);

console.log(`Local release verification passed for ${appPath}.`);
