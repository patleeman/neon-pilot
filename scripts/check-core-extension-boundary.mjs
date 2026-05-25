#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const coreSearchRoots = ['packages/desktop/src', 'packages/desktop/server', 'packages/desktop/ui/src'];
const extensionSearchRoots = ['extensions', 'installable-extensions'];

const allowedFiles = new Set(['packages/desktop/ui/src/extensions/systemExtensionModules.ts']);

const filePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const forbiddenPatterns = [
  /from\s+['"][^'"]*(?:extensions|installable-extensions)\/[^'"]+\/src\//,
  /import\(\s*['"][^'"]*(?:extensions|installable-extensions)\/[^'"]+\/src\//,
  /(?:^|[^A-Za-z0-9_-])(?:extensions|installable-extensions)\/[^'"\s]+\/src\//,
];

const coreFiles = execFileSync('git', ['ls-files', ...coreSearchRoots], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .filter((file) => filePattern.test(file))
  .filter((file) => !file.includes('/dist/'))
  .filter((file) => !file.includes('.test.'));

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

const extensionFiles = execFileSync('git', ['ls-files', ...extensionSearchRoots], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .filter((file) => filePattern.test(file))
  .filter((file) => !file.includes('/dist/'))
  .filter((file) => !file.includes('.test.'))
  .filter((file) => file.includes('/src/'));

const forbiddenExtensionImportPatterns = [
  /from\s+['"]@neon-pilot\/core['"]/,
  /import\(\s*['"]@neon-pilot\/core['"]/,
  /from\s+['"]@neon-pilot\/desktop(?:\/[^'"]*)?['"]/,
  /import\(\s*['"]@neon-pilot\/desktop(?:\/[^'"]*)?['"]/,
  /from\s+['"][^'"]*packages\/(?:desktop|core)\//,
  /import\(\s*['"][^'"]*packages\/(?:desktop|core)\//,
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
