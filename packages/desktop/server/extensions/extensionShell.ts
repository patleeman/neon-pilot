import { type ChildProcess } from 'node:child_process';

import { execFileProcess, spawnProcess, terminateProcessGroup } from '../shared/processLauncher.js';
import { createPtyProcess, type PtySpawnOptions } from '../shared/ptyLauncher.js';

const spawnedExtensionProcesses = new Set<ChildProcess>();
let shutdownHooksInstalled = false;

function terminateSpawnedExtensionProcesses(): void {
  for (const child of spawnedExtensionProcesses) {
    terminateProcessGroup(child);
  }
}

function installShutdownHooks(): void {
  if (shutdownHooksInstalled) return;
  shutdownHooksInstalled = true;
  process.once('exit', terminateSpawnedExtensionProcesses);
}

function createPipeBackedSpawnHandle(
  input: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    onExit?: (event: { code: number | null; signal: NodeJS.Signals | null }) => void;
  },
  resolvedEnv: NodeJS.ProcessEnv,
) {
  const { child, launch } = spawnProcess({
    command: input.command,
    args: input.args ?? [],
    cwd: input.cwd,
    env: resolvedEnv,
    options: { detached: true, stdio: ['pipe', 'pipe', 'pipe'] },
  });
  spawnedExtensionProcesses.add(child);
  child.stdout?.on('data', (chunk: Buffer) => input.onStdout?.(chunk.toString('utf8')));
  child.stderr?.on('data', (chunk: Buffer) => input.onStderr?.(chunk.toString('utf8')));
  child.on('exit', (code, signal) => {
    spawnedExtensionProcesses.delete(child);
    input.onExit?.({ code, signal });
  });
  return {
    pid: child.pid ?? null,
    usingPty: false,
    executionWrappers: launch.wrappers,
    kill: () => {
      spawnedExtensionProcesses.delete(child);
      terminateProcessGroup(child);
    },
    write: (data: string) => {
      if (child.stdin?.writable) {
        child.stdin.write(data);
      }
    },
    resize: (_cols: number, _rows: number) => {
      // No-op for pipe-backed processes; resize is only meaningful with PTY.
    },
  };
}

export function createExtensionShellCapability() {
  return {
    async exec(input: {
      command: string;
      args?: string[];
      cwd?: string;
      timeoutMs?: number;
      maxBuffer?: number;
      env?: Record<string, string>;
      signal?: AbortSignal;
    }): Promise<{
      command: string;
      args: string[];
      cwd?: string;
      stdout: string;
      stderr: string;
      executionWrappers: Array<{ id: string; label?: string }>;
    }> {
      const args = input.args ?? [];
      const result = await execFileProcess({
        command: input.command,
        args,
        cwd: input.cwd,
        timeoutMs: input.timeoutMs ?? 30_000,
        maxBuffer: input.maxBuffer ?? 1024 * 1024,
        env: input.env ? { ...process.env, ...input.env } : process.env,
        signal: input.signal,
      });
      return {
        command: input.command,
        args,
        ...(input.cwd ? { cwd: input.cwd } : {}),
        stdout: result.stdout,
        stderr: result.stderr,
        executionWrappers: result.launch.wrappers,
      };
    },

    async spawn(input: {
      command: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      pty?: boolean | { cols?: number; rows?: number };
      onStdout?: (chunk: string) => void;
      onStderr?: (chunk: string) => void;
      onExit?: (event: { code: number | null; signal: NodeJS.Signals | null }) => void;
    }): Promise<{
      pid: number | null;
      executionWrappers: Array<{ id: string; label?: string }>;
      kill: () => void;
      write: (data: string) => void;
      resize: (cols: number, rows: number) => void;
    }> {
      installShutdownHooks();
      const resolvedEnv = input.env ? { ...process.env, ...input.env } : process.env;

      if (input.pty) {
        // PTY-backed spawn: use node-pty
        const ptyOptions: PtySpawnOptions = {
          command: input.command,
          args: input.args ?? [],
          cwd: input.cwd,
          env: resolvedEnv,
          cols: typeof input.pty === 'object' ? input.pty.cols : 80,
          rows: typeof input.pty === 'object' ? input.pty.rows : 24,
        };
        let ptyResult: ReturnType<typeof createPtyProcess>;
        try {
          ptyResult = createPtyProcess(ptyOptions);
        } catch {
          return createPipeBackedSpawnHandle(input, resolvedEnv);
        }
        const { pty, launch } = ptyResult;
        spawnedExtensionProcesses.add(pty as unknown as ChildProcess);
        pty.onData((chunk: string) => input.onStdout?.(chunk));
        pty.onExit((event: { exitCode: number; signal?: number }) => {
          spawnedExtensionProcesses.delete(pty as unknown as ChildProcess);
          input.onExit?.({ code: event.exitCode, signal: null });
        });
        return {
          pid: pty.pid,
          usingPty: true,
          executionWrappers: launch.wrappers,
          kill: () => {
            spawnedExtensionProcesses.delete(pty as unknown as ChildProcess);
            pty.kill();
          },
          write: (data: string) => pty.write(data),
          resize: (cols: number, rows: number) => pty.resize(cols, rows),
        };
      }

      // Non-PTY spawn with stdin pipe for write support
      return createPipeBackedSpawnHandle(input, resolvedEnv);
    },
  };
}

export function createExtensionGitCapability() {
  const shell = createExtensionShellCapability();
  return {
    async status(input: { cwd: string }): Promise<{ porcelain: string }> {
      const result = await shell.exec({ command: 'git', args: ['status', '--porcelain=v1', '--branch'], cwd: input.cwd });
      return { porcelain: result.stdout };
    },
    async diff(input: { cwd: string; path?: string; staged?: boolean }): Promise<{ diff: string }> {
      const args = ['diff'];
      if (input.staged) args.push('--staged');
      if (input.path) args.push('--', input.path);
      const result = await shell.exec({ command: 'git', args, cwd: input.cwd, maxBuffer: 8 * 1024 * 1024 });
      return { diff: result.stdout };
    },
    async log(input: { cwd: string; maxCount?: number }): Promise<{ log: string }> {
      const result = await shell.exec({
        command: 'git',
        args: ['log', `--max-count=${input.maxCount ?? 20}`, '--oneline', '--decorate'],
        cwd: input.cwd,
      });
      return { log: result.stdout };
    },
  };
}
