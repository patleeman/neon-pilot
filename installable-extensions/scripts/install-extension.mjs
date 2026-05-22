#!/usr/bin/env node
/* eslint-env node */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const installableRoot = resolve(repoRoot, 'installable-extensions');
const extensionId = readFlag('--extension') ?? process.argv[2];
const target = readFlag('--target') ?? 'testing';

if (!extensionId) fail('Usage: pnpm run install -- --extension <extension-id> [--target testing|production|/custom/state/root]');

const extensionRoot = resolve(installableRoot, extensionId);
if (!existsSync(resolve(extensionRoot, 'extension.json'))) fail(`No extension found at ${extensionRoot}`);

const stateRoot = resolveTargetStateRoot(target);
const destination = resolve(stateRoot, 'extensions', extensionId);
mkdirSync(resolve(stateRoot, 'extensions'), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(extensionRoot, destination, { recursive: true });
console.log(`Installed ${extensionId} to ${destination}`);

function resolveTargetStateRoot(value) {
  if (value === 'testing') return resolve(homedir(), '.local/state/neon-pilot-testing');
  if (value === 'production' || value === 'prod') return resolve(homedir(), '.local/state/neon-pilot');
  return resolve(value);
}

function readFlag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
