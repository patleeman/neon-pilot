#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const searchRoots = ['packages/desktop/src', 'packages/desktop/server', 'packages/desktop/ui/src'];

const allowedFiles = new Set(['packages/desktop/ui/src/extensions/systemExtensionModules.ts']);

const filePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const forbiddenPatterns = [
  /from\s+['"][^'"]*(?:extensions|installable-extensions)\/[^'"]+\/src\//,
  /import\(\s*['"][^'"]*(?:extensions|installable-extensions)\/[^'"]+\/src\//,
  /(?:^|[^A-Za-z0-9_-])(?:extensions|installable-extensions)\/[^'"\s]+\/src\//,
];

const files = execFileSync('git', ['ls-files', ...searchRoots], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .filter((file) => filePattern.test(file))
  .filter((file) => !file.includes('/dist/'))
  .filter((file) => !file.includes('.test.'));

const violations = [];
for (const file of files) {
  if (allowedFiles.has(file)) continue;
  const text = readFileSync(resolve(repoRoot, file), 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (forbiddenPatterns.some((pattern) => pattern.test(line))) {
      violations.push(`${relative(repoRoot, resolve(repoRoot, file))}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Core desktop code must not import extension feature source directly.');
  console.error('Load extension UI/backend through manifests, actions, SDK capabilities, or the generic system extension module loader.');
  console.error(violations.join('\n'));
  process.exit(1);
}
