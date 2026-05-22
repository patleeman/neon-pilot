#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const runtimeRoot = resolve(here, '..');
const binDir = resolve(
  process.argv.find((arg) => arg.startsWith('--bin-dir='))?.slice('--bin-dir='.length) ?? join(runtimeRoot, 'bin', 'darwin-arm64'),
);
const binaries = ['llama-cli', 'llama-server'];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8' });
}

if (process.platform !== 'darwin') {
  console.log('skipping llama.cpp runtime check: only macOS bundles are supported');
  process.exit(0);
}

for (const binary of binaries) {
  const binaryPath = join(binDir, binary);
  if (!existsSync(binaryPath)) {
    fail(`missing ${binaryPath}`);
    continue;
  }

  let otool = '';
  try {
    otool = execFileSync('otool', ['-L', binaryPath], { encoding: 'utf8' });
  } catch (error) {
    fail(`otool failed for ${binaryPath}: ${error.message}`);
    continue;
  }

  const missing = [];
  for (const line of otool.split('\n')) {
    const dep = line.trim().split(/\s+/)[0];
    if (!dep?.startsWith('@rpath/') || !dep.endsWith('.dylib')) continue;
    const dylib = join(binDir, basename(dep));
    if (!existsSync(dylib)) missing.push(basename(dep));
  }
  if (missing.length) fail(`${binary} is missing dylib dependencies: ${missing.join(', ')}`);
  else pass(`${binary} dylib dependencies are present`);

  const version = run(binaryPath, ['--version']);
  if (version.status !== 0) fail(`${binary} --version failed: ${(version.stderr || version.stdout).trim()}`);
  else pass(`${binary} launches: ${(version.stdout || version.stderr).trim().split('\n')[0]}`);
}

if (process.exitCode) process.exit(process.exitCode);
