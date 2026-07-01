import { chmodSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import type { IPty } from 'node-pty';

import { type ProcessLaunchResult, resolveProcessLaunch } from './processLauncher.js';

export interface PtySpawnOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  cols?: number;
  rows?: number;
}

export interface PtySpawnResult {
  pty: IPty;
  launch: ProcessLaunchResult;
}

const require = createRequire(import.meta.url);

type NodePtyModule = Pick<typeof import('node-pty'), 'spawn'>;

let nodePtyOverrideForTest: NodePtyModule | null = null;

export function __setNodePtyForTest(nodePty: NodePtyModule | null): void {
  nodePtyOverrideForTest = nodePty;
}

function createNativeModulesRequire(): NodeJS.Require | null {
  const nativeModulesDir = process.env.NEON_PILOT_DESKTOP_NATIVE_MODULES_DIR?.trim();
  if (!nativeModulesDir) return null;
  return createRequire(resolve(nativeModulesDir, 'package.json'));
}

function loadNodePty(): { nodePty: NodePtyModule; nodePtyRequire: NodeJS.Require } {
  if (nodePtyOverrideForTest) return { nodePty: nodePtyOverrideForTest, nodePtyRequire: require };

  const nativeRequire = createNativeModulesRequire();
  if (nativeRequire) {
    try {
      return { nodePty: nativeRequire('node-pty') as NodePtyModule, nodePtyRequire: nativeRequire };
    } catch {
      // Fall through to the package manager copy; the spawn call will surface
      // native ABI or helper issues if that copy is not usable in this runtime.
    }
  }
  return { nodePty: require('node-pty') as NodePtyModule, nodePtyRequire: require };
}

function sanitizePtyEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function ensureNodePtySpawnHelperExecutable(nodePtyRequire: NodeJS.Require): void {
  if (process.platform !== 'darwin') return;
  try {
    const packageJsonPath = nodePtyRequire.resolve('node-pty/package.json');
    const helperPath = resolve(dirname(packageJsonPath), 'prebuilds', `darwin-${process.arch}`, 'spawn-helper');
    if (existsSync(helperPath)) {
      chmodSync(helperPath, 0o755);
    }
  } catch {
    // node-pty will surface the actual spawn failure if the helper cannot be repaired.
  }
}

/**
 * Create a PTY-backed process using node-pty.
 *
 * This is used by the extension shell capability when `pty: true` is requested.
 * The process launch goes through the same execution wrapper pipeline so that
 * wrappers (env injection, cwd resolution, etc.) apply consistently.
 */
export function createPtyProcess(input: PtySpawnOptions): PtySpawnResult {
  const { nodePty, nodePtyRequire } = loadNodePty();
  ensureNodePtySpawnHelperExecutable(nodePtyRequire);

  const shell = process.env.SHELL || '/bin/bash';

  const resolvedArgs = input.args ?? [];
  // When spawning a shell with no specific command, node-pty runs the shell
  // directly. When a command is given, node-pty uses `-c` to run it.
  const args = resolvedArgs.length > 0 ? resolvedArgs : [];

  const launch = resolveProcessLaunch({
    command: input.command ?? shell,
    args,
    cwd: input.cwd,
    env: input.env,
  });

  const pty = nodePty.spawn(launch.command, launch.args, {
    name: 'xterm-256color',
    cols: input.cols ?? 80,
    rows: input.rows ?? 24,
    cwd: launch.cwd ?? process.cwd(),
    env: sanitizePtyEnv(launch.env),
  });

  return { pty, launch };
}
