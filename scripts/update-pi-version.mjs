#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PI_PACKAGE_NAMES = ['@earendil-works/pi-coding-agent', '@earendil-works/pi-agent-core', '@earendil-works/pi-ai'];

export function resolvePiDependencyRange(version) {
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('Pi version must be a non-empty string.');
  }

  return `^${version.trim()}`;
}

export function applyLatestPiVersion(rootPackage, latestVersion) {
  if (!rootPackage || typeof rootPackage !== 'object') {
    throw new Error('Root package.json must parse to an object.');
  }

  if (!rootPackage.dependencies || typeof rootPackage.dependencies !== 'object') {
    throw new Error('Root package.json is missing a dependencies object.');
  }

  const nextRange = resolvePiDependencyRange(latestVersion);
  const packageJson = structuredClone(rootPackage);
  const changedPackages = [];
  for (const packageName of PI_PACKAGE_NAMES) {
    if (typeof packageJson.dependencies?.[packageName] === 'string' && packageJson.dependencies[packageName] !== nextRange) {
      packageJson.dependencies[packageName] = nextRange;
      changedPackages.push(packageName);
    }
  }

  if (changedPackages.length === 0) {
    return {
      changed: false,
      packageJson: rootPackage,
      nextRange,
    };
  }

  return {
    changed: true,
    packageJson,
    nextRange,
  };
}

export function fetchLatestPiVersion() {
  const [primaryPackageName] = PI_PACKAGE_NAMES;
  const stdout = execFileSync('npm', ['view', primaryPackageName, 'version', '--json'], { encoding: 'utf-8' }).trim();

  const parsed = JSON.parse(stdout);
  if (typeof parsed !== 'string' || parsed.trim().length === 0) {
    throw new Error(`npm view returned an invalid version for ${primaryPackageName}.`);
  }

  return parsed.trim();
}

export function updatePiVersionForRelease(rootPackagePath) {
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf-8'));
  const latestVersion = fetchLatestPiVersion();
  const result = applyLatestPiVersion(rootPackage, latestVersion);

  if (!result.changed) {
    console.log(`Pi already up to date at ${result.nextRange}.`);
    return result;
  }

  writeFileSync(rootPackagePath, `${JSON.stringify(result.packageJson, null, 2)}\n`);
  console.log(`Updated Pi to ${result.nextRange}.`);
  return result;
}

function isDirectExecution() {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(resolve(entrypoint)).href;
}

if (isDirectExecution()) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const packagePaths = [resolve(repoRoot, 'package.json'), resolve(repoRoot, 'packages', 'desktop', 'package.json')];
  for (const packagePath of packagePaths) {
    updatePiVersionForRelease(packagePath);
  }
}
