import { beforeEach, describe, expect, it, vi } from 'vitest';

const appEvents = vi.hoisted(() => ({ publishAppEvent: vi.fn() }));
const logging = vi.hoisted(() => ({ logError: vi.fn() }));
const runs = vi.hoisted(() => ({ syncWebLiveConversationRun: vi.fn(async () => undefined) }));
const durableRuns = vi.hoisted(() => ({
  cancelDurableRun: vi.fn(async (runId: string) => ({ cancelled: true, runId })),
  clearDurableRunsListCache: vi.fn(),
  listDurableRuns: vi.fn(async () => ({ runs: [] })),
}));

vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('../shared/logging.js', () => logging);
vi.mock('../automation/durableRuns.js', () => durableRuns);
vi.mock('./conversationRuns.js', () => runs);

import {
  abortConversationDurableRuns,
  resolveDurableRunTitle,
  resolveLiveSessionProfile,
  selectAbortableConversationDurableRunIds,
  syncLiveSessionDurableRun,
} from './liveSessionDurableRun.js';

describe('live session durable run sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    durableRuns.cancelDurableRun.mockImplementation(async (runId: string) => ({ cancelled: true, runId }));
    durableRuns.listDurableRuns.mockResolvedValue({ runs: [] });
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

  it('skips disk sync without a session file but still updates lastDurableRunState', async () => {
    const e = entry({ session: { sessionFile: '   ' } });
    await syncLiveSessionDurableRun(e as never, 'waiting');
    expect(e.lastDurableRunState).toBe('waiting');
    expect(runs.syncWebLiveConversationRun).not.toHaveBeenCalled();
  });

  it('skips disk sync when lastDurableRunState is unchanged unless forced or carrying an error', async () => {
    const e = entry({ lastDurableRunState: 'running' });
    await syncLiveSessionDurableRun(e as never, 'running');
    expect(runs.syncWebLiveConversationRun).not.toHaveBeenCalled();

    await syncLiveSessionDurableRun(e as never, 'running', { lastError: 'boom' });
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

  it('selects active background durable runs owned by the conversation only', () => {
    const run = (overrides: Record<string, unknown>) =>
      ({
        runId: 'run',
        status: { status: 'running' },
        manifest: { kind: 'raw-shell', spec: {}, source: {} },
        ...overrides,
      }) as never;

    expect(
      selectAbortableConversationDurableRunIds(
        [
          run({ runId: 'source-id', manifest: { kind: 'raw-shell', spec: {}, source: { type: 'tool', id: 's1' } } }),
          run({
            runId: 'source-file',
            manifest: { kind: 'raw-shell', spec: {}, source: { type: 'tool', filePath: '/sessions/s1.jsonl' } },
          }),
          run({
            runId: 'callback-conversation',
            manifest: {
              kind: 'background-run',
              source: { type: 'tool' },
              spec: { metadata: { callbackConversation: { conversationId: 's1', sessionFile: '/sessions/s1.jsonl' } } },
            },
          }),
          run({ runId: 'completed', status: { status: 'completed' }, manifest: { kind: 'raw-shell', source: { id: 's1' }, spec: {} } }),
          run({ runId: 'conversation-run', manifest: { kind: 'conversation', source: { id: 's1' }, spec: {} } }),
          run({ runId: 'other', manifest: { kind: 'raw-shell', source: { id: 'other' }, spec: {} } }),
        ],
        { sessionId: 's1', sessionFile: '/sessions/s1.jsonl' },
      ),
    ).toEqual(['source-id', 'source-file', 'callback-conversation']);
  });

  it('cancels selected conversation-owned durable runs and clears the cached list', async () => {
    durableRuns.listDurableRuns.mockResolvedValue({
      runs: [
        {
          runId: 'run-owned',
          status: { status: 'running' },
          manifest: { kind: 'raw-shell', spec: {}, source: { type: 'tool', id: 's1' } },
        },
        {
          runId: 'conversation-run',
          status: { status: 'running' },
          manifest: { kind: 'conversation', spec: {}, source: { type: 'web-live-session', id: 's1' } },
        },
      ],
    });

    await expect(abortConversationDurableRuns(entry() as never)).resolves.toEqual(['run-owned']);

    expect(durableRuns.cancelDurableRun).toHaveBeenCalledWith('run-owned');
    expect(durableRuns.cancelDurableRun).toHaveBeenCalledTimes(1);
    expect(durableRuns.clearDurableRunsListCache).toHaveBeenCalledOnce();
  });

  it('logs durable run abort failures without blocking session abort', async () => {
    durableRuns.listDurableRuns.mockResolvedValue({
      runs: [
        {
          runId: 'run-owned',
          status: { status: 'running' },
          manifest: { kind: 'raw-shell', spec: {}, source: { type: 'tool', id: 's1' } },
        },
      ],
    });
    durableRuns.cancelDurableRun.mockRejectedValueOnce(new Error('daemon down'));

    await expect(abortConversationDurableRuns(entry() as never)).resolves.toEqual([]);

    expect(logging.logError).toHaveBeenCalledWith('conversation durable run abort failed', {
      sessionId: 's1',
      runId: 'run-owned',
      message: 'daemon down',
    });
    expect(durableRuns.clearDurableRunsListCache).not.toHaveBeenCalled();
  });
});
