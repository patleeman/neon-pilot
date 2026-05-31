/* eslint-env node */

import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(currentDir, '..');
const repoRoot = resolve(packageDir, '..', '..');
const desktopRequire = createRequire(resolve(packageDir, 'package.json'));
const coreRequire = createRequire(resolve(repoRoot, 'packages', 'core', 'package.json'));
const electronPackageJsonPath = desktopRequire.resolve('electron/package.json');
const electronPackageDir = dirname(electronPackageJsonPath);
const electronVersionFile = resolve(electronPackageDir, 'dist', 'version');
const betterSqlitePackagePath = coreRequire.resolve('better-sqlite3/package.json');
const nodePtyPackagePath = desktopRequire.resolve('node-pty/package.json');
const nativeModulesDir = resolve(repoRoot, 'dist', 'dev-desktop', 'native-modules');
const nativeModulesPackagePath = resolve(nativeModulesDir, 'package.json');
const nativeBetterSqliteBinary = resolve(nativeModulesDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
const nativeNodePtyDir = resolve(nativeModulesDir, 'node_modules', 'node-pty');
const stampPath = resolve(nativeModulesDir, 'stamp.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function readElectronVersion() {
  return readFileSync(electronVersionFile, 'utf-8').trim();
}

function readBetterSqliteVersion() {
  const pkg = readJson(betterSqlitePackagePath);
  if (typeof pkg.version !== 'string' || pkg.version.trim().length === 0) {
    throw new Error(`Invalid better-sqlite3 package version at ${betterSqlitePackagePath}`);
  }

  return pkg.version.trim();
}

function readNodePtyVersion() {
  const pkg = readJson(nodePtyPackagePath);
  if (typeof pkg.version !== 'string' || pkg.version.trim().length === 0) {
    throw new Error(`Invalid node-pty package version at ${nodePtyPackagePath}`);
  }

  return pkg.version.trim();
}

function readExistingStamp(path) {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return readJson(path);
  } catch {
    return null;
  }
}

function createStamp() {
  return {
    layoutVersion: 1,
    electronVersion: readElectronVersion(),
    betterSqlite3Version: readBetterSqliteVersion(),
    nodePtyVersion: readNodePtyVersion(),
    platform: process.platform,
    arch: process.arch,
    sourcePackageMtimeMs: Math.max(statSync(betterSqlitePackagePath).mtimeMs, statSync(nodePtyPackagePath).mtimeMs),
  };
}

function writeNativeModulesPackageJson() {
  const packageJson = {
    name: 'neon-pilot-electron-native',
    private: true,
    description: 'Electron-native development modules for Neon Pilot desktop.',
    dependencies: {
      'better-sqlite3': readBetterSqliteVersion(),
      'node-pty': readNodePtyVersion(),
    },
  };

  writeFileSync(nativeModulesPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function findNodePtySpawnHelper(packageRoot) {
  const candidates = [
    resolve(packageRoot, 'build', 'Release', 'spawn-helper'),
    resolve(packageRoot, 'prebuilds', `darwin-${process.arch}`, 'spawn-helper'),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function ensureNodePtySpawnHelper(packageRoot) {
  if (process.platform !== 'darwin') return;
  const helperPath = findNodePtySpawnHelper(packageRoot);
  if (!helperPath) {
    throw new Error(`Electron-native node-pty spawn-helper was not produced under ${packageRoot}`);
  }
  chmodSync(helperPath, 0o755);
}

export function readElectronNativeModulesDir() {
  return nativeModulesDir;
}

export function ensureElectronNativeModules() {
  if (!existsSync(electronVersionFile)) {
    throw new Error(`Missing Electron version file: ${electronVersionFile}`);
  }

  if (!existsSync(betterSqlitePackagePath)) {
    throw new Error(`Missing better-sqlite3 package metadata: ${betterSqlitePackagePath}`);
  }
  if (!existsSync(nodePtyPackagePath)) {
    throw new Error(`Missing node-pty package metadata: ${nodePtyPackagePath}`);
  }

  const desiredStamp = createStamp();
  const existingStamp = readExistingStamp(stampPath);
  if (
    existsSync(nativeBetterSqliteBinary) &&
    (process.platform !== 'darwin' || Boolean(findNodePtySpawnHelper(nativeNodePtyDir))) &&
    JSON.stringify(existingStamp) === JSON.stringify(desiredStamp)
  ) {
    ensureNodePtySpawnHelper(nativeNodePtyDir);
    return nativeModulesDir;
  }

  rmSync(nativeModulesDir, { force: true, recursive: true });
  mkdirSync(nativeModulesDir, { recursive: true });
  writeNativeModulesPackageJson();

  runChecked(
    'npm',
    [
      'install',
      '--prefix',
      nativeModulesDir,
      '--workspaces=false',
      '--no-package-lock',
      '--ignore-scripts=false',
      '--build-from-source',
      '--runtime=electron',
      `--target=${desiredStamp.electronVersion}`,
      '--dist-url=https://electronjs.org/headers',
    ],
    {
      env: process.env,
    },
  );

  if (!existsSync(nativeBetterSqliteBinary)) {
    throw new Error(`Electron-native better-sqlite3 binary was not produced at ${nativeBetterSqliteBinary}`);
  }
  ensureNodePtySpawnHelper(nativeNodePtyDir);

  writeFileSync(stampPath, `${JSON.stringify(desiredStamp, null, 2)}\n`);
  return nativeModulesDir;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const outputDir = ensureElectronNativeModules();
  console.log(outputDir);
}
