import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import type { BashOperations } from '@earendil-works/pi-coding-agent';

import { terminateProcessGroup } from '../shared/processLauncher.js';

interface ShellConfig {
  shell: string;
  args: string[];
  commandTransport?: 'argv' | 'stdin';
}

const conversationBashProcessesKey = Symbol.for('neon-pilot.conversationBashProcesses');
const globalWithBashProcesses = globalThis as typeof globalThis & {
  [conversationBashProcessesKey]?: Map<string, Set<ChildProcess>>;
};
const conversationBashProcesses =
  globalWithBashProcesses[conversationBashProcessesKey] ??
  (globalWithBashProcesses[conversationBashProcessesKey] = new Map<string, Set<ChildProcess>>());

function isLegacyWslBashPath(input: string): boolean {
  const normalized = input.replace(/\//g, '\\').toLowerCase();
  return /^[a-z]:\\windows\\(?:system32|sysnative)\\bash\.exe$/.test(normalized);
}

function bashShellConfig(shell: string): ShellConfig {
  return isLegacyWslBashPath(shell) ? { shell, args: ['-s'], commandTransport: 'stdin' } : { shell, args: ['-c'] };
}

function findBashOnPath(): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which';
  const args = process.platform === 'win32' ? ['bash.exe'] : ['bash'];
  try {
    const result = spawnSync(command, args, { encoding: 'utf-8', timeout: 5_000, windowsHide: true });
    const firstMatch = result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : '';
    return firstMatch && (process.platform !== 'win32' || existsSync(firstMatch)) ? firstMatch : null;
  } catch {
    return null;
  }
}

function resolveShellConfig(shellPath?: string): ShellConfig {
  if (shellPath) {
    if (existsSync(shellPath)) return bashShellConfig(shellPath);
    throw new Error(`Custom shell path not found: ${shellPath}`);
  }
  if (process.platform !== 'win32' && existsSync('/bin/bash')) return bashShellConfig('/bin/bash');
  const bashOnPath = findBashOnPath();
  if (bashOnPath) return bashShellConfig(bashOnPath);
  return process.platform === 'win32' ? bashShellConfig('bash.exe') : { shell: 'sh', args: ['-c'] };
}

function registerConversationBashProcess(conversationId: string | undefined, child: ChildProcess): void {
  if (!conversationId) return;
  let processes = conversationBashProcesses.get(conversationId);
  if (!processes) {
    processes = new Set();
    conversationBashProcesses.set(conversationId, processes);
  }
  processes.add(child);
  const cleanup = () => {
    processes?.delete(child);
    if (processes?.size === 0) {
      conversationBashProcesses.delete(conversationId);
    }
  };
  child.once('exit', cleanup);
  child.once('close', cleanup);
  child.once('error', cleanup);
}

export function abortConversationBashProcesses(conversationId: string): number {
  const processes = conversationBashProcesses.get(conversationId);
  if (!processes?.size) return 0;
  let killed = 0;
  for (const child of [...processes]) {
    if (!child.killed) {
      killed += 1;
      terminateProcessGroup(child);
    }
  }
  return killed;
}

function waitForChildProcess(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      child.removeListener('error', onError);
      child.removeListener('close', onClose);
      callback();
    };
    const onError = (error: Error) => finish(() => reject(error));
    const onClose = (code: number | null) => finish(() => resolve(code));
    child.once('error', onError);
    child.once('close', onClose);
  });
}

function readConversationId(env: NodeJS.ProcessEnv | undefined): string | undefined {
  const value = env?.NEON_PILOT_SOURCE_CONVERSATION_ID?.trim();
  return value || undefined;
}

export function createConversationBashOperations(options: { shellPath?: string; conversationId?: string } = {}): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env }) => {
      if (!existsSync(cwd)) {
        throw new Error(`Working directory does not exist: ${cwd}\nCannot execute bash commands.`);
      }
      if (signal?.aborted) {
        return { exitCode: null, cancelled: true };
      }

      const shellConfig = resolveShellConfig(options.shellPath);
      const commandFromStdin = shellConfig.commandTransport === 'stdin';
      const child = spawn(shellConfig.shell, commandFromStdin ? shellConfig.args : [...shellConfig.args, command], {
        cwd,
        detached: process.platform !== 'win32',
        env: env ?? process.env,
        stdio: [commandFromStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      registerConversationBashProcess(options.conversationId ?? readConversationId(env), child);

      if (commandFromStdin) {
        child.stdin?.on('error', () => undefined);
        child.stdin?.end(command);
      }

      let timedOut = false;
      let aborted = false;
      let timeoutHandle: NodeJS.Timeout | undefined;
      const kill = () => {
        aborted = true;
        terminateProcessGroup(child);
      };

      try {
        child.stdout?.on('data', onData);
        child.stderr?.on('data', onData);
        if (signal) {
          if (signal.aborted) kill();
          else signal.addEventListener('abort', kill, { once: true });
        }
        if (timeout !== undefined && timeout > 0) {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            terminateProcessGroup(child);
          }, timeout * 1000);
        }

        const exitCode = await waitForChildProcess(child);
        if (aborted || signal?.aborted || exitCode === null) return { exitCode: null, cancelled: true };
        if (timedOut) throw new Error(`timeout:${timeout}`);
        return { exitCode };
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        signal?.removeEventListener('abort', kill);
      }
    },
  };
}
