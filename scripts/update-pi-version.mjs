#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PI_PACKAGE_NAMES = ['@earendil-works/pi-coding-agent', '@earendil-works/pi-agent-core', '@earendil-works/pi-ai'];

export function resolvePiDependencyRange(version) {
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('Pi version must be a non-empty string.');
  }

  return version.trim();
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

export function applyLatestPiPatchVersion(workspaceYaml, latestVersion) {
  if (typeof workspaceYaml !== 'string' || workspaceYaml.length === 0) {
    throw new Error('pnpm-workspace.yaml must be a non-empty string.');
  }

  const version = latestVersion?.trim();
  if (!version) {
    throw new Error('Pi version must be a non-empty string.');
  }

  const patchEntryPattern = /'@earendil-works\/pi-ai@([^']+)': patches\/@earendil-works__pi-ai@([^\s]+)\.patch/;
  const match = workspaceYaml.match(patchEntryPattern);
  if (!match) {
    throw new Error('pnpm-workspace.yaml is missing the versioned Pi AI patch registration.');
  }

  const [, dependencyVersion, fileVersion] = match;
  if (dependencyVersion !== fileVersion) {
    throw new Error(`Pi AI patch registration is inconsistent: dependency ${dependencyVersion}, file ${fileVersion}.`);
  }

  if (dependencyVersion === version) {
    return { changed: false, workspaceYaml, previousVersion: dependencyVersion, nextVersion: version };
  }

  return {
    changed: true,
    workspaceYaml: workspaceYaml.replace(
      patchEntryPattern,
      `'@earendil-works/pi-ai@${version}': patches/@earendil-works__pi-ai@${version}.patch`,
    ),
    previousVersion: dependencyVersion,
    nextVersion: version,
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

export function updatePiVersionForRelease(rootPackagePath, latestVersion = fetchLatestPiVersion()) {
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf-8'));
  const result = applyLatestPiVersion(rootPackage, latestVersion);

  if (!result.changed) {
    console.log(`Pi already up to date at ${result.nextRange}.`);
    return result;
  }

  writeFileSync(rootPackagePath, `${JSON.stringify(result.packageJson, null, 2)}\n`);
  console.log(`Updated Pi to ${result.nextRange}.`);
  return result;
}

export function updatePiPatchForRelease(repoRoot, latestVersion) {
  const workspacePath = resolve(repoRoot, 'pnpm-workspace.yaml');
  const result = applyLatestPiPatchVersion(readFileSync(workspacePath, 'utf-8'), latestVersion);
  if (!result.changed) {
    console.log(`Pi AI patch already registered for ${result.nextVersion}.`);
    return result;
  }

  const previousPatchPath = resolve(repoRoot, 'patches', `@earendil-works__pi-ai@${result.previousVersion}.patch`);
  const nextPatchPath = resolve(repoRoot, 'patches', `@earendil-works__pi-ai@${result.nextVersion}.patch`);
  if (!existsSync(previousPatchPath)) {
    throw new Error(`Registered Pi AI patch does not exist: ${previousPatchPath}`);
  }
  if (existsSync(nextPatchPath)) {
    throw new Error(`Refusing to overwrite existing Pi AI patch: ${nextPatchPath}`);
  }

  renameSync(previousPatchPath, nextPatchPath);
  writeFileSync(workspacePath, result.workspaceYaml);
  console.log(`Updated Pi AI patch registration to ${result.nextVersion}.`);
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
  const latestVersion = fetchLatestPiVersion();
  const packagePaths = [
    resolve(repoRoot, 'package.json'),
    resolve(repoRoot, 'packages', 'desktop', 'package.json'),
    resolve(repoRoot, 'extensions', 'system-model-gateway', 'package.json'),
  ];
  for (const packagePath of packagePaths) {
    updatePiVersionForRelease(packagePath, latestVersion);
  }
  updatePiPatchForRelease(repoRoot, latestVersion);
}
