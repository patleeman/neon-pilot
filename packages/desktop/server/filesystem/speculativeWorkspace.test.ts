import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  applySpeculativeWorkspaceChanges,
  collectSpeculativeWorkspaceDiff,
  createMacWriteSandboxProfile,
  createSpeculativeWorkspace,
  type CreateSpeculativeWorkspaceInput,
} from './speculativeWorkspace.js';

const dirs: string[] = [];

function tempDir(prefix = 'speculative-workspace-test-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function makeSource(): string {
  const source = tempDir();
  writeFileSync(join(source, 'keep.txt'), 'same');
  writeFileSync(join(source, 'edit.txt'), 'before');
  writeFileSync(join(source, 'delete.txt'), 'remove me');
  writeFileSync(join(source, '.DS_Store'), 'noise');
  mkdirSync(join(source, '.git'), { recursive: true });
  writeFileSync(join(source, '.git', 'config'), 'do not compare');
  mkdirSync(join(source, 'nested'), { recursive: true });
  writeFileSync(join(source, 'nested', 'file.txt'), 'nested');
  symlinkSync('keep.txt', join(source, 'link.txt'));
  return source;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('speculative workspace', () => {
  it('creates a copy workspace, diffs changes, and applies selected changes back', async () => {
    const source = makeSource();
    const workspace = await createSpeculativeWorkspace({ sourcePath: source, cloneStrategy: 'copy', platform: 'linux' });
    dirs.push(workspace.rootPath);

    writeFileSync(join(workspace.rootPath, 'edit.txt'), 'after');
    writeFileSync(join(workspace.rootPath, 'new.txt'), 'new');
    writeFileSync(join(workspace.rootPath, '._new.txt'), 'appledouble noise');
    writeFileSync(join(workspace.rootPath, '.git', 'config'), 'changed but ignored');
    await rm(join(workspace.rootPath, 'delete.txt'));
    await rm(join(workspace.rootPath, 'link.txt'));
    symlinkSync('nested/file.txt', join(workspace.rootPath, 'link.txt'));

    const diff = await workspace.diff();

    expect(diff.summary).toEqual({ added: 1, modified: 2, deleted: 1 });
    expect(diff.changes).toEqual([
      { path: 'delete.txt', type: 'deleted', kind: 'file' },
      { path: 'edit.txt', type: 'modified', kind: 'file' },
      { path: 'link.txt', type: 'modified', kind: 'symlink' },
      { path: 'new.txt', type: 'added', kind: 'file' },
    ]);
    expect(readFileSync(join(source, 'edit.txt'), 'utf8')).toBe('before');

    await workspace.apply({ paths: ['edit.txt', 'new.txt'] });

    expect(readFileSync(join(source, 'edit.txt'), 'utf8')).toBe('after');
    expect(readFileSync(join(source, 'new.txt'), 'utf8')).toBe('new');
    expect(readFileSync(join(source, 'delete.txt'), 'utf8')).toBe('remove me');
    expect(readFileSync(join(source, '.git', 'config'), 'utf8')).toBe('do not compare');
    await workspace.dispose();
    expect(existsSync(workspace.rootPath)).toBe(false);
  });

  it('uses APFS clone on macOS when available and falls back to copy when clone fails', async () => {
    const source = makeSource();
    const calls: Array<{ command: string; args: string[] }> = [];
    const cloneInput: CreateSpeculativeWorkspaceInput = {
      sourcePath: source,
      platform: 'darwin',
      commandRunner: async (command, args) => {
        calls.push({ command, args });
        return { exitCode: 1, signal: null, stdout: '', stderr: 'clone unavailable' };
      },
    };

    const workspace = await createSpeculativeWorkspace(cloneInput);

    expect(calls).toEqual([{ command: '/bin/cp', args: ['-cR', `${source}/.`, `${workspace.rootPath}/`] }]);
    expect(workspace.strategy).toBe('copy');
    expect(workspace.sandboxProfilePath).toEqual(expect.stringContaining('write-sandbox.sb'));
    expect(readFileSync(join(workspace.rootPath, 'keep.txt'), 'utf8')).toBe('same');
    await workspace.dispose();
  });

  it('wraps run commands with sandbox-exec only when a macOS sandbox profile is available', async () => {
    const source = makeSource();
    const calls: Array<{ command: string; args: string[]; cwd?: string; env?: NodeJS.ProcessEnv }> = [];
    const workspace = await createSpeculativeWorkspace({
      sourcePath: source,
      platform: 'darwin',
      cloneStrategy: 'copy',
      commandRunner: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd, env: options.env });
        return { exitCode: 0, signal: null, stdout: 'ok', stderr: '' };
      },
    });

    const result = await workspace.run({ command: '/bin/sh', args: ['-lc', 'echo ok'], useSandbox: true });

    if (existsSync('/usr/bin/sandbox-exec')) {
      expect(calls.at(-1)).toEqual({
        command: '/usr/bin/sandbox-exec',
        args: ['-f', workspace.sandboxProfilePath!, '/bin/sh', '-lc', 'echo ok'],
        cwd: workspace.rootPath,
        env: expect.objectContaining({ PATH: process.env.PATH, TMPDIR: expect.stringContaining('.neon-pilot-tmp') }),
      });
      expect(result.sandboxed).toBe(true);
    } else {
      expect(calls.at(-1)).toEqual({
        command: '/bin/sh',
        args: ['-lc', 'echo ok'],
        cwd: workspace.rootPath,
        env: expect.objectContaining({ PATH: process.env.PATH, TMPDIR: expect.stringContaining('.neon-pilot-tmp') }),
      });
      expect(result.sandboxed).toBe(false);
    }
    await workspace.dispose();
  });

  it('builds a deny-write sandbox profile with explicit writable roots', () => {
    const profile = createMacWriteSandboxProfile({ writablePaths: ['/tmp/speculative "quoted"', '/repo'] });

    expect(profile).toContain('(allow default)');
    expect(profile).toContain('(deny file-write*)');
    expect(profile).toContain('(allow file-write* (literal "/dev/null"))');
    expect(profile).toContain('(allow file-write* (subpath "/repo"))');
    expect(profile).toContain('(allow file-write* (subpath "/tmp/speculative \\"quoted\\""))');
  });

  it('can diff and apply without constructing a workspace instance', async () => {
    const source = makeSource();
    const workspace = tempDir();
    await mkdir(workspace, { recursive: true });
    writeFileSync(join(workspace, 'edit.txt'), 'direct');
    writeFileSync(join(workspace, 'keep.txt'), 'same');
    writeFileSync(join(workspace, 'nested.txt'), 'new');

    const diff = await collectSpeculativeWorkspaceDiff(source, workspace);
    await applySpeculativeWorkspaceChanges({ sourcePath: source, workspacePath: workspace, paths: ['edit.txt'] });

    expect(diff.changes.some((change) => change.path === 'nested.txt' && change.type === 'added')).toBe(true);
    expect(readFileSync(join(source, 'edit.txt'), 'utf8')).toBe('direct');
    expect(existsSync(join(source, 'nested.txt'))).toBe(false);
  });
});
