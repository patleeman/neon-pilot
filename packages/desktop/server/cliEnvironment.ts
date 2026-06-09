import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';

import { getStateRoot } from '@neon-pilot/core';

export const NEON_PILOT_CLI_COMMAND = 'neon-pilot';

export function getNeonPilotCliBinDir(stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'bin');
}

export function prependNeonPilotCliBin(env: NodeJS.ProcessEnv, stateRoot: string = getStateRoot()): NodeJS.ProcessEnv {
  const binDir = getNeonPilotCliBinDir(stateRoot);
  const currentParts = (env.PATH ?? '').split(delimiter).filter(Boolean);
  return {
    ...env,
    PATH: [binDir, ...currentParts.filter((part) => part !== binDir)].join(delimiter),
  };
}

export function ensureNeonPilotCliLauncher(input: { repoRoot: string; stateRoot?: string }): string {
  const stateRoot = input.stateRoot ?? getStateRoot();
  const binDir = getNeonPilotCliBinDir(stateRoot);
  mkdirSync(binDir, { recursive: true });
  const launcherPath = join(binDir, NEON_PILOT_CLI_COMMAND);
  const target = resolveNeonPilotCliTarget(input.repoRoot);
  const content = [
    '#!/bin/sh',
    'export ELECTRON_RUN_AS_NODE=1',
    `exec ${JSON.stringify(process.execPath)} ${JSON.stringify(target)} "$@"`,
    '',
  ].join('\n');
  if (!existsSync(launcherPath) || readFileSync(launcherPath, 'utf-8') !== content) {
    writeFileSync(launcherPath, content, { mode: 0o755 });
  }
  return launcherPath;
}

function resolveNeonPilotCliTarget(repoRoot: string): string {
  const candidates = [
    resolve(repoRoot, 'scripts/neon-pilot-cli.mjs'),
    resolve(repoRoot, 'packages/desktop/server/dist/protocolCli.js'),
    resolve(repoRoot, 'server/dist/protocolCli.js'),
    resolve(repoRoot, 'app.asar/server/dist/protocolCli.js'),
    resolve(repoRoot, 'app.asar.unpacked/server/dist/protocolCli.js'),
    resolve(repoRoot, 'packages/desktop/dist/server/protocolCli.js'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? resolve(repoRoot, 'app.asar/server/dist/protocolCli.js');
}

export function getDefaultUserCliInstallPath(command = NEON_PILOT_CLI_COMMAND): string {
  return join(process.env.HOME ?? '', '.local', 'bin', command);
}

export function installUserCliSymlink(input: { target: string; linkPath?: string; command?: string }): string {
  const linkPath = input.linkPath ?? getDefaultUserCliInstallPath(input.command);
  mkdirSync(dirname(linkPath), { recursive: true });
  if (existsSync(linkPath)) unlinkSync(linkPath);
  symlinkSync(input.target, linkPath);
  return linkPath;
}

export interface NeonPilotCliInstallStatus {
  target: string;
  binDir: string;
  linkPath: string;
  globallyInstalled: boolean;
}

export function readNeonPilotCliInstallStatus(input: { repoRoot: string; stateRoot?: string } | string): NeonPilotCliInstallStatus {
  const options = typeof input === 'string' ? { repoRoot: input } : input;
  const target = ensureNeonPilotCliLauncher(options);
  const linkPath = getDefaultUserCliInstallPath();
  let globallyInstalled = false;
  try {
    globallyInstalled = existsSync(linkPath) && lstatSync(linkPath).isSymbolicLink() && readlinkSync(linkPath) === target;
  } catch {
    globallyInstalled = false;
  }
  return {
    target,
    binDir: getNeonPilotCliBinDir(options.stateRoot),
    linkPath,
    globallyInstalled,
  };
}

export function installNeonPilotUserCli(input: { repoRoot: string; stateRoot?: string } | string): NeonPilotCliInstallStatus {
  const status = readNeonPilotCliInstallStatus(input);
  installUserCliSymlink({ target: status.target, linkPath: status.linkPath });
  return { ...status, globallyInstalled: true };
}

export function uninstallNeonPilotUserCli(
  input: { repoRoot: string; stateRoot?: string } | string,
): NeonPilotCliInstallStatus & { removed: boolean } {
  const status = readNeonPilotCliInstallStatus(input);
  if (status.globallyInstalled) unlinkSync(status.linkPath);
  return { ...status, globallyInstalled: false, removed: status.globallyInstalled };
}
