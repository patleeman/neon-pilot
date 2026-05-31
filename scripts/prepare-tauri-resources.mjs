#!/usr/bin/env node
/* eslint-env node */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resourcesRoot = resolve(repoRoot, 'packages', 'tauri', 'desktop-shell', 'src-tauri', 'resources');

function copyRequired(source, target) {
  if (!existsSync(source)) {
    throw new Error(`Required Tauri resource is missing: ${source}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

rmSync(resourcesRoot, { recursive: true, force: true });
mkdirSync(resourcesRoot, { recursive: true });

writeFileSync(
  resolve(resourcesRoot, 'package.json'),
  `${JSON.stringify({ name: 'neon-pilot-tauri-runtime', private: true, type: 'module' }, null, 2)}\n`,
);
mkdirSync(resolve(resourcesRoot, 'packages'), { recursive: true });

copyRequired(
  resolve(repoRoot, 'packages', 'desktop', 'dist', 'backend'),
  resolve(resourcesRoot, 'packages', 'desktop', 'dist', 'backend'),
);
copyRequired(
  resolve(repoRoot, 'packages', 'desktop', 'server', 'dist'),
  resolve(resourcesRoot, 'packages', 'desktop', 'server', 'dist'),
);
copyRequired(resolve(repoRoot, 'docs'), resolve(resourcesRoot, 'docs'));
copyRequired(resolve(repoRoot, 'extensions'), resolve(resourcesRoot, 'extensions'));
copyRequired(resolve(repoRoot, 'installable-extensions'), resolve(resourcesRoot, 'installable-extensions'));

console.log(`[tauri] staged runtime resources at ${resourcesRoot}`);
