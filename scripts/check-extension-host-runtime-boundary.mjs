#!/usr/bin/env node
/* eslint-env node */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const extensionRoot = 'packages/desktop/server/extensions';
const allowedProcessGuardFiles = new Set([
  'packages/desktop/server/extensions/extensionBackendRunner.ts',
  'packages/desktop/server/extensions/extensionProcessGuard.ts',
]);
const extensionHostClientFile = 'packages/desktop/server/extensions/extensionHostClient.ts';

function listExtensionFiles() {
  return execFileSync('git', ['ls-files', extensionRoot], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\n')
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.smoke.test.ts'));
}

const failures = [];
for (const file of listExtensionFiles()) {
  if (allowedProcessGuardFiles.has(file)) continue;
  const absolute = resolve(repoRoot, file);
  if (!existsSync(absolute)) continue;
  const text = readFileSync(absolute, 'utf8');
  const match = /\bwithExtensionProcessGuard\s*\(/.exec(text);
  if (!match) continue;
  const line = text.slice(0, match.index).split('\n').length;
  failures.push(`${relative(repoRoot, absolute)}:${line}: extension backend execution must go through ExtensionBackendRunner`);
}

const hostClientPath = resolve(repoRoot, extensionHostClientFile);
if (existsSync(hostClientPath)) {
  const text = readFileSync(hostClientPath, 'utf8');
  const getClientBody = /export function getExtensionHostClient\(\): ExtensionHostClient \{([\s\S]*?)\n\}/.exec(text)?.[1] ?? '';
  if (!getClientBody.includes('Extension host client is not configured')) {
    failures.push(`${extensionHostClientFile}: getExtensionHostClient must fail closed when the RPC client has not been configured`);
  }
  if (/\bcreateInProcessExtensionHostClient\s*\(/.test(getClientBody)) {
    failures.push(`${extensionHostClientFile}: getExtensionHostClient must not silently construct the in-process extension host`);
  }
}

if (failures.length > 0) {
  console.error('Extension host runtime boundary check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Extension host runtime boundary check passed.');
