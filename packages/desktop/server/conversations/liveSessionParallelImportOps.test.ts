import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ existsSync: vi.fn(() => true) }));
const logging = vi.hoisted(() => ({ logWarn: vi.fn() }));
const git = vi.hoisted(() => ({ readGitRepoInfo: vi.fn(() => ({ root: '/repo' })) }));
const forking = vi.hoisted(() => ({
  buildParallelImportedContent: vi.fn((job) => `content:${job.id}`),
  resolveStableForkEntryId: vi.fn(() => 'entry-1'),
}));
const jobs = vi.hoisted(() => ({ normalizeParallelPromptList: vi.fn((value) => (Array.isArray(value) ? value.slice(0, 12) : [])) }));
const reconciliation = vi.hoisted(() => ({
  readParallelCurrentWorktreeDirtyPaths: vi.fn(() => ['dirty.ts']),
  readParallelJobCompletionFromSessionFile: vi.fn(() => ({
    status: 'ready',
    resultText: 'done',
    touchedFiles: ['child.ts'],
    sideEffects: ['ran tests'],
  })),
  replacePersistedParallelJob: vi.fn((_source, _jobId, update) => [
    update({ id: _jobId, status: 'running', childConversationId: 'child-1' }),
  ]),
}));

vi.mock('node:fs', () => fs);
vi.mock('../shared/logging.js', () => logging);
vi.mock('../workspace/gitStatus.js', () => git);
vi.mock('./liveSessionForking.js', () => forking);
vi.mock('./liveSessionParallelJobs.js', () => jobs);
vi.mock('./liveSessionParallelReconciliation.js', () => reconciliation);

import {
  createRunningParallelPromptJob,
  finalizeParallelChildLiveSession,
  handleParallelPromptCompletion,
  manageParallelPromptJob,
  shouldPreserveParallelChildLiveSession,
  startParallelPromptSession,
  tryImportReadyParallelJobs,
} from './liveSessionParallelImportOps.js';

