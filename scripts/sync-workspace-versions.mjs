#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const rootPackagePath = join(repoRoot, 'package.json');
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf-8'));

if (typeof rootPackage.version !== 'string' || rootPackage.version.trim().length === 0) {
  throw new Error('Root package.json is missing a version string.');
}

const version = rootPackage.version;
const packagesDir = join(repoRoot, 'packages');
const packageNames = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(packagesDir, entry.name, 'package.json')))
  .map((entry) => entry.name)
  .sort();

const packagePaths = [rootPackagePath, ...packageNames.map((packageName) => join(packagesDir, packageName, 'package.json'))];
const workspaceVersion = `workspace:${version}`;
const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

for (const packagePath of packagePaths) {
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
  let changed = false;

  if (packagePath !== rootPackagePath && packageJson.version !== version) {
    packageJson.version = version;
    changed = true;
  }

  for (const section of dependencySections) {
    const dependencies = packageJson[section];
    if (!dependencies || typeof dependencies !== 'object') continue;

    for (const [name, range] of Object.entries(dependencies)) {
      if (!name.startsWith('@neon-pilot/') || typeof range !== 'string' || !range.startsWith('workspace:')) continue;
      if (range === workspaceVersion) continue;
      dependencies[name] = workspaceVersion;
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }
}
