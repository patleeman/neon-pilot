#!/usr/bin/env node
/* eslint-env node */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('== Neon Pilot release QA ==');
console.log('Running automated release reliability doctor...');
run(process.execPath, ['scripts/release-reliability-doctor.mjs']);

const checklist = readFileSync(resolve(repoRoot, 'docs/release-qa.md'), 'utf8');
const marker = '## Hands-on smoke checklist';
const index = checklist.indexOf(marker);
console.log('\n== Required hands-on QA ==');
console.log(index >= 0 ? checklist.slice(index).trim() : checklist.trim());
console.log('\nRecord the pass/fail result, app build, and commit SHA before cutting a release.');
