import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  existsSync: vi.fn((p: string) => fs.files.has(p)),
  readFileSync: vi.fn((p: string) => fs.files.get(p) ?? ''),
}));
const git = vi.hoisted(() => ({
  readGitRepoInfo: vi.fn(() => ({ root: '/repo' })),
  readGitStatusSummary: vi.fn(() => ({ changes: [{ relativePath: 'src/dirty.ts' }] })),
}));
const forking = vi.hoisted(() => ({
  extractTextFromMessageContent: vi.fn((content) => (typeof content === 'string' ? content.trim() : 'reply text')),
  getStableForkBranchEntries: vi.fn(() => []),
}));
const jobs = vi.hoisted(() => ({
  normalizeParallelPromptList: vi.fn((value) => (Array.isArray(value) ? [...new Set(value.filter(Boolean))] : [])),
  readPersistedParallelJobs: vi.fn(() => []),
  truncateParallelPreviewText: vi.fn((text: string) => text.slice(0, 200)),
  writePersistedParallelJobs: vi.fn(),
}));
const sessions = vi.hoisted(() => ({
  readSessionBlocksByFile: vi.fn(() => ({ blocks: [] })),
  readSessionMetaByFile: vi.fn(() => ({ cwd: '/repo' })),
}));

vi.mock('node:fs', () => fs);
vi.mock('../workspace/gitStatus.js', () => git);
vi.mock('./liveSessionForking.js', () => forking);
vi.mock('./liveSessionParallelJobs.js', () => jobs);
vi.mock('./sessions.js', () => sessions);

import {
  loadPersistedParallelJobs,
  readImportedParallelChildConversationIds,
  readParallelCurrentWorktreeDirtyPaths,
  readParallelJobCompletionFromSessionFile,
  reconcileParallelPromptJob,
  reconcilePersistedParallelJobs,
  replacePersistedParallelJob,
} from './liveSessionParallelReconciliation.js';

describe('live session parallel reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.files.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));
    git.readGitRepoInfo.mockReturnValue({ root: '/repo' });
    git.readGitStatusSummary.mockReturnValue({ changes: [{ relativePath: 'src/dirty.ts' }] });
    sessions.readSessionMetaByFile.mockReturnValue({ cwd: '/repo' });
  });

  it('reads imported parallel child ids from visible parallel result custom messages', () => {
    fs.files.set(
      '/parent.jsonl',
      [
        '{bad json}',
        JSON.stringify({ type: 'custom_message', customType: 'parallel_result', details: { childConversationId: ' child-1 ' } }),
        JSON.stringify({ type: 'custom_message', customType: 'other', details: { childConversationId: 'child-2' } }),
      ].join('\n'),
    );
    expect(readImportedParallelChildConversationIds('/parent.jsonl')).toEqual(new Set(['child-1']));
    expect(readImportedParallelChildConversationIds('/missing.jsonl')).toEqual(new Set());
  });

  it('reads dirty worktree paths only when cwd and git metadata are available', () => {
    expect(readParallelCurrentWorktreeDirtyPaths('/repo')).toEqual(['src/dirty.ts']);
    expect(readParallelCurrentWorktreeDirtyPaths('   ')).toEqual([]);
    git.readGitStatusSummary.mockReturnValueOnce(null);
    expect(readParallelCurrentWorktreeDirtyPaths('/repo')).toEqual([]);
  });

  it('reads completion, touched files, and side effects from child session files', () => {
    forking.getStableForkBranchEntries.mockReturnValue([
      {
        id: 'tool',
        type: 'message',
        message: {
          role: 'assistant',
          content: [{ type: 'toolCall', name: 'write', arguments: { path: '/repo/src/a.ts' } }],
          stopReason: 'toolUse',
        },
      },
      { id: 'reply', type: 'message', message: { role: 'assistant', content: ' done ', stopReason: 'stop' } },
    ]);
    sessions.readSessionBlocksByFile.mockReturnValue({
      blocks: [{ type: 'tool_use', tool: 'artifact', input: { action: 'save' }, details: {}, output: 'saved artifact\nmore' }],
    });

    expect(readParallelJobCompletionFromSessionFile('/child.jsonl', { cwd: '/repo', repoRoot: '/repo' })).toEqual({
      hasTerminalReply: true,
      status: 'ready',
      resultText: 'done',
      touchedFiles: ['src/a.ts'],
      sideEffects: ['saved artifact'],
    });

    forking.getStableForkBranchEntries.mockReturnValueOnce([
      { id: 'err', type: 'message', message: { role: 'assistant', stopReason: 'error', errorMessage: ' boom ' } },
    ]);
    expect(readParallelJobCompletionFromSessionFile('/child.jsonl').status).toBe('failed');
  });

  it('reconciles running, ready, failed, interrupted, and importing jobs', () => {
    const baseJob = {
      id: 'job-1',
      childConversationId: 'child-1',
      status: 'running',
      childSessionFile: '/child.jsonl',
      prompt: 'p',
      updatedAt: 'old',
      worktreeDirtyPathsAtStart: [],
    };
    fs.files.set('/child.jsonl', 'child');
    forking.getStableForkBranchEntries.mockReturnValue([
      { id: 'reply', type: 'message', message: { role: 'assistant', content: 'done', stopReason: 'stop' } },
    ]);
    expect(reconcileParallelPromptJob('/parent.jsonl', baseJob as never)).toMatchObject({
      status: 'ready',
      resultText: 'done',
      updatedAt: '2026-05-22T12:00:00.000Z',
    });

    forking.getStableForkBranchEntries.mockReturnValue([
      { id: 'err', type: 'message', message: { role: 'assistant', stopReason: 'error', errorMessage: 'nope' } },
    ]);
    expect(reconcileParallelPromptJob('/parent.jsonl', baseJob as never)).toMatchObject({ status: 'failed', error: 'nope' });

    expect(reconcileParallelPromptJob('/parent.jsonl', { ...baseJob, childSessionFile: '/missing.jsonl' } as never)).toMatchObject({
      status: 'failed',
      error: 'Parallel prompt was interrupted before producing a final reply.',
    });
    expect(
      reconcileParallelPromptJob('/parent.jsonl', {
        ...baseJob,
        status: 'importing',
        error: 'bad',
        childSessionFile: '/missing.jsonl',
      } as never),
    ).toMatchObject({ status: 'failed' });
    expect(
      reconcileParallelPromptJob('/parent.jsonl', baseJob as never, () => ({ sessionFile: '/child.jsonl', isStreaming: true })),
    ).toMatchObject({ status: 'running' });
  });

  it('filters imported jobs and persists replacements/load results', () => {
    fs.files.set(
      '/parent.jsonl',
      JSON.stringify({ type: 'custom_message', customType: 'parallel_result', details: { childConversationId: 'imported-child' } }),
    );
    jobs.readPersistedParallelJobs.mockReturnValue([
      { id: 'job-1', childConversationId: 'imported-child', status: 'ready' },
      { id: 'job-2', childConversationId: 'child-2', status: 'ready' },
    ]);

    expect(reconcilePersistedParallelJobs('/parent.jsonl', jobs.readPersistedParallelJobs())).toHaveLength(1);
    expect(replacePersistedParallelJob('/parent.jsonl', 'job-2', (job) => ({ ...job, status: 'failed', error: 'x' }))).toHaveLength(1);
    expect(jobs.writePersistedParallelJobs).toHaveBeenCalledWith('/parent.jsonl', expect.any(Array));

    expect(loadPersistedParallelJobs(undefined)).toEqual([]);
    expect(loadPersistedParallelJobs(' /parent.jsonl ')).toHaveLength(1);
  });
});
