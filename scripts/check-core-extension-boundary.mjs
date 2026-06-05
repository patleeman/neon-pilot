#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const coreSearchRoots = ['packages/desktop/src', 'packages/desktop/server', 'packages/desktop/ui/src'];
const extensionSearchRoots = ['extensions'];

const allowedFiles = new Set(['packages/desktop/ui/src/extensions/systemExtensionModules.ts']);

const filePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const forbiddenPatterns = [
  /from\s+['"][^'"]*extensions\/[^'"]+\/src\//,
  /import\(\s*['"][^'"]*extensions\/[^'"]+\/src\//,
  /(?:^|[^A-Za-z0-9_-])extensions\/[^'"\s]+\/src\//,
];

function walkTrackedFallback(dir) {
  const absoluteDir = resolve(repoRoot, dir);
  if (!existsSync(absoluteDir)) return [];
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules') return [];
      return walkTrackedFallback(child);
    }
    return filePattern.test(child) ? [child] : [];
  });
}

function listFiles(roots) {
  try {
    return execFileSync('git', ['ls-files', ...roots], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n')
      .filter(Boolean);
  } catch {
    return roots.flatMap((root) => walkTrackedFallback(root));
  }
}

const coreFiles = listFiles(coreSearchRoots)
  .filter((file) => filePattern.test(file))
  .filter((file) => !file.includes('/dist/'))
  .filter((file) => !file.includes('.test.'))
  .filter((file) => existsSync(resolve(repoRoot, file)));

const violations = [];
for (const file of coreFiles) {
  if (allowedFiles.has(file)) continue;
  const text = readFileSync(resolve(repoRoot, file), 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (forbiddenPatterns.some((pattern) => pattern.test(line))) {
      violations.push(`${relative(repoRoot, resolve(repoRoot, file))}:${index + 1}: ${line.trim()}`);
    }
  });
}

const extensionFiles = listFiles(extensionSearchRoots)
  .filter((file) => filePattern.test(file))
  .filter((file) => !file.includes('/dist/'))
  .filter((file) => file.includes('/src/'))
  .filter((file) => existsSync(resolve(repoRoot, file)));

const forbiddenExtensionImportPatterns = [
  /from\s+['"]@neon-pilot\/core['"]/,
  /import\(\s*['"]@neon-pilot\/core['"]/,
  /from\s+['"]@neon-pilot\/desktop(?:\/[^'"]*)?['"]/,
  /import\(\s*['"]@neon-pilot\/desktop(?:\/[^'"]*)?['"]/,
  /from\s+['"]@neon-pilot\/daemon(?:\/[^'"]*)?['"]/,
  /import\(\s*['"]@neon-pilot\/daemon(?:\/[^'"]*)?['"]/,
  /from\s+['"][^'"]*packages\/(?:desktop|core|daemon)\//,
  /import\(\s*['"][^'"]*packages\/(?:desktop|core|daemon)\//,
];

for (const file of extensionFiles) {
  const text = readFileSync(resolve(repoRoot, file), 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (forbiddenExtensionImportPatterns.some((pattern) => pattern.test(line))) {
      violations.push(`${relative(repoRoot, resolve(repoRoot, file))}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Core/extension boundary violation.');
  console.error('Core desktop code must not import extension feature source directly.');
  console.error('Extension runtime code must use @neon-pilot/extensions public APIs instead of app/core internals.');
  console.error('Add the smallest reusable extension SDK/backend subpath when a host capability is missing.');
  console.error(violations.join('\n'));
  process.exit(1);
}
