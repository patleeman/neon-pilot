import { beforeEach, describe, expect, it, vi } from 'vitest';

const appEvents = vi.hoisted(() => ({ publishAppEvent: vi.fn() }));
const logging = vi.hoisted(() => ({ logError: vi.fn() }));
const runs = vi.hoisted(() => ({ syncWebLiveConversationRun: vi.fn(async () => undefined) }));

vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('../shared/logging.js', () => logging);
vi.mock('./conversationRuns.js', () => runs);

import { resolveDurableRunTitle, resolveLiveSessionProfile, syncLiveSessionDurableRun } from './liveSessionDurableRun.js';

describe('live session durable run sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function entry(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: 's1',
      cwd: '/repo',
      title: ' Entry Title ',
      session: { sessionFile: ' /sessions/s1.jsonl ', sessionName: '' },
      ...overrides,
    };
  }

  it('resolves shared profile and durable run titles from session name before entry title', () => {
    expect(resolveLiveSessionProfile()).toBe('shared');
    expect(resolveDurableRunTitle(entry({ session: { sessionName: ' Session Name ' } }) as never)).toBe('Session Name');
    expect(resolveDurableRunTitle(entry() as never)).toBe('Entry Title');
  });

  it('skips sync without a session file or unchanged state unless forced or carrying an error', async () => {
    await syncLiveSessionDurableRun(entry({ session: { sessionFile: '   ' } }) as never, 'running');
    expect(runs.syncWebLiveConversationRun).not.toHaveBeenCalled();

    await syncLiveSessionDurableRun(entry({ lastDurableRunState: 'running' }) as never, 'running');
    expect(runs.syncWebLiveConversationRun).not.toHaveBeenCalled();

    await syncLiveSessionDurableRun(entry({ lastDurableRunState: 'running' }) as never, 'running', { lastError: 'boom' });
    expect(runs.syncWebLiveConversationRun).toHaveBeenCalledOnce();
  });

  it('syncs durable run state and updates lastDurableRunState', async () => {
    const e = entry();
    await syncLiveSessionDurableRun(e as never, 'running');

    expect(e.lastDurableRunState).toBe('running');
    expect(runs.syncWebLiveConversationRun).toHaveBeenCalledWith({
      conversationId: 's1',
      sessionFile: '/sessions/s1.jsonl',
      cwd: '/repo',
      title: 'Entry Title',
      profile: 'shared',
      state: 'running',
      lastError: undefined,
    });
  });

  it('logs and notifies sync failures without throwing', async () => {
    runs.syncWebLiveConversationRun.mockRejectedValueOnce(new Error('daemon down'));
    await expect(syncLiveSessionDurableRun(entry() as never, 'interrupted')).resolves.toBeUndefined();

    expect(logging.logError).toHaveBeenCalledWith('conversation durable run sync failed', {
      sessionId: 's1',
      state: 'interrupted',
      message: 'daemon down',
    });
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({
      type: 'notification',
      extensionId: 'core',
      message: 'Durable run sync failed: daemon down',
      severity: 'error',
    });
  });
});
