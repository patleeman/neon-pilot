import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants, existsSync } from 'node:fs';
import { copyFile, cp, lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

export type SpeculativeWorkspaceStrategy = 'apfs-clone' | 'copy';
export type SpeculativeChangeType = 'added' | 'modified' | 'deleted';
export type SpeculativeEntryKind = 'file' | 'symlink';

export interface SpeculativeWorkspaceChange {
  path: string;
  type: SpeculativeChangeType;
  kind: SpeculativeEntryKind;
}

export interface SpeculativeWorkspaceDiff {
  changes: SpeculativeWorkspaceChange[];
  summary: {
    added: number;
    modified: number;
    deleted: number;
  };
}

export interface SpeculativeWorkspaceRunResult {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  sandboxed: boolean;
}

export interface SpeculativeWorkspace {
  readonly id: string;
  readonly sourcePath: string;
  readonly rootPath: string;
  readonly strategy: SpeculativeWorkspaceStrategy;
  readonly sandboxProfilePath: string | null;
  run(input: {
    command: string;
    args?: string[];
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    maxBuffer?: number;
    useSandbox?: boolean;
  }): Promise<SpeculativeWorkspaceRunResult>;
  diff(options?: SpeculativeWorkspaceDiffOptions): Promise<SpeculativeWorkspaceDiff>;
  apply(input?: { paths?: string[]; options?: SpeculativeWorkspaceDiffOptions }): Promise<SpeculativeWorkspaceDiff>;
  dispose(): Promise<void>;
}

export interface SpeculativeWorkspaceDiffOptions {
  excludeNames?: string[];
}

export interface CreateSpeculativeWorkspaceInput {
  sourcePath: string;
  id?: string;
  tempPrefix?: string;
  writablePaths?: string[];
  cloneStrategy?: 'auto' | SpeculativeWorkspaceStrategy;
  platform?: NodeJS.Platform;
  commandRunner?: CommandRunner;
}

interface FileSnapshot {
  kind: SpeculativeEntryKind;
  digest: string;
}

interface CommandResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; maxBuffer?: number },
) => Promise<CommandResult>;

const WORKSPACE_SCRATCH_DIR = '.neon-pilot-tmp';
const DEFAULT_EXCLUDE_NAMES = new Set(['.git', 'node_modules', '.DS_Store', WORKSPACE_SCRATCH_DIR]);

function isAppleDoubleName(name: string): boolean {
  return name.startsWith('._');
}

function contained(rootInput: string, candidateInput: string): boolean {
  const root = resolve(rootInput);
  const candidate = resolve(candidateInput);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  return candidate === root || candidate.startsWith(rootWithSep);
}

function resolveContained(root: string, relativePath: string): string {
  const target = resolve(root, relativePath);
  if (!contained(root, target)) {
    throw new Error(`Speculative workspace path escapes root: ${relativePath}`);
  }
  return target;
}

function relativePath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).replace(/\\/g, '/');
}

function shellSandboxString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createMacWriteSandboxProfile(input: { writablePaths: string[] }): string {
  const writablePaths = [...new Set(input.writablePaths.map((item) => resolve(item)))];
  return [
    '(version 1)',
    '(allow default)',
    '(deny file-write*)',
    '(allow file-write* (literal "/dev/null"))',
    ...writablePaths.map((path) => `(allow file-write* (subpath "${shellSandboxString(path)}"))`),
    '',
  ].join('\n');
}

async function defaultCommandRunner(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; maxBuffer?: number },
): Promise<CommandResult> {
  return await new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const maxBuffer = options.maxBuffer ?? 8 * 1024 * 1024;
    let stdout = '';
    let stderr = '';
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolveResult(result);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      Object.assign(error, { stdout, stderr });
      reject(error);
    };
    const append = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
      if (stream === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
      if (stdout.length + stderr.length > maxBuffer) {
        child.kill('SIGTERM');
        fail(new Error(`Command output exceeded maxBuffer of ${maxBuffer} bytes.`));
      }
    };
    child.stdout?.on('data', (chunk: Buffer) => append('stdout', chunk));
    child.stderr?.on('data', (chunk: Buffer) => append('stderr', chunk));
    child.on('error', fail);
    child.on('close', (exitCode, signal) => finish({ exitCode, signal, stdout, stderr }));
    if (options.timeoutMs && options.timeoutMs > 0) {
      timeout = setTimeout(() => {
        child.kill('SIGTERM');
        fail(new Error(`Command timed out after ${options.timeoutMs}ms.`));
      }, options.timeoutMs);
    }
  });
}

