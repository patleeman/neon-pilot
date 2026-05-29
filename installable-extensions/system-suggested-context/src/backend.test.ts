import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistTraceSuggestedContext: vi.fn(),
  readConversationSummary: vi.fn(),
  getConversationBlocks: vi.fn(),
  getConversationMeta: vi.fn(),
  scheduleConversationSearchIndexing: vi.fn(),
  searchIndexedConversationDocuments: vi.fn(),
}));

vi.mock('stopword', () => ({
  eng: [],
  removeStopwords: (tokens: string[]) => tokens,
}));

vi.mock('@neon-pilot/extensions/backend/conversations', () => ({
  persistTraceSuggestedContext: mocks.persistTraceSuggestedContext,
  readConversationSummary: mocks.readConversationSummary,
  getConversationBlocks: mocks.getConversationBlocks,
  getConversationMeta: mocks.getConversationMeta,
  scheduleConversationSearchIndexing: mocks.scheduleConversationSearchIndexing,
  searchIndexedConversationDocuments: mocks.searchIndexedConversationDocuments,
}));

import { providePromptContext, warmPointers } from './backend.js';

describe('system-suggested-context backend', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('logs pointer injection failures before returning the user warning', async () => {
    const warn = vi.fn();
    mocks.getConversationBlocks.mockRejectedValue(new Error('db unavailable'));

    const result = await providePromptContext(
      { prompt: 'architecture routing review', conversationId: 'conv-new', currentCwd: '/repo', relatedConversationIds: ['conv-related'] },
      { log: { warn } } as never,
    );

    expect(result).toEqual({ contextMessages: [], warnings: ['Related conversation pointers failed; sent without them.'] });
    expect(warn).toHaveBeenCalledWith(
      'related conversation pointers failed',
      expect.objectContaining({
        conversationId: 'conv-new',
        currentCwd: '/repo',
        selectedPointerCount: 1,
        error: 'db unavailable',
        stack: expect.stringContaining('db unavailable'),
      }),
    );
  });

  it('keeps warmed pointer caches isolated by profile', async () => {
    mocks.getConversationBlocks.mockResolvedValue({ totalBlocks: 0 });
    mocks.searchIndexedConversationDocuments
      .mockResolvedValueOnce([
        {
          sessionId: 'conv-profile-a',
          title: 'Architecture Review',
          cwd: '/repo',
          timestamp: '2026-05-01T00:00:00.000Z',
          searchText: 'architecture review routing',
        },
      ])
      .mockResolvedValueOnce([
        {
          sessionId: 'conv-profile-b',
          title: 'Architecture Review',
          cwd: '/repo',
          timestamp: '2026-05-01T00:00:00.000Z',
          searchText: 'architecture review routing',
        },
      ]);

    await warmPointers({ prompt: 'architecture routing review', currentConversationId: 'conv-new', currentCwd: '/repo' }, {
      profile: 'a',
    } as never);
    await warmPointers({ prompt: 'architecture routing review', currentConversationId: 'conv-new', currentCwd: '/repo' }, {
      profile: 'b',
    } as never);
    const profileBResult = await providePromptContext(
      { prompt: 'architecture routing review', conversationId: 'conv-new', currentCwd: '/repo' },
      { profile: 'b' } as never,
    );
    const profileAResult = await providePromptContext(
      { prompt: 'architecture routing review', conversationId: 'conv-new', currentCwd: '/repo' },
      { profile: 'a' } as never,
    );

    expect(profileBResult.contextMessages[0]?.content).toContain('id: conv-profile-b');
    expect(profileBResult.contextMessages[0]?.content).not.toContain('id: conv-profile-a');
    expect(profileAResult.contextMessages[0]?.content).toContain('id: conv-profile-a');
    expect(profileAResult.contextMessages[0]?.content).not.toContain('id: conv-profile-b');
  });

  it('deduplicates indexed pointer candidates before injecting context', async () => {
    mocks.getConversationBlocks.mockResolvedValue({ totalBlocks: 0 });
    mocks.searchIndexedConversationDocuments.mockResolvedValue([
      {
        sessionId: 'conv-related',
        title: 'Architecture Review',
        cwd: '/repo',
        timestamp: '2026-05-01T00:00:00.000Z',
        searchText: 'architecture review routing',
      },
      {
        sessionId: 'conv-related',
        title: 'Architecture Review',
        cwd: '/repo',
        timestamp: '2026-05-01T00:00:00.000Z',
        searchText: 'architecture review routing',
      },
    ]);

    await warmPointers({ prompt: 'architecture routing review', currentConversationId: 'conv-new', currentCwd: '/repo' }, {} as never);
    const result = await providePromptContext(
      { prompt: 'architecture routing review', conversationId: 'conv-new', currentCwd: '/repo' },
      {} as never,
    );

    expect(result.contextMessages).toHaveLength(1);
    expect(result.contextMessages[0]?.content.match(/id: conv-related/g)).toHaveLength(1);
  });

  it('injects selected pointer IDs without blocking on previews', async () => {
    mocks.getConversationBlocks.mockResolvedValue({ totalBlocks: 0 });
    mocks.getConversationMeta.mockResolvedValue({
      id: 'conv-manual',
      title: 'Fix Stale Run Hourglass',
      cwd: '/repo',
      timestamp: '2026-05-01T00:00:00.000Z',
      isRunning: false,
      needsAttention: false,
    });
    mocks.readConversationSummary.mockResolvedValue({
      displaySummary: 'Stale sidebar hourglass fixed by refreshing executions from run snapshots.',
    });

    const result = await providePromptContext(
      {
        prompt: 'hourglass state bug',
        conversationId: 'conv-new-compact',
        currentCwd: '/repo',
        relatedConversationIds: ['conv-manual'],
      },
      {} as never,
    );

    expect(result.contextMessages).toHaveLength(1);
    expect(result.contextMessages[0]?.content).toBe(
      'User-selected related prior conversations. IDs only; call conversation_inspect before relying on details.\n' + '- id: conv-manual',
    );
    expect(mocks.getConversationMeta).not.toHaveBeenCalled();
    expect(mocks.readConversationSummary).not.toHaveBeenCalled();
    expect(result.contextMessages[0]?.content).not.toContain('workspace:');
    expect(result.contextMessages[0]?.content).not.toContain('created:');
    expect(result.contextMessages[0]?.content).not.toContain('source:');
    expect(result.contextMessages[0]?.content).not.toContain('relevance:');
    expect(result.contextMessages[0]?.content).not.toContain('cached preview:');
  });

  it('caps automatic pointer injection to three conversations by default', async () => {
    mocks.getConversationBlocks.mockResolvedValue({ totalBlocks: 0 });
    mocks.searchIndexedConversationDocuments.mockResolvedValue(
      [1, 2, 3, 4].map((index) => ({
        sessionId: `conv-auto-${index}`,
        title: `Architecture Review ${index}`,
        cwd: '/repo',
        timestamp: '2026-05-01T00:00:00.000Z',
        searchText: 'architecture review routing',
      })),
    );

    await warmPointers(
      { prompt: 'compact automatic architecture routing review', currentConversationId: 'conv-new-auto', currentCwd: '/repo' },
      {
        profile: 'compact-cap',
      } as never,
    );
    const result = await providePromptContext(
      { prompt: 'compact automatic architecture routing review', conversationId: 'conv-new-auto', currentCwd: '/repo' },
      { profile: 'compact-cap' } as never,
    );

    const content = result.contextMessages[0]?.content ?? '';
    expect(content.match(/^-/gm)).toHaveLength(3);
    expect(content).toContain('id: conv-auto-1');
    expect(content).toContain('id: conv-auto-3');
    expect(content).not.toContain('id: conv-auto-4');
  });
});
