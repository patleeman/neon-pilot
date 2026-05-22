import { beforeEach, describe, expect, it, vi } from 'vitest';

const logging = vi.hoisted(() => ({ logWarn: vi.fn() }));
vi.mock('../shared/logging.js', () => logging);

import { applyPendingLiveSessionWorkingDirectoryChange, requestLiveSessionWorkingDirectoryChange } from './liveSessionCwdChange.js';

describe('live session working directory changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function entry(cwd = '/repo') {
    return { sessionId: 's1', cwd, session: {} };
  }

  it('validates request inputs and live persisted session requirements', () => {
    const registry = new Map([['s1', entry()]]);
    const pendingChanges = new Map();
    const base = { cwd: '/next', loaderOptions: {}, registry, pendingChanges, resolveSessionFile: vi.fn(() => '/sessions/s1.json') };

    expect(() => requestLiveSessionWorkingDirectoryChange({ ...base, conversationId: '   ' })).toThrow('conversationId is required.');
    expect(() => requestLiveSessionWorkingDirectoryChange({ ...base, conversationId: 's1', cwd: '   ' })).toThrow('cwd is required.');
    expect(() => requestLiveSessionWorkingDirectoryChange({ ...base, conversationId: 'missing' })).toThrow('Session missing is not live.');
    expect(() =>
      requestLiveSessionWorkingDirectoryChange({ ...base, conversationId: 's1', resolveSessionFile: vi.fn(() => undefined) }),
    ).toThrow('Conversation working directory changes require a persisted session file.');
  });

  it('clears pending changes for unchanged cwd and queues normalized changes otherwise', () => {
    const live = entry('/repo');
    const pendingChanges = new Map<string, unknown>([['s1', { cwd: '/old' }]]);
    const base = {
      conversationId: ' s1 ',
      loaderOptions: { additionalSkillPaths: ['/skills'] } as never,
      registry: new Map([['s1', live]]),
      pendingChanges,
      resolveSessionFile: vi.fn(() => '/sessions/s1.json'),
    };

    expect(requestLiveSessionWorkingDirectoryChange({ ...base, cwd: ' /repo ' })).toEqual({
      conversationId: 's1',
      cwd: '/repo',
      queued: false,
      unchanged: true,
    });
    expect(pendingChanges.has('s1')).toBe(false);

    expect(requestLiveSessionWorkingDirectoryChange({ ...base, cwd: ' /next ', continuePrompt: ' continue please ' })).toEqual({
      conversationId: 's1',
      cwd: '/next',
      queued: true,
    });
    expect(pendingChanges.get('s1')).toEqual({
      cwd: '/next',
      continuePrompt: 'continue please',
      loaderOptions: { additionalSkillPaths: ['/skills'] },
    });
  });

  it('does nothing when no pending change exists', async () => {
    const input = {
      entry: entry(),
      pendingChanges: new Map(),
      resolveSessionFile: vi.fn(),
      changeSessionWorkingDirectory: vi.fn(),
      promptSession: vi.fn(),
      broadcast: vi.fn(),
    };

    await applyPendingLiveSessionWorkingDirectoryChange(input as never);
    expect(input.resolveSessionFile).not.toHaveBeenCalled();
  });

  it('broadcasts an error when source session file is unavailable', async () => {
    const live = entry();
    const pendingChanges = new Map([['s1', { cwd: '/next', loaderOptions: {} }]]);
    const broadcast = vi.fn();

    await applyPendingLiveSessionWorkingDirectoryChange({
      entry: live,
      pendingChanges,
      resolveSessionFile: vi.fn(() => undefined),
      changeSessionWorkingDirectory: vi.fn(),
      promptSession: vi.fn(),
      broadcast,
    } as never);

    expect(pendingChanges.has('s1')).toBe(false);
    expect(broadcast).toHaveBeenCalledWith(live, {
      type: 'error',
      message: 'Could not change the working directory because the session file is unavailable.',
    });
  });

  it('applies a pending change, broadcasts the new conversation, and auto-continues', async () => {
    const live = entry();
    const pendingChanges = new Map([['s1', { cwd: '/next', continuePrompt: 'continue', loaderOptions: { model: 'm1' } }]]);
    const promptSession = vi.fn(async () => undefined);
    const broadcast = vi.fn();
    const changeSessionWorkingDirectory = vi.fn(async () => ({ id: 's2', sessionFile: '/sessions/s2.json' }));

    await applyPendingLiveSessionWorkingDirectoryChange({
      entry: live,
      pendingChanges,
      resolveSessionFile: vi.fn(() => '/sessions/s1.json'),
      changeSessionWorkingDirectory,
      promptSession,
      broadcast,
    } as never);

    expect(changeSessionWorkingDirectory).toHaveBeenCalledWith(live, '/sessions/s1.json', '/next', { model: 'm1' });
    expect(broadcast).toHaveBeenCalledWith(live, { type: 'cwd_changed', newConversationId: 's2', cwd: '/next', autoContinued: true });
    expect(promptSession).toHaveBeenCalledWith('s2', 'continue');
  });

  it('broadcasts change failures and logs auto-continue failures', async () => {
    const live = entry();
    const broadcast = vi.fn();
    await applyPendingLiveSessionWorkingDirectoryChange({
      entry: live,
      pendingChanges: new Map([['s1', { cwd: '/next', loaderOptions: {} }]]),
      resolveSessionFile: vi.fn(() => '/sessions/s1.json'),
      changeSessionWorkingDirectory: vi.fn(async () => {
        throw new Error('fork failed');
      }),
      promptSession: vi.fn(),
      broadcast,
    } as never);
    expect(broadcast).toHaveBeenCalledWith(live, { type: 'error', message: 'Could not change the working directory: fork failed' });

    const promptError = new Error('prompt failed');
    await applyPendingLiveSessionWorkingDirectoryChange({
      entry: live,
      pendingChanges: new Map([['s1', { cwd: '/next', continuePrompt: 'continue', loaderOptions: {} }]]),
      resolveSessionFile: vi.fn(() => '/sessions/s1.json'),
      changeSessionWorkingDirectory: vi.fn(async () => ({ id: 's2', sessionFile: '/sessions/s2.json' })),
      promptSession: vi.fn(async () => {
        throw promptError;
      }),
      broadcast,
    } as never);
    await Promise.resolve();
    expect(logging.logWarn).toHaveBeenCalledWith('failed to continue conversation after working directory change', {
      conversationId: 's2',
      cwd: '/next',
      error: { message: 'prompt failed', stack: promptError.stack },
    });
  });
});
