#!/usr/bin/env node
/* eslint-env node */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const roots = ['extensions', 'installable-extensions'];

function listManifests() {
  return execFileSync('git', ['ls-files', ...roots.map((root) => `${root}/**/extension.json`)], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .filter(Boolean)
    .filter((file) => existsSync(resolve(repoRoot, file)));
}

const failures = [];
for (const file of listManifests()) {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, file), 'utf8'));
  const backend = manifest.backend;
  if (!backend?.entry) continue;

  for (const action of backend.actions ?? []) {
    if (action.worker?.enabled !== true) failures.push(`${file}: backend action "${action.id}" must declare worker.enabled`);
  }
  for (const route of backend.routes ?? []) {
    if (route.worker?.enabled !== true) failures.push(`${file}: backend route "${route.method} ${route.path}" must declare worker.enabled`);
  }
  for (const service of backend.services ?? []) {
    if (service.worker?.enabled !== true) failures.push(`${file}: backend service "${service.id}" must declare worker.enabled`);
    if (service.stopHandler === undefined) failures.push(`${file}: backend service "${service.id}" must declare stopHandler`);
  }
}

if (failures.length > 0) {
  console.error('Extension worker coverage check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Extension worker coverage check passed.');
