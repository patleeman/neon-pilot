#!/usr/bin/env node
/* eslint-env node */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installableRoot = join(repoRoot, 'installable-extensions');
const outRoot = resolve(process.argv[2] ?? join(repoRoot, 'dist', 'installable-extensions'));
const buildScript = join(repoRoot, 'scripts', 'extension-build.mjs');
const packScript = join(repoRoot, 'scripts', 'extension-pack.mjs');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listInstallableExtensionDirs() {
  if (!existsSync(installableRoot)) return [];
  return readdirSync(installableRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('system-'))
    .map((entry) => join(installableRoot, entry.name))
    .filter((dir) => existsSync(join(dir, 'extension.json')))
    .sort((left, right) => left.localeCompare(right));
}

rmSync(outRoot, { recursive: true, force: true });
const extensionDirs = listInstallableExtensionDirs();
const catalog = [];
for (const extensionDir of extensionDirs) {
  const manifest = readJson(join(extensionDir, 'extension.json'));
  const id = manifest.id;
  if (!id) throw new Error(`${extensionDir} has no manifest id.`);
  console.log(`Building installable extension ${id}`);
  execFileSync(process.execPath, [buildScript, extensionDir], { cwd: repoRoot, stdio: 'inherit' });
  const outPath = join(outRoot, `${id}.neon-extension.zip`);
  execFileSync(process.execPath, [packScript, extensionDir, '--out', outPath], { cwd: repoRoot, stdio: 'inherit' });
  catalog.push({ id, name: manifest.name, description: manifest.description, version: manifest.version, file: `${id}.neon-extension.zip` });
}
console.log(JSON.stringify({ extensions: catalog }, null, 2));
console.log(`Packed ${extensionDirs.length} installable extensions into ${outRoot}`);
