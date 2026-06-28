import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMemoryScope,
  getActiveMemoryInstructionFiles,
  getMemoryState,
  importKnowledgeMemoryDocs,
  initializeMemory,
  listMemoryFileHistory,
  setMemoryRemote,
  syncMemoryRemote,
  writeMemoryFile,
} from './memoryStore.js';

vi.mock('../knowledge/memoryDocs.js', () => ({
  listMemoryDocs: vi.fn(() => [
    {
      id: 'qa-note',
      title: 'QA Note',
      path: '/knowledge/notes/qa-note.md',
      summary: 'Imported note summary.',
      updated: '2026-06-28T12:00:00.000Z',
    },
  ]),
}));

const originalEnv = process.env;
const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-memory-'));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  const root = tempRoot();
  process.env = {
    ...originalEnv,
    NEON_PILOT_KNOWLEDGE_ROOT: join(root, 'knowledge'),
    NEON_PILOT_STATE_ROOT: join(root, 'state'),
  };
});

afterEach(() => {
  process.env = originalEnv;
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('memory store', () => {
  it('initializes a git-backed markdown memory folder', async () => {
    const state = await initializeMemory({ cwd: '/work/app' });

    expect(state.initialized).toBe(true);
    expect(existsSync(join(state.root, '.git'))).toBe(true);
    expect(existsSync(join(state.root, 'system.md'))).toBe(true);
    expect(existsSync(join(state.root, 'scopes'))).toBe(true);
    expect(existsSync(join(state.root, 'skills'))).toBe(true);
    expect(existsSync(join(state.root, 'reflections'))).toBe(true);
    expect(state.recentChanges[0]?.subject).toBe('chore: initialize memory');
    expect(readFileSync(join(state.root, 'system.md'), 'utf-8')).toContain('# System Memory');
  });

  it('creates active cwd scopes and injects system plus active scope memory', async () => {
    await initializeMemory();
    const state = await createMemoryScope({
      name: 'Neon Pilot',
      roots: ['/Users/patrick/workingdir/neon-pilot'],
      aliases: ['neon pilot'],
      reason: 'Add Neon Pilot memory',
    });

    expect(state.scopes).toHaveLength(1);
    expect(state.scopes[0]).toMatchObject({
      slug: 'neon-pilot',
      name: 'Neon Pilot',
      aliases: ['neon pilot'],
      roots: ['/Users/patrick/workingdir/neon-pilot'],
    });

    const activeState = await getMemoryState({ cwd: '/Users/patrick/workingdir/neon-pilot/packages/desktop' });
    expect(activeState.scopes[0]?.active).toBe(true);
    expect(
      getActiveMemoryInstructionFiles({ cwd: '/Users/patrick/workingdir/neon-pilot/packages/desktop' }).map((file) => file.title),
    ).toEqual(['system.md', 'Neon Pilot memory']);
  });

  it('commits memory file writes and returns per-file history', async () => {
    await initializeMemory();
    await writeMemoryFile({
      relativePath: 'system.md',
      content: '# System Memory\n\nRemember concise output.\n',
      reason: 'Remember concise output',
    });

    const state = await getMemoryState();
    expect(state.system.content).toContain('Remember concise output.');
    expect(state.recentChanges[0]?.subject).toBe('Remember concise output');

    const history = await listMemoryFileHistory('system.md');
    expect(history.map((entry) => entry.subject)).toEqual(expect.arrayContaining(['Remember concise output', 'chore: initialize memory']));
  });

  it('rejects writes outside editable memory files', async () => {
    await initializeMemory();
    await expect(writeMemoryFile({ relativePath: '../escape.md', content: 'bad' })).rejects.toThrow('Memory path must stay inside');
    await expect(writeMemoryFile({ relativePath: 'archive/old.md', content: 'bad' })).rejects.toThrow('Memory path is not editable');
  });

  it('rejects invalid memory frontmatter before writing', async () => {
    await initializeMemory();

    await expect(
      writeMemoryFile({
        relativePath: 'scopes/broken/memory.md',
        content: '---\nroots: nope: bad\n---\n# Broken\n',
      }),
    ).rejects.toThrow('Invalid frontmatter');
  });

  it('sets and syncs a git remote', async () => {
    const remote = join(tempRoot(), 'remote.git');
    await initializeMemory();
    await import('node:child_process').then(({ execFileSync }) => execFileSync('git', ['init', '--bare', remote]));

    const configured = await setMemoryRemote(remote);
    expect(configured.git.remoteUrl).toBe(remote);

    await writeMemoryFile({ relativePath: 'system.md', content: '# System Memory\n\nSynced.\n', reason: 'Sync memory' });
    const synced = await syncMemoryRemote();
    expect(synced.git.remoteUrl).toBe(remote);
    expect(synced.git.ahead).toBe(0);
  });

  it('refuses to commit dirty memory changes when the remote is ahead', async () => {
    const remote = join(tempRoot(), 'remote.git');
    const remoteWorktree = join(tempRoot(), 'remote-worktree');
    const { execFileSync } = await import('node:child_process');

    await initializeMemory();
    execFileSync('git', ['init', '--bare', remote]);
    await setMemoryRemote(remote);
    await syncMemoryRemote();

    execFileSync('git', ['clone', '--branch', 'main', remote, remoteWorktree]);
    writeFileSync(join(remoteWorktree, 'remote-note.md'), 'remote\n', 'utf-8');
    execFileSync('git', ['-C', remoteWorktree, 'add', 'remote-note.md']);
    execFileSync('git', [
      '-C',
      remoteWorktree,
      '-c',
      'user.name=Remote',
      '-c',
      'user.email=remote@example.test',
      'commit',
      '-m',
      'Remote update',
    ]);
    execFileSync('git', ['-C', remoteWorktree, 'push', 'origin', 'main']);

    writeFileSync(join(getMemoryRootForTest(), 'system.md'), '# System Memory\n\nDirty local edit.\n', 'utf-8');
    const beforeHead = execFileSync('git', ['-C', getMemoryRootForTest(), 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();

    await expect(syncMemoryRemote()).rejects.toThrow('remote has new commits');
    const afterHead = execFileSync('git', ['-C', getMemoryRootForTest(), 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
    expect(afterHead).toBe(beforeHead);
  });

  it('imports legacy knowledge notes into a non-injected scope', async () => {
    await initializeMemory();
    await writeMemoryFile({
      relativePath: 'system.md',
      content: '# System Memory\n\n',
      reason: 'Keep system empty',
    });

    const result = await importKnowledgeMemoryDocs();
    const imported = result.state.scopes.find((scope) => scope.slug === 'imported-knowledge');

    expect(imported).toMatchObject({ inject: false, type: 'legacy-knowledge' });
    expect(imported?.content).toContain('Legacy knowledge notes imported for review');
    expect(imported?.content).toContain('Imported note summary.');
  });

  it('preserves user edits outside the legacy import marker block on re-import', async () => {
    await initializeMemory();
    await importKnowledgeMemoryDocs();
    const importedPath = join(getMemoryRootForTest(), 'scopes', 'imported-knowledge', 'memory.md');
    writeFileSync(importedPath, `${readFileSync(importedPath, 'utf-8')}\n## Curated Notes\n\nKeep this user edit.\n`, 'utf-8');
    await importKnowledgeMemoryDocs();

    const content = readFileSync(importedPath, 'utf-8');
    expect(content).toContain('Keep this user edit.');
    expect(content).toContain('Imported note summary.');
  });
});

function getMemoryRootForTest(): string {
  return join(process.env.NEON_PILOT_KNOWLEDGE_ROOT!, 'memory');
}
