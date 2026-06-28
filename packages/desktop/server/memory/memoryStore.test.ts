import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createMemoryScope,
  getActiveMemoryInstructionFiles,
  getMemoryState,
  initializeMemory,
  listMemoryFileHistory,
  writeMemoryFile,
} from './memoryStore.js';

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
});
