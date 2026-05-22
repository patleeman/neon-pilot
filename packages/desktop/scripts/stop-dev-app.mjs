/* eslint-env node */

import { execFileSync } from 'node:child_process';

const productName = 'Neon Pilot Testing';
const processNeedle = '/dist/dev-desktop/Neon Pilot Testing.app/Contents/MacOS/Neon Pilot Testing';
const timeoutMs = 5_000;

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function listDevAppPids() {
  const output = run('ps', ['-axo', 'pid=,command=']);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes(processNeedle))
    .map((line) => Number(line.split(/\s+/, 1)[0]))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function waitForExit() {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (listDevAppPids().length === 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return listDevAppPids().length === 0;
}

if (process.platform === 'darwin') {
  run('osascript', ['-e', `tell application ${JSON.stringify(productName)} to quit`]);
}

if (!(await waitForExit())) {
  for (const pid of listDevAppPids()) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already exited.
    }
  }
  await waitForExit();
}

for (const pid of listDevAppPids()) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Already exited.
  }
}
