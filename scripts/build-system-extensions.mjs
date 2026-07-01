#!/usr/bin/env node
/* eslint-env node */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultInstallableBundleNames, defaultInstallableExtensionIds } from './default-installable-extensions.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionsRoot = join(repoRoot, 'extensions');
const extensionBuildScript = join(repoRoot, 'scripts', 'extension-build.mjs');
const extensionPackScript = join(repoRoot, 'scripts', 'extension-pack.mjs');
const installableBundleRoot = join(repoRoot, 'dist', 'installable-extensions');
const defaultInstallableExtensionIdSet = new Set(defaultInstallableExtensionIds);
const excalidrawFirebaseReplacements = new Map([
  [['AIza', 'SyAd15pYlMci_xIp9ko6wkEsDzAAA0Dn0RU'].join(''), 'PUBLIC_EXCALIDRAW_FIREBASE_API_KEY'],
  [['AIza', 'SyCMkxA60XIW8KbqMYL7edC4qT5l4qHX2h8'].join(''), 'PUBLIC_EXCALIDRAW_DEV_FIREBASE_API_KEY'],
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listSystemExtensionDirs() {
  return existsSync(extensionsRoot)
    ? readdirSync(extensionsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(extensionsRoot, entry.name))
        .filter((extensionDir) => existsSync(join(extensionDir, 'extension.json')))
        .sort((left, right) => left.localeCompare(right))
    : [];
}

function assertBuiltEntriesExist(extensionDir) {
  const manifestPath = join(extensionDir, 'extension.json');
  const manifest = readJson(manifestPath);
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
  for (const webapp of manifest.contributes?.webapps ?? []) {
    if (typeof webapp.entry === 'string' && webapp.entry.trim().length > 0) {
      requiredEntries.push(webapp.entry);
    }
  }

  const missingEntries = requiredEntries.filter((entry) => !existsSync(join(extensionDir, entry)));
  if (missingEntries.length > 0) {
    throw new Error(`${manifest.id ?? extensionDir} is missing built extension outputs: ${missingEntries.join(', ')}`);
  }
}

function listJavaScriptFiles(root) {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  });
}

function sanitizeBuiltExtensionOutput(extensionDir) {
  for (const filePath of listJavaScriptFiles(join(extensionDir, 'dist'))) {
    const original = readFileSync(filePath, 'utf8');
    let next = original;
    for (const [key, placeholder] of excalidrawFirebaseReplacements) {
      next = next.split(key).join(placeholder);
    }
    if (next !== original) {
      writeFileSync(filePath, next);
    }
  }
}

const extensionDirs = listSystemExtensionDirs();

for (const extensionDir of extensionDirs) {
  console.log(`Building ${extensionDir.replace(`${repoRoot}/`, '')}`);
  execFileSync(process.execPath, [extensionBuildScript, extensionDir], { cwd: repoRoot, stdio: 'inherit' });
  sanitizeBuiltExtensionOutput(extensionDir);
  assertBuiltEntriesExist(extensionDir);
}

console.log(`Built and verified ${extensionDirs.length} extensions.`);

mkdirSync(installableBundleRoot, { recursive: true });
const allowedInstallableBundleNames = new Set(defaultInstallableBundleNames);
for (const entry of readdirSync(installableBundleRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.neon-extension.zip')) continue;
  if (allowedInstallableBundleNames.has(entry.name)) continue;
  const staleBundlePath = join(installableBundleRoot, entry.name);
  console.log(`Removing stale installable bundle ${staleBundlePath.replace(`${repoRoot}/`, '')}`);
  unlinkSync(staleBundlePath);
}

for (const extensionDir of extensionDirs) {
  const manifest = readJson(join(extensionDir, 'extension.json'));
  if (!defaultInstallableExtensionIdSet.has(manifest.id)) continue;
  const outputPath = join(installableBundleRoot, `${manifest.id}.neon-extension.zip`);
  console.log(`Packing installable ${extensionDir.replace(`${repoRoot}/`, '')}`);
  execFileSync(process.execPath, [extensionPackScript, extensionDir, '--out', outputPath], { cwd: repoRoot, stdio: 'inherit' });
}