async function cloneWithApfsCp(sourcePath: string, rootPath: string, runner: CommandRunner): Promise<void> {
  const result = await runner('/bin/cp', ['-cR', `${sourcePath}/.`, `${rootPath}/`], { timeoutMs: 120_000 });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `APFS clone copy failed with exit code ${result.exitCode}.`);
  }
}

async function copyWorkspace(sourcePath: string, rootPath: string): Promise<void> {
  await cp(sourcePath, rootPath, {
    recursive: true,
    force: true,
    errorOnExist: false,
    preserveTimestamps: true,
    verbatimSymlinks: true,
  });
}

async function hashFile(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function snapshot(root: string, options?: SpeculativeWorkspaceDiffOptions): Promise<Map<string, FileSnapshot>> {
  const excludeNames = new Set([...DEFAULT_EXCLUDE_NAMES, ...(options?.excludeNames ?? [])]);
  const files = new Map<string, FileSnapshot>();
  const visit = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (excludeNames.has(entry.name) || isAppleDoubleName(entry.name)) continue;
      const absolutePath = join(dir, entry.name);
      const rel = relativePath(root, absolutePath);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (entry.isSymbolicLink()) {
        files.set(rel, { kind: 'symlink', digest: `symlink:${await readlink(absolutePath)}` });
        continue;
      }
      if (entry.isFile()) {
        files.set(rel, { kind: 'file', digest: `file:${await hashFile(absolutePath)}` });
      }
    }
  };
  await visit(root);
  return files;
}

async function copyEntry(sourceRoot: string, targetRoot: string, path: string): Promise<void> {
  const source = resolveContained(sourceRoot, path);
  const target = resolveContained(targetRoot, path);
  const stats = await lstat(source);
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  if (stats.isSymbolicLink()) {
    await symlink(await readlink(source), target);
    return;
  }
  await copyFile(source, target, constants.COPYFILE_FICLONE_FORCE).catch(async () => {
    await copyFile(source, target);
  });
}

export async function collectSpeculativeWorkspaceDiff(
  sourcePath: string,
  workspacePath: string,
  options?: SpeculativeWorkspaceDiffOptions,
): Promise<SpeculativeWorkspaceDiff> {
  const before = await snapshot(sourcePath, options);
  const after = await snapshot(workspacePath, options);
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a.localeCompare(b));
  const changes: SpeculativeWorkspaceChange[] = [];
  for (const path of paths) {
    const left = before.get(path);
    const right = after.get(path);
    if (!left && right) changes.push({ path, type: 'added', kind: right.kind });
    else if (left && !right) changes.push({ path, type: 'deleted', kind: left.kind });
    else if (left && right && (left.kind !== right.kind || left.digest !== right.digest)) {
      changes.push({ path, type: 'modified', kind: right.kind });
    }
  }
  return {
    changes,
    summary: {
      added: changes.filter((change) => change.type === 'added').length,
      modified: changes.filter((change) => change.type === 'modified').length,
      deleted: changes.filter((change) => change.type === 'deleted').length,
    },
  };
}

export async function applySpeculativeWorkspaceChanges(input: {
  sourcePath: string;
  workspacePath: string;
  paths?: string[];
  options?: SpeculativeWorkspaceDiffOptions;
}): Promise<SpeculativeWorkspaceDiff> {
  const diff = await collectSpeculativeWorkspaceDiff(input.sourcePath, input.workspacePath, input.options);
  const selected = input.paths ? new Set(input.paths) : null;
  for (const change of diff.changes) {
    if (selected && !selected.has(change.path)) continue;
    const target = resolveContained(input.sourcePath, change.path);
    if (change.type === 'deleted') {
      await rm(target, { recursive: true, force: true });
    } else {
      await copyEntry(input.workspacePath, input.sourcePath, change.path);
    }
  }
  return diff;
}