describe('live session parallel import operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));
    fs.existsSync.mockReturnValue(true);
    forking.resolveStableForkEntryId.mockReturnValue('entry-1');
  });

  function entry(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: 'parent',
      cwd: '/repo',
      session: { isStreaming: true, sessionFile: '/sessions/parent.jsonl', model: { id: 'model-1' }, thinkingLevel: 'high' },
      parallelJobs: [],
      ...overrides,
    };
  }

  it('creates running jobs with normalized lists and dirty paths', () => {
    expect(
      createRunningParallelPromptJob({
        id: 'job-1',
        prompt: 'prompt',
        childConversationId: 'child',
        childSessionFile: '/child.jsonl',
        imageCount: 2,
        attachmentRefs: ['a'],
        forkEntryId: 'entry-1',
        repoRoot: '/repo',
        cwd: '/repo',
      }),
    ).toMatchObject({
      id: 'job-1',
      status: 'running',
      createdAt: '2026-05-22T12:00:00.000Z',
      updatedAt: '2026-05-22T12:00:00.000Z',
      imageCount: 2,
      attachmentRefs: ['a'],
      forkEntryId: 'entry-1',
      repoRoot: '/repo',
      worktreeDirtyPathsAtStart: ['dirty.ts'],
    });
  });

  it('starts a parallel prompt by forking a stable entry and scheduling completion handling', async () => {
    const e = entry();
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    const callbacks = {
      createJobId: vi.fn(() => 'job-1'),
      createSession: vi.fn(),
      forkSession: vi.fn(async () => ({ newSessionId: 'child-1', sessionFile: '/sessions/child.jsonl' })),
      queuePromptContext: vi.fn(async () => undefined),
      submitPromptSession: vi.fn(async () => ({ acceptedAs: 'started', completion })),
      resolveDefaultServiceTier: vi.fn(() => 'auto'),
      hasQueuedOrActiveStaleTurn: vi.fn(() => false),
      persistParallelJobs: vi.fn(),
      broadcastParallelState: vi.fn(),
      getCurrentEntry: vi.fn(() => e),
      resolveParallelChildSession: vi.fn(),
      tryImportReadyParallelJobs: vi.fn(async () => undefined),
    };

    await expect(
      startParallelPromptSession(
        e as never,
        { text: ' prompt ', contextMessages: [{ customType: 'ctx', content: 'context' }] },
        { model: 'm1' } as never,
        callbacks,
      ),
    ).resolves.toEqual({ jobId: 'job-1', childConversationId: 'child-1' });
    expect(callbacks.forkSession).toHaveBeenCalledWith('parent', 'entry-1', {
      preserveSource: true,
      cwdOverride: '/repo',
      model: 'm1',
    });
    expect(callbacks.queuePromptContext).toHaveBeenCalledWith('child-1', 'ctx', 'context');
    expect(callbacks.submitPromptSession).toHaveBeenCalledWith('child-1', 'prompt', undefined, undefined, undefined, undefined, undefined);
    expect(e.parallelJobs[0]).toMatchObject({
      id: 'job-1',
      prompt: 'prompt',
      childConversationId: 'child-1',
      childSessionFile: '/sessions/child.jsonl',
    });

    resolveCompletion();
    await vi.runAllTicks();
    await Promise.resolve();
    expect(reconciliation.replacePersistedParallelJob).toHaveBeenCalled();
  });

  it('runs parallel child prompts in an overridden cwd while tracking parent dirtiness from the source cwd', async () => {
    const e = entry({ cwd: '/repo/source' });
    const callbacks = {
      createJobId: vi.fn(() => 'job-1'),
      createSession: vi.fn(async () => ({ id: 'child-created', sessionFile: '/sessions/created.jsonl' })),
      forkSession: vi.fn(async () => ({ newSessionId: 'child-1', sessionFile: '/sessions/child.jsonl' })),
      queuePromptContext: vi.fn(async () => undefined),
      submitPromptSession: vi.fn(async () => ({ acceptedAs: 'started' as const, completion: Promise.resolve() })),
      resolveDefaultServiceTier: vi.fn(() => 'auto'),
      hasQueuedOrActiveStaleTurn: vi.fn(() => true),
      persistParallelJobs: vi.fn(),
      broadcastParallelState: vi.fn(),
      getCurrentEntry: vi.fn(() => e),
      resolveParallelChildSession: vi.fn(),
      tryImportReadyParallelJobs: vi.fn(async () => undefined),
    };

    await startParallelPromptSession(e as never, { text: 'prompt', cwd: '/tmp/speculative/source' }, {} as never, callbacks);

    expect(callbacks.forkSession).toHaveBeenCalledWith(
      'parent',
      'entry-1',
      expect.objectContaining({ preserveSource: true, cwdOverride: '/tmp/speculative/source' }),
    );
    expect(reconciliation.readParallelCurrentWorktreeDirtyPaths).toHaveBeenCalledWith('/repo/source', '/repo');
  });

  it('validates start inputs and rolls back jobs on submit failure', async () => {
    const baseCallbacks = {
      createJobId: vi.fn(() => 'job-1'),
      createSession: vi.fn(async () => ({ id: 'child-created', sessionFile: '/sessions/created.jsonl' })),
      forkSession: vi.fn(async () => ({ newSessionId: 'child-1', sessionFile: '/sessions/child.jsonl' })),
      queuePromptContext: vi.fn(async () => undefined),
      submitPromptSession: vi.fn(async () => {
        throw new Error('submit failed');
      }),
      resolveDefaultServiceTier: vi.fn(() => 'auto'),
      hasQueuedOrActiveStaleTurn: vi.fn(() => true),
      persistParallelJobs: vi.fn(),
      broadcastParallelState: vi.fn(),
      getCurrentEntry: vi.fn(),
      resolveParallelChildSession: vi.fn(),
      tryImportReadyParallelJobs: vi.fn(),
    };

    await expect(startParallelPromptSession(entry() as never, { text: '   ' }, {} as never, baseCallbacks)).rejects.toThrow(
      'text, images, videos, audio, or documents required',
    );
    await expect(
      startParallelPromptSession(
        entry({ session: { isStreaming: true, sessionFile: '' } }) as never,
        { text: 'prompt' },
        {} as never,
        baseCallbacks,
      ),
    ).rejects.toThrow('Parallel prompts require a persisted session file.');
    await expect(
      startParallelPromptSession(
        entry({ session: { isStreaming: false, sessionFile: '/sessions/parent.jsonl' } }) as never,
        { text: 'prompt' },
        {} as never,
        { ...baseCallbacks, hasQueuedOrActiveStaleTurn: vi.fn(() => false) },
      ),
    ).rejects.toThrow('Parallel prompts are only available while the conversation is busy.');

    const e = entry();
    await expect(startParallelPromptSession(e as never, { text: 'prompt' }, {} as never, baseCallbacks)).rejects.toThrow('submit failed');
    expect(e.parallelJobs).toEqual([]);
    expect(baseCallbacks.persistParallelJobs).toHaveBeenCalled();
  });

  it('updates current entry when completion is handled and skips stale parent entries', async () => {
    const e = entry({ session: { isStreaming: false, sessionFile: '/sessions/parent.jsonl' } });
    const input = {
      sourceSessionFile: '/sessions/parent.jsonl',
      jobId: 'job-1',
      childSessionFile: '/sessions/child.jsonl',
      cwd: '/repo',
      repoRoot: '/repo',
      getCurrentEntry: vi.fn(() => e),
      resolveParallelChildSession: vi.fn(),
      broadcastParallelState: vi.fn(),
      tryImportReadyParallelJobs: vi.fn(async () => undefined),
    };
    await handleParallelPromptCompletion(input as never);
    expect(e.parallelJobs).toHaveLength(1);
    expect(input.broadcastParallelState).toHaveBeenCalledWith(e, true);
    expect(input.tryImportReadyParallelJobs).toHaveBeenCalledWith(e);

    const stale = entry({ session: { sessionFile: '/sessions/other.jsonl' } });
    await handleParallelPromptCompletion({ ...input, getCurrentEntry: vi.fn(() => stale) } as never);
    expect(stale.parallelJobs).toEqual([]);
  });

  it('finalizes child sessions based on presence, listeners, and streaming state', async () => {
    expect(shouldPreserveParallelChildLiveSession(undefined)).toBe(false);
    expect(shouldPreserveParallelChildLiveSession({ listeners: new Set([{}]), session: { isStreaming: false } } as never)).toBe(true);
    await expect(finalizeParallelChildLiveSession('missing', { childEntry: undefined, destroySession: vi.fn() })).resolves.toBe('missing');
    await expect(
      finalizeParallelChildLiveSession('child', {
        childEntry: { listeners: new Set([{}]), session: { isStreaming: false, abort: vi.fn() } },
        destroySession: vi.fn(),
      }),
    ).resolves.toBe('preserved');

    const destroySession = vi.fn();
    await expect(
      finalizeParallelChildLiveSession('child', {
        childEntry: { listeners: new Set(), session: { isStreaming: false, abort: vi.fn() } },
        destroySession,
      }),
    ).resolves.toBe('destroyed');
    expect(destroySession).toHaveBeenCalledWith('child');

    const abortError = new Error('abort failed');
    await expect(
      finalizeParallelChildLiveSession('child', {
        childEntry: {
          listeners: new Set(),
          session: {
            isStreaming: true,
            abort: vi.fn(async () => {
              throw abortError;
            }),
          },
        },
        destroySession: vi.fn(),
        abortIfRunning: true,
      }),
    ).resolves.toBe('destroyed');
    expect(logging.logWarn).toHaveBeenCalledWith(
      'parallel child abort failed before cleanup',
      expect.objectContaining({ conversationId: 'child', message: 'abort failed' }),
    );
  });

  it('imports ready jobs sequentially and restores status on append failure', async () => {
    const e = entry({
      session: { isStreaming: false, sessionFile: '/sessions/parent.jsonl' },
      parallelJobs: [{ id: 'job-1', status: 'ready', childConversationId: 'child-1', prompt: 'p' }],
    });
    const callbacks = {
      hasQueuedOrActiveStaleTurn: vi.fn(() => false),
      persistParallelJobs: vi.fn(),
      broadcastParallelState: vi.fn(),
      appendParallelImportedMessage: vi.fn(async () => undefined),
      finalizeParallelChildLiveSession: vi.fn(async () => 'destroyed'),
    };
    await tryImportReadyParallelJobs(e as never, callbacks as never);
    expect(callbacks.appendParallelImportedMessage).toHaveBeenCalledWith('parent', 'content:job-1', {
      childConversationId: 'child-1',
      status: 'complete',
    });
    expect(e.parallelJobs).toEqual([]);

    const failing = entry({
      session: { isStreaming: false },
      parallelJobs: [{ id: 'job-2', status: 'failed', childConversationId: 'child-2', prompt: 'p', error: 'boom' }],
    });
    const failingCallbacks = {
      ...callbacks,
      appendParallelImportedMessage: vi.fn(async () => {
        throw new Error('append failed');
      }),
    };
    await expect(tryImportReadyParallelJobs(failing as never, failingCallbacks as never)).rejects.toThrow('append failed');
    expect(failing.parallelJobs[0]).toMatchObject({ id: 'job-2', status: 'failed' });
    expect(failing.importingParallelJobs).toBe(false);
  });

  it('manages skip, cancel, import-now, and validation cases', async () => {
    const callbacks = {
      persistParallelJobs: vi.fn(),
      broadcastParallelState: vi.fn(),
      finalizeParallelChildLiveSession: vi.fn(async () => 'destroyed'),
      tryImportReadyParallelJobs: vi.fn(async (entry) => {
        entry.parallelJobs = [];
      }),
    };
    await expect(
      manageParallelPromptJob(entry({ parallelJobs: [] }) as never, { jobId: ' ', action: 'skip' }, callbacks as never),
    ).rejects.toThrow('jobId required');
    await expect(
      manageParallelPromptJob(entry({ parallelJobs: [] }) as never, { jobId: 'missing', action: 'skip' }, callbacks as never),
    ).rejects.toThrow('Parallel prompt no longer exists.');
    await expect(
      manageParallelPromptJob(
        entry({ parallelJobs: [{ id: 'job-1', status: 'running', childConversationId: 'child' }] }) as never,
        { jobId: 'job-1', action: 'skip' },
        callbacks as never,
      ),
    ).rejects.toThrow('Use cancel to stop a running parallel prompt.');
    await expect(
      manageParallelPromptJob(
        entry({
          parallelJobs: [{ id: 'job-1', status: 'ready', childConversationId: 'child', ownerExtensionId: 'arena-ext' }],
        }) as never,
        { jobId: 'job-1', action: 'skip', callerExtensionId: 'other-ext' },
        callbacks as never,
      ),
    ).rejects.toThrow('Parallel prompt is owned by another extension.');

    await expect(
      manageParallelPromptJob(
        entry({ parallelJobs: [{ id: 'job-1', status: 'ready', childConversationId: 'child' }] }) as never,
        { jobId: 'job-1', action: 'skip' },
        callbacks as never,
      ),
    ).resolves.toEqual({ ok: true, status: 'skipped' });
    await expect(
      manageParallelPromptJob(
        entry({ parallelJobs: [{ id: 'job-1', status: 'running', childConversationId: 'child' }] }) as never,
        { jobId: 'job-1', action: 'cancel' },
        callbacks as never,
      ),
    ).resolves.toEqual({ ok: true, status: 'cancelled' });
    await expect(
      manageParallelPromptJob(
        entry({ parallelJobs: [{ id: 'job-1', status: 'ready', childConversationId: 'child' }] }) as never,
        { jobId: 'job-1', action: 'importNow' },
        callbacks as never,
      ),
    ).resolves.toEqual({ ok: true, status: 'imported' });
  });
});
