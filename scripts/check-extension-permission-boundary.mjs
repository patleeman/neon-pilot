#!/usr/bin/env node
/* eslint-env node */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const roots = ['packages/desktop/server/extensions'];
const allowedFiles = new Set([
  'packages/desktop/server/extensions/extensionManifest.ts',
  'packages/desktop/server/extensions/extensionPermissions.ts',
  'packages/desktop/server/extensions/extensionRegistry.ts',
]);
const filePattern = /\.ts$/;
const forbiddenPatterns = [
  {
    pattern: /\bmanifest\.permissions\b/,
    message: 'extension host capability code must use extensionPermissions instead of reading manifest.permissions directly',
  },
  {
    pattern: /\bpermissions\.includes\s*\(/,
    message: 'extension host capability code must use assertExtensionPermission instead of ad hoc permission checks',
  },
];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
    } else if (entry.isFile() && filePattern.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];
for (const root of roots) {
  for (const file of walk(resolve(repoRoot, root))) {
    const rel = relative(repoRoot, file);
    if (allowedFiles.has(rel) || rel.endsWith('.test.ts') || rel.endsWith('.smoke.test.ts')) continue;
    const text = readFileSync(file, 'utf8');
    for (const { pattern, message } of forbiddenPatterns) {
      if (pattern.test(text)) {
        violations.push(`${rel}: ${message}`);
      }
    }
    statSync(file);
  }
}

if (violations.length > 0) {
  console.error('Extension permission boundary check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Extension permission boundary check passed.');
