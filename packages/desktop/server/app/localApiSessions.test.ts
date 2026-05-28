import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readConversationSessionsCapabilityMock, readConversationSessionSearchIndexCapabilityMock } = vi.hoisted(() => ({
  readConversationSessionsCapabilityMock: vi.fn(),
  readConversationSessionSearchIndexCapabilityMock: vi.fn(),
}));

vi.mock('../conversations/conversationSessionCapability.js', () => ({
  readConversationSessionsCapability: readConversationSessionsCapabilityMock,
  readConversationSessionMetaCapability: vi.fn(),
  readConversationSessionSearchIndexCapability: readConversationSessionSearchIndexCapabilityMock,
}));

vi.mock('./bootstrap.js', async () => {
  const actual = await vi.importActual<typeof import('./bootstrap.js')>('./bootstrap.js');
  return {
    ...actual,
    startDeferredResumeLoop: vi.fn(),
    startAttentionDispatchLoop: vi.fn(),
  };
});

import { dispatchDesktopLocalApiRequest, readDesktopSessions } from './localApi.js';

describe('localApi sessions', () => {
  beforeEach(() => {
    readConversationSessionsCapabilityMock.mockReset();
    readConversationSessionSearchIndexCapabilityMock.mockReset();
  });

  it('returns the full session list by default', async () => {
    readConversationSessionsCapabilityMock.mockReturnValue([{ id: 'one' }, { id: 'two' }]);

    await expect(readDesktopSessions()).resolves.toEqual([{ id: 'one' }, { id: 'two' }]);
    expect(readConversationSessionsCapabilityMock).toHaveBeenCalledWith({});
  });

  it('limits session snapshots when a safe positive limit is provided', async () => {
    readConversationSessionsCapabilityMock.mockImplementation((input) =>
      input?.limit === 2 ? [{ id: 'one' }, { id: 'two' }] : [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
    );

    await expect(readDesktopSessions({ limit: 2 })).resolves.toEqual([{ id: 'one' }, { id: 'two' }]);
    expect(readConversationSessionsCapabilityMock).toHaveBeenLastCalledWith({ limit: 2 });
    await expect(readDesktopSessions({ limit: 0 })).resolves.toEqual([{ id: 'one' }, { id: 'two' }, { id: 'three' }]);
    await expect(readDesktopSessions({ limit: Number.MAX_SAFE_INTEGER + 1 })).resolves.toEqual([
      { id: 'one' },
      { id: 'two' },
      { id: 'three' },
    ]);
  });

  it('hydrates related conversation candidates from session ids in the main process', async () => {
    readConversationSessionsCapabilityMock.mockReturnValue([
      {
        id: 'one',
        title: 'Transcript loading',
        cwd: '/repo',
        timestamp: '2026-04-10T12:00:00.000Z',
      },
      {
        id: 'two',
        title: 'Unrelated',
        cwd: '/repo',
        timestamp: '2026-04-09T12:00:00.000Z',
      },
    ]);
    readConversationSessionSearchIndexCapabilityMock.mockReturnValue({
      index: {
        one: 'backend transcript performance',
      },
    });

    const response = await dispatchDesktopLocalApiRequest({
      method: 'POST',
      path: '/api/related-conversations/results',
      body: {
        sessionIds: ['one'],
        summaries: {},
        query: 'transcript performance',
        workspaceCwd: '/repo',
        selectedRelatedThreadIds: [],
        limit: 5,
      },
    });

    expect(readConversationSessionsCapabilityMock).toHaveBeenCalledWith({ limit: 100 });
    expect(readConversationSessionSearchIndexCapabilityMock).toHaveBeenCalledWith({ sessionIds: ['one'] });
    expect(response.headers['X-PA-Perf']).toContain('"fastPath":"product"');
    expect(
      JSON.parse(new TextDecoder().decode(response.body)).visibleResults.map((result: { sessionId: string }) => result.sessionId),
    ).toEqual(['one']);
  });
});
