#!/usr/bin/env node
/* eslint-env node */
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const installableRoot = resolve(repoRoot, 'installable-extensions');
const isCli = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isCli) {
  const extensionId = readFlag('--extension') ?? readPositionalExtensionId();
  const target = readFlag('--target') ?? 'testing';

  if (!extensionId) fail('Usage: pnpm run install -- --extension <extension-id> [--target testing|production|/custom/state/root]');

  const extensionRoot = resolve(installableRoot, extensionId);
  if (!existsSync(resolve(extensionRoot, 'extension.json'))) fail(`No extension found at ${extensionRoot}`);

  const stateRoot = resolveTargetStateRoot(target);
  const destination = resolve(stateRoot, 'extensions', extensionId);
  mkdirSync(resolve(stateRoot, 'extensions'), { recursive: true });
  installExtension(extensionRoot, destination);
  console.log(`Installed ${extensionId} to ${destination}`);
}

export function installExtension(source, destination, options = {}) {
  const copy = options.copy ?? cpSync;
  const parent = dirname(destination);
  const extensionId = destination.split('/').pop() ?? 'extension';
  const tempDestination = resolve(parent, `.${extensionId}.installing-${process.pid}-${Date.now()}`);
  const backupDestination = resolve(parent, `.${extensionId}.previous-${process.pid}-${Date.now()}`);
  rmSync(tempDestination, { recursive: true, force: true });
  rmSync(backupDestination, { recursive: true, force: true });
  copy(source, tempDestination, { recursive: true });
  let hasBackup = false;
  try {
    if (existsSync(destination)) {
      renameSync(destination, backupDestination);
      hasBackup = true;
    }
    renameSync(tempDestination, destination);
    rmSync(backupDestination, { recursive: true, force: true });
  } catch (error) {
    rmSync(tempDestination, { recursive: true, force: true });
    if (hasBackup && !existsSync(destination)) renameSync(backupDestination, destination);
    throw error;
  }
}

function resolveTargetStateRoot(value) {
  if (value === 'testing') return resolve(homedir(), '.local/state/neon-pilot-testing');
  if (value === 'production' || value === 'prod') return resolve(homedir(), '.local/state/neon-pilot');
  return resolve(value);
}

function readFlag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function readPositionalExtensionId() {
  return process.argv.slice(2).find((arg) => arg !== '--' && !arg.startsWith('--')) ?? null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