class DefaultSpeculativeWorkspace implements SpeculativeWorkspace {
  constructor(
    readonly id: string,
    readonly sourcePath: string,
    readonly rootPath: string,
    readonly strategy: SpeculativeWorkspaceStrategy,
    readonly sandboxProfilePath: string | null,
    private readonly tempPath: string,
    private readonly scratchPath: string,
    private readonly runner: CommandRunner,
  ) {}

  async run(input: {
    command: string;
    args?: string[];
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    maxBuffer?: number;
    useSandbox?: boolean;
  }): Promise<SpeculativeWorkspaceRunResult> {
    const useSandbox = input.useSandbox !== false && Boolean(this.sandboxProfilePath) && existsSync('/usr/bin/sandbox-exec');
    const command = useSandbox ? '/usr/bin/sandbox-exec' : input.command;
    const args = useSandbox ? ['-f', this.sandboxProfilePath!, input.command, ...(input.args ?? [])] : (input.args ?? []);
    const runEnv = {
      ...process.env,
      ...input.env,
      TMPDIR: this.scratchPath,
      TMP: this.scratchPath,
      TEMP: this.scratchPath,
    };
    const result = await this.runner(command, args, {
      cwd: this.rootPath,
      env: runEnv,
      timeoutMs: input.timeoutMs,
      maxBuffer: input.maxBuffer,
    });
    return {
      command: input.command,
      args: input.args ?? [],
      cwd: this.rootPath,
      exitCode: result.exitCode,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
      sandboxed: useSandbox,
    };
  }

  async diff(options?: SpeculativeWorkspaceDiffOptions): Promise<SpeculativeWorkspaceDiff> {
    return collectSpeculativeWorkspaceDiff(this.sourcePath, this.rootPath, options);
  }

  async apply(input?: { paths?: string[]; options?: SpeculativeWorkspaceDiffOptions }): Promise<SpeculativeWorkspaceDiff> {
    return applySpeculativeWorkspaceChanges({
      sourcePath: this.sourcePath,
      workspacePath: this.rootPath,
      paths: input?.paths,
      options: input?.options,
    });
  }

  async dispose(): Promise<void> {
    await rm(this.tempPath, { recursive: true, force: true });
  }
}

export async function createSpeculativeWorkspace(input: CreateSpeculativeWorkspaceInput): Promise<SpeculativeWorkspace> {
  const sourcePath = resolve(input.sourcePath);
  const stats = await lstat(sourcePath);
  if (!stats.isDirectory()) throw new Error(`Speculative workspace source must be a directory: ${input.sourcePath}`);
  const id = input.id ?? randomUUID();
  const tempPath = await mkdtemp(join(tmpdir(), input.tempPrefix ?? 'neon-pilot-speculative-'));
  const rootPath = join(tempPath, basename(sourcePath) || 'workspace');
  await mkdir(rootPath, { recursive: true });
  const runner = input.commandRunner ?? defaultCommandRunner;
  const platform = input.platform ?? process.platform;
  let strategy: SpeculativeWorkspaceStrategy = 'copy';
  if ((input.cloneStrategy ?? 'auto') !== 'copy' && platform === 'darwin') {
    try {
      await cloneWithApfsCp(sourcePath, rootPath, runner);
      strategy = 'apfs-clone';
    } catch {
      await copyWorkspace(sourcePath, rootPath);
    }
  } else {
    await copyWorkspace(sourcePath, rootPath);
  }
  const scratchPath = join(rootPath, WORKSPACE_SCRATCH_DIR);
  await mkdir(scratchPath, { recursive: true });
  const sandboxProfilePath = platform === 'darwin' ? join(tempPath, 'write-sandbox.sb') : null;
  if (sandboxProfilePath) {
    const writablePaths = [
      ...new Set([rootPath, await realpath(rootPath), scratchPath, await realpath(scratchPath), ...(input.writablePaths ?? [])]),
    ];
    await writeFile(sandboxProfilePath, createMacWriteSandboxProfile({ writablePaths }), 'utf8');
  }
  return new DefaultSpeculativeWorkspace(id, sourcePath, rootPath, strategy, sandboxProfilePath, tempPath, scratchPath, runner);
}
