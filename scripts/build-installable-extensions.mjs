#!/usr/bin/env node
/* eslint-env node */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installableRoot = join(repoRoot, 'installable-extensions');
const outputRoot = join(repoRoot, 'dist', 'installable-extensions');
const extensionBuildScript = join(repoRoot, 'scripts', 'extension-build.mjs');
const extensionPackScript = join(repoRoot, 'scripts', 'extension-pack.mjs');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listInstallableExtensionDirs() {
  return existsSync(installableRoot)
    ? readdirSync(installableRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(installableRoot, entry.name))
        .filter((extensionDir) => existsSync(join(extensionDir, 'extension.json')))
        .sort((left, right) => left.localeCompare(right))
    : [];
}

function assertBuiltEntriesExist(extensionDir) {
  const manifest = readJson(join(extensionDir, 'extension.json'));
  const requiredEntries = [];

  if (typeof manifest.frontend?.entry === 'string' && manifest.frontend.entry.trim().length > 0) {
    requiredEntries.push(manifest.frontend.entry);
  }
  for (const styleEntry of manifest.frontend?.styles ?? []) {
    if (typeof styleEntry === 'string' && styleEntry.trim().length > 0) {
      requiredEntries.push(styleEntry);
    }
  }
  if (typeof manifest.backend?.entry === 'string' && manifest.backend.entry.trim().length > 0) {
    requiredEntries.push(manifest.backend.entry.startsWith('src/') ? 'dist/backend.mjs' : manifest.backend.entry);
  }

  const missingEntries = requiredEntries.filter((entry) => !existsSync(join(extensionDir, entry)));
  if (missingEntries.length > 0) {
    throw new Error(`${manifest.id ?? extensionDir} is missing built extension outputs: ${missingEntries.join(', ')}`);
  }
  return manifest;
}

const extensionDirs = listInstallableExtensionDirs();
mkdirSync(outputRoot, { recursive: true });

for (const extensionDir of extensionDirs) {
  console.log(`Building ${extensionDir.replace(`${repoRoot}/`, '')}`);
  execFileSync(process.execPath, [extensionBuildScript, extensionDir], { cwd: repoRoot, stdio: 'inherit' });
  const manifest = assertBuiltEntriesExist(extensionDir);
  const zipPath = join(outputRoot, `${manifest.id}.neon-extension.zip`);
  execFileSync(process.execPath, [extensionPackScript, extensionDir, '--out', zipPath], { cwd: repoRoot, stdio: 'inherit' });
}

console.log(`Built and packed ${extensionDirs.length} installable extensions.`);
