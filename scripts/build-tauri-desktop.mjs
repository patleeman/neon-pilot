#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tauriPackageDir = resolve(repoRoot, 'packages', 'tauri', 'desktop-shell');
const workspaceBundleRoot = resolve(repoRoot, 'target', 'release', 'bundle');
const packageBundleRoot = resolve(tauriPackageDir, 'src-tauri', 'target', 'release', 'bundle');
const releaseDir = resolve(repoRoot, 'dist', 'release');

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function copyBundleArtifacts() {
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });

  const bundleRoot = existsSync(workspaceBundleRoot) ? workspaceBundleRoot : packageBundleRoot;
  const macosDir = resolve(bundleRoot, 'macos');
  if (existsSync(macosDir)) {
    const macOutputDir = resolve(releaseDir, 'mac-arm64');
    mkdirSync(macOutputDir, { recursive: true });
    for (const name of readdirSync(macosDir)) {
      if (name.endsWith('.app')) {
        cpSync(resolve(macosDir, name), resolve(macOutputDir, name), { recursive: true });
      }
    }
  }

  const dmgDir = resolve(bundleRoot, 'dmg');
  if (existsSync(dmgDir)) {
    for (const name of readdirSync(dmgDir)) {
      if (name.endsWith('.dmg')) {
        cpSync(resolve(dmgDir, name), resolve(releaseDir, name));
      }
    }
  }
}

run('node', ['scripts/prepare-tauri-resources.mjs']);
run('pnpm', ['--dir', 'packages/tauri/desktop-shell', 'run', 'build']);
copyBundleArtifacts();
