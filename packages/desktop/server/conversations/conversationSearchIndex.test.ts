import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const listSessionsMock = vi.hoisted(() => vi.fn());
const readSessionBlocksByFileMock = vi.hoisted(() => vi.fn());
const readSessionSearchTextMock = vi.hoisted(() => vi.fn());
const readConversationSummaryMock = vi.hoisted(() => vi.fn());

vi.mock('./sessions.js', () => ({
  listSessions: listSessionsMock,
  readSessionBlocksByFile: readSessionBlocksByFileMock,
  readSessionSearchText: readSessionSearchTextMock,
}));

vi.mock('./conversationSummaries.js', () => ({
  readConversationSummary: readConversationSummaryMock,
}));

afterEach(async () => {
  const mod = await import('./conversationSearchIndex.js');
  mod.resetConversationSearchIndexForTests();
  vi.resetAllMocks();
  delete process.env.NEON_PILOT_STATE_ROOT;
});

describe('conversationSearchIndex', () => {
  it('does not create the search database during cold fast content search', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-search-index-cold-'));
    process.env.NEON_PILOT_STATE_ROOT = root;

    const mod = await import('./conversationSearchIndex.js');

    expect(mod.searchIndexedConversationContent({ terms: ['release'], limit: 5 })).toEqual([]);
    expect(existsSync(join(root, 'neon-pilot-runtime', 'conversations.db'))).toBe(false);
  });

  it('indexes sessions from multiple file paths simulating layout and legacy origins', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-search-index-multi-'));
    process.env.NEON_PILOT_STATE_ROOT = root;
    const dirA = mkdtempSync(join(tmpdir(), 'pa-search-multi-a-'));
    const dirB = mkdtempSync(join(tmpdir(), 'pa-search-multi-b-'));
    const fileA = join(dirA, 'session-alpha.jsonl');
    const fileB = join(dirB, 'session-beta.jsonl');
    writeFileSync(fileA, '{"type":"session"}\n{"type":"message"}\n');
    writeFileSync(fileB, '{"type":"session"}\n{"type":"message"}\n');

    listSessionsMock.mockReturnValue([
      {
        id: 'session-alpha',
        file: fileA,
        timestamp: '2026-06-01T10:00:00.000Z',
        lastActivityAt: '2026-06-01T10:00:00.000Z',
        cwd: '/repo/alpha',
        cwdSlug: 'repo-alpha',
        model: 'gpt',
        title: 'Alpha session from dir A',
        messageCount: 2,
      },
      {
        id: 'session-beta',
        file: fileB,
        timestamp: '2026-06-02T10:00:00.000Z',
        lastActivityAt: '2026-06-02T10:00:00.000Z',
        cwd: '/repo/beta',
        cwdSlug: 'repo-beta',
        model: 'gpt',
        title: 'Beta session from dir B',
        messageCount: 2,
      },
    ]);
    readConversationSummaryMock.mockReturnValue({
      displaySummary: '',
      outcome: '',
      promptSummary: '',
      searchText: '',
      keyTerms: [],
      filesTouched: [],
    });
    readSessionSearchTextMock.mockReturnValue('multi source searchable content');
    readSessionBlocksByFileMock.mockReturnValue({
      blocks: [{ id: 'msg-0', type: 'text', text: 'multi source searchable content', ts: '2026-06-01T10:00:00.000Z' }],
    });

    const mod = await import('./conversationSearchIndex.js');
    expect(mod.indexConversationSearchBatch({ maxSessions: 10, maxDurationMs: 1000 })).toEqual({ indexed: 2, remaining: 0 });

    // Content search returns sessions from both paths
    const contentResults = mod.searchIndexedConversationContent({ terms: ['multi', 'source'], limit: 10 });
    expect(contentResults.map((c) => c.conversationId).sort()).toEqual(['session-alpha', 'session-beta']);

    // Document search also returns both
    const docResults = mod.searchIndexedConversationDocuments({
      terms: ['source'],
      currentConversationId: 'current',
      currentCwd: '/repo',
      nowMs: Date.parse('2026-06-10T10:00:00.000Z'),
      recentWindowMs: 30 * 24 * 60 * 60 * 1000,
      limit: 10,
    });
    expect(docResults.map((d) => d.sessionId).sort()).toEqual(['session-alpha', 'session-beta']);

    mod.resetConversationSearchIndexForTests();
  });

  it('defers scheduled indexing unless a caller requests immediate work', async () => {
    vi.useFakeTimers();
    const root = mkdtempSync(join(tmpdir(), 'pa-search-index-delay-'));
    process.env.NEON_PILOT_STATE_ROOT = root;
    listSessionsMock.mockReturnValue([]);

    const mod = await import('./conversationSearchIndex.js');
    mod.scheduleConversationSearchIndexing();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(listSessionsMock).not.toHaveBeenCalled();

    mod.resetConversationSearchIndexForTests();
    mod.scheduleConversationSearchIndexing({ delayMs: 0 });
    await vi.runOnlyPendingTimersAsync();

    expect(listSessionsMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('indexes changed sessions and searches recent FTS documents', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-search-index-'));
    process.env.NEON_PILOT_STATE_ROOT = root;
    const sessionFile = join(root, 'session.jsonl');
    writeFileSync(sessionFile, '{"type":"session"}\n{"type":"message"}\n');
    listSessionsMock.mockReturnValue([
      {
        id: 'session-1',
        file: sessionFile,
        timestamp: '2026-04-21T10:00:00.000Z',
        lastActivityAt: '2026-04-21T10:00:00.000Z',
        cwd: '/repo/a',
        cwdSlug: 'repo-a',
        model: 'gpt',
        title: 'Release signing',
        messageCount: 2,
      },
    ]);
    readConversationSummaryMock.mockReturnValue({
      displaySummary: 'Fixed notarization release upload',
      outcome: '',
      promptSummary: '',
      searchText: '',
      keyTerms: [],
      filesTouched: [],
    });
    readSessionSearchTextMock.mockReturnValue('apple credentials notarization');
    readSessionBlocksByFileMock.mockReturnValue({
      blocks: [
        { id: 'user-0', type: 'user', text: 'setup', ts: '2026-04-21T10:00:00.000Z' },
        { id: 'assistant-1', type: 'text', text: 'ordinary reply', ts: '2026-04-21T10:00:01.000Z' },
        {
          id: 'assistant-2',
          type: 'text',
          text: 'The notarization handoff is ready for release.',
          ts: '2026-04-21T10:00:02.000Z',
        },
      ],
    });

    const mod = await import('./conversationSearchIndex.js');
    expect(mod.indexConversationSearchBatch({ maxSessions: 10, maxDurationMs: 1000 })).toEqual({ indexed: 1, remaining: 0 });
    expect(
      readdirSync(root, { recursive: true })
        .map(String)
        .some((entry) => entry.endsWith('conversations.db')),
    ).toBe(true);

    expect(
      mod
        .searchIndexedConversationDocuments({
          terms: ['notarization'],
          currentConversationId: 'current',
          currentCwd: '/repo/a',
          nowMs: Date.parse('2026-04-22T10:00:00.000Z'),
          recentWindowMs: 3 * 24 * 60 * 60 * 1000,
          limit: 5,
        })
        .map((candidate) => candidate.sessionId),
    ).toEqual(['session-1']);

    expect(mod.searchIndexedConversationContent({ terms: ['notarization'], limit: 5 })).toEqual([
      expect.objectContaining({
        conversationId: 'session-1',
        blockId: 'assistant-2',
        blockType: 'text',
        blockIndex: 2,
        snippet: 'The notarization handoff is ready for release.',
      }),
    ]);
    mod.resetConversationSearchIndexForTests();
    expect(mod.searchIndexedConversationContent({ terms: ['notarization'], limit: 5 })).toEqual([
      expect.objectContaining({
        conversationId: 'session-1',
        blockIndex: 2,
      }),
    ]);

    expect(
      mod.searchIndexedConversationContent({ terms: ['notarization', 'missing'], limit: 5 }).map((candidate) => candidate.conversationId),
    ).toEqual([]);

    expect(
      mod.searchIndexedConversationDocuments({
        terms: ['notarization'],
        currentConversationId: 'current',
        currentCwd: '/repo/a',
        nowMs: Date.parse('2026-04-30T10:00:00.000Z'),
        recentWindowMs: 3 * 24 * 60 * 60 * 1000,
        limit: 5,
      }),
    ).toEqual([]);
  });
});
