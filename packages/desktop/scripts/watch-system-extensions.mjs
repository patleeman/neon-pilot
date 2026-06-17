#!/usr/bin/env node
/* eslint-env node */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(currentDir, '..');
const repoRoot = resolve(packageDir, '..', '..');
const extensionsRoot = join(repoRoot, 'extensions');
const extensionBuildScript = join(repoRoot, 'scripts', 'extension-build.mjs');
const stateDir = join(repoRoot, 'dist', 'dev-desktop');
const pidFile = join(stateDir, 'extension-watch.pid');
const debounceMs = 150;
const ownerPid = readOwnerPid(process.argv.slice(2));

const timers = new Map();
const running = new Set();
const pending = new Set();
const watchers = [];

function readOwnerPid(args) {
  const arg = args.find((candidate) => candidate.startsWith('--owner-pid='));
  const value = arg ? Number(arg.slice('--owner-pid='.length)) : NaN;
  return Number.isInteger(value) && value > 0 ? value : null;
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

mkdirSync(stateDir, { recursive: true });
writeFileSync(pidFile, `${process.pid}\n`);
process.on('exit', () => {
  try {
    rmSync(pidFile, { force: true });
  } catch {
    // Best effort cleanup.
  }
});

function log(message) {
  console.log(`[extension-watch] ${message}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listSystemExtensionDirs() {
  if (!existsSync(extensionsRoot)) return [];
  return readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('system-'))
    .map((entry) => join(extensionsRoot, entry.name))
    .filter((extensionDir) => existsSync(join(extensionDir, 'extension.json')))
    .sort((left, right) => left.localeCompare(right));
}

function findExtensionDir(filePath) {
  const relative = filePath.startsWith(extensionsRoot) ? filePath.slice(extensionsRoot.length + 1) : filePath;
  const [extensionName] = relative.split(sep);
  if (!extensionName?.startsWith('system-')) return null;
  const extensionDir = join(extensionsRoot, extensionName);
  return existsSync(join(extensionDir, 'extension.json')) ? extensionDir : null;
}

function shouldIgnore(filePath) {
  const parts = filePath.split(sep);
  return (
    parts.includes('dist') ||
    parts.includes('node_modules') ||
    parts.includes('target') ||
    parts.some((part) => part.startsWith('.dist.tmp-'))
  );
}

function assertBuiltEntriesExist(extensionDir) {
  const manifest = readJson(join(extensionDir, 'extension.json'));
  const requiredEntries = [];

  if (typeof manifest.frontend?.entry === 'string' && manifest.frontend.entry.trim().length > 0) {
    requiredEntries.push(manifest.frontend.entry);
  }
  for (const styleEntry of manifest.frontend?.styles ?? []) {
    if (typeof styleEntry === 'string' && styleEntry.trim().length > 0) requiredEntries.push(styleEntry);
  }
  if (typeof manifest.backend?.entry === 'string' && manifest.backend.entry.trim().length > 0) {
    requiredEntries.push(manifest.backend.entry.startsWith('src/') ? 'dist/backend.mjs' : manifest.backend.entry);
  }
  for (const webapp of manifest.contributes?.webapps ?? []) {
    if (typeof webapp.entry === 'string' && webapp.entry.trim().length > 0) requiredEntries.push(webapp.entry);
  }

  const missingEntries = requiredEntries.filter((entry) => !existsSync(join(extensionDir, entry)));
  if (missingEntries.length > 0) {
    throw new Error(`${manifest.id ?? extensionDir} is missing built extension outputs: ${missingEntries.join(', ')}`);
  }
}

function rebuild(extensionDir) {
  if (running.has(extensionDir)) {
    pending.add(extensionDir);
    return;
  }

  running.add(extensionDir);
  const label = extensionDir.replace(`${repoRoot}${sep}`, '');
  log(`Building ${label}`);
  const child = execFile(process.execPath, [extensionBuildScript, extensionDir], { cwd: repoRoot }, (error, stdout, stderr) => {
    if (stdout.trim()) process.stdout.write(stdout);
    if (stderr.trim()) process.stderr.write(stderr);
    running.delete(extensionDir);

    if (error) {
      log(`Build failed for ${label}: ${error.message}`);
    } else {
      try {
        assertBuiltEntriesExist(extensionDir);
        log(`Built ${label}`);
      } catch (assertionError) {
        log(assertionError instanceof Error ? assertionError.message : String(assertionError));
      }
    }

    if (pending.delete(extensionDir)) schedule(extensionDir);
  });
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
}

function schedule(extensionDir) {
  clearTimeout(timers.get(extensionDir));
  timers.set(
    extensionDir,
    setTimeout(() => {
      timers.delete(extensionDir);
      rebuild(extensionDir);
    }, debounceMs),
  );
}

function watchDirectory(dir) {
  try {
    const watcher = watch(dir, { recursive: process.platform === 'darwin' }, (_event, filename) => {
      if (!filename) return;
      const filePath = resolve(dir, filename.toString());
      if (shouldIgnore(filePath)) return;
      const extensionDir = findExtensionDir(filePath);
      if (extensionDir) schedule(extensionDir);
    });
    watcher.on('error', (error) => log(`Watcher error: ${error.message}`));
    watchers.push(watcher);
  } catch (error) {
    log(`Unable to watch ${dir}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!existsSync(extensionsRoot)) {
  log(`No extensions directory found at ${extensionsRoot}`);
  process.exit(0);
}

watchDirectory(extensionsRoot);
log(`Watching ${listSystemExtensionDirs().length} system extensions.`);

if (ownerPid !== null) {
  const timer = setInterval(() => {
    if (!processExists(ownerPid)) {
      log(`Owner process ${ownerPid} exited; stopping.`);
      process.exit(0);
    }
  }, 1_000);
  timer.unref();
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
