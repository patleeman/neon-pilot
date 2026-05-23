#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function renderVersion() {
  process.stdout.write('11.0.0\n');
}

function stripPeerSuffix(version) {
  const index = version.indexOf('(');
  return index === -1 ? version : version.slice(0, index);
}

function parsePackageKey(key) {
  const normalized = key.replace(/^\//u, '');
  const separator = normalized.startsWith('@') ? normalized.indexOf('@', 1) : normalized.indexOf('@');
  if (separator <= 0) return null;
  return {
    name: normalized.slice(0, separator),
    version: stripPeerSuffix(normalized.slice(separator + 1)),
  };
}

async function renderInstalledTree() {
  const lockfile = YAML.parse(readFileSync(resolve(repoRoot, 'pnpm-lock.yaml'), 'utf8'));
  const dependencies = {};

  for (const key of Object.keys(lockfile.packages ?? {})) {
    const parsed = parsePackageKey(key);
    if (!parsed || parsed.version.startsWith('link:')) continue;
    dependencies[parsed.name] ??= {
      version: parsed.version,
      resolved: `pnpm-lock.yaml#${key}`,
    };
  }

  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
  const output = `${JSON.stringify(
    {
      name: packageJson.name,
      version: packageJson.version,
      dependencies,
    },
    null,
    2,
  )}\n`;
  if (!process.stdout.write(output)) {
    await new Promise((resolve) => process.stdout.once('drain', resolve));
  }
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--version') {
  renderVersion();
  process.exit(0);
}

if (args[0] === 'list' && args.includes('--all') && args.includes('--json')) {
  await renderInstalledTree();
  process.exit(0);
}

console.error(`scfw pnpm npm adapter only supports --version and list --all --json; received: ${args.join(' ')}`);
process.exit(1);
