#!/usr/bin/env node
/* eslint-env node */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const extensionRoot = 'packages/desktop/server/extensions';
const allowedProcessGuardFiles = new Set([
  'packages/desktop/server/extensions/extensionBackendWorker.ts',
  'packages/desktop/server/extensions/extensionBackendRunner.ts',
  'packages/desktop/server/extensions/extensionProcessGuard.ts',
]);
const allowedBackendLoaderFiles = new Set(['packages/desktop/server/extensions/extensionBackend.ts']);
const allowedBackendRunnerFiles = new Set([
  'packages/desktop/server/extensions/extensionBackend.ts',
  'packages/desktop/server/extensions/extensionBackendRunner.ts',
]);
const allowedBackendExportInspectionFiles = new Set([
  'packages/desktop/server/extensions/extensionBackendRunner.ts',
  'packages/desktop/server/extensions/extensionBackendWorker.ts',
]);
const extensionHostClientFile = 'packages/desktop/server/extensions/extensionHostClient.ts';

function listExtensionFiles() {
  try {
    return execFileSync('git', ['ls-files', extensionRoot], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n')
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.smoke.test.ts'));
  } catch {
    return walkSourceFiles(extensionRoot).filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.smoke.test.ts'));
  }
}

function walkSourceFiles(dir) {
  const absoluteDir = resolve(repoRoot, dir);
  if (!existsSync(absoluteDir)) return [];
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules') return [];
      return walkSourceFiles(child);
    }
    return child.endsWith('.ts') ? [child] : [];
  });
}

const failures = [];
for (const file of listExtensionFiles()) {
  if (allowedProcessGuardFiles.has(file)) continue;
  const absolute = resolve(repoRoot, file);
  if (!existsSync(absolute)) continue;
  const text = readFileSync(absolute, 'utf8');
  const match = /\bwithExtensionProcessGuard\s*\(/.exec(text);
  if (match) {
    const line = text.slice(0, match.index).split('\n').length;
    failures.push(`${relative(repoRoot, absolute)}:${line}: extension backend execution must go through ExtensionBackendRunner`);
  }

  const rawRunnerOperation = /\bgetExtensionBackendRunner\(\)\.run\(\s*[^,\n]+,\s*(['`])/.exec(text);
  if (rawRunnerOperation) {
    const line = text.slice(0, rawRunnerOperation.index).split('\n').length;
    failures.push(`${relative(repoRoot, absolute)}:${line}: extension backend runner operations must use extensionBackendOperation(...)`);
  }

  if (!allowedBackendLoaderFiles.has(file)) {
    const directBackendLoad = /import\s+\{[^}]*\bloadExtensionBackend\b[^}]*\}\s+from\s+['"]\.\/extensionBackend\.js['"]/.exec(text);
    if (directBackendLoad) {
      const line = text.slice(0, directBackendLoad.index).split('\n').length;
      failures.push(`${relative(repoRoot, absolute)}:${line}: extension backend module loading must stay behind extensionBackend.ts`);
    }
  }

  if (!allowedBackendRunnerFiles.has(file)) {
    const directBackendRunner = /import\s+\{[^}]*\bgetExtensionBackendRunner\b[^}]*\}\s+from\s+['"]\.\/extensionBackendRunner\.js['"]/.exec(
      text,
    );
    if (directBackendRunner) {
      const line = text.slice(0, directBackendRunner.index).split('\n').length;
      failures.push(`${relative(repoRoot, absolute)}:${line}: extension backend execution must go through extensionBackend.ts helpers`);
    }
  }

  if (!allowedBackendExportInspectionFiles.has(file)) {
    const backendExportInspection = /\bbackend\s*(?:\.\s*default|\[[^\]]+\])/.exec(text);
    if (backendExportInspection) {
      const line = text.slice(0, backendExportInspection.index).split('\n').length;
      failures.push(`${relative(repoRoot, absolute)}:${line}: extension backend export lookup must stay inside ExtensionBackendRunner`);
    }
  }
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
