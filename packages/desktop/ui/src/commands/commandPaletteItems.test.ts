import { describe, expect, it } from 'vitest';

import {
  buildConversationContentSearchItems,
  buildConversationItems,
  excerpt,
  normalizeExtensionSearchItem,
  normalizeQuickOpenItem,
  type ScopedSessionMeta,
  workspaceDisplayLabel,
} from './commandPaletteItems';

function session(overrides: Partial<ScopedSessionMeta>): ScopedSessionMeta {
  return {
    id: 'conv-1',
    file: '/tmp/conv-1.jsonl',
    timestamp: '2026-03-01T10:00:00.000Z',
    title: 'Conversation 1',
    messageCount: 1,
    ...overrides,
  };
}

describe('command palette item builders', () => {
  it('normalizes text excerpts', () => {
    expect(excerpt('  hello\n   world  ')).toBe('hello world');
    expect(excerpt('abcdef', 4)).toBe('abc…');
    expect(excerpt('   ')).toBeUndefined();
  });

  it('builds open conversation items with status metadata', () => {
    const [item] = buildConversationItems('open', [
      session({
        id: 'conv-open',
        title: 'Open thread',
        pinned: true,
        isRunning: true,
        needsAttention: true,
        model: 'openai/gpt-5',
        cwd: '/Users/patrick/workingdir/neon-pilot/packages/desktop',
        cwdSlug: 'desktop',
      }),
    ]);

    expect(item).toMatchObject({
      id: 'open:conv-open',
      section: 'open',
      title: 'Open thread',
      subtitle: 'desktop',
      meta: expect.stringContaining('pinned'),
      action: { kind: 'navigate', to: '/conversations/conv-open' },
    });
    expect(item?.meta).toContain('running');
    expect(item?.meta).toContain('attention');
    expect(item?.meta).toContain('gpt-5');
  });

  it('uses workspace display labels instead of raw paths', () => {
    expect(workspaceDisplayLabel('/Users/patrick/workingdir/neon-pilot', 'neon-pilot')).toBe('neon-pilot');
    expect(workspaceDisplayLabel('/tmp/neon-pilot-worktrees/baseline-wtf-gateway-timeouts', null)).toBe('baseline-wtf-gateway-timeouts');
    expect(workspaceDisplayLabel(undefined, null)).toBeUndefined();
  });

  it('sorts archived conversations by latest activity', () => {
    expect(
      buildConversationItems('archived', [
        session({ id: 'old', lastActivityAt: '2026-03-01T10:00:00.000Z' }),
        session({ id: 'new', lastActivityAt: '2026-03-02T10:00:00.000Z' }),
      ]).map((item) => item.id),
    ).toEqual(['archived:new', 'archived:old']);
  });

  it('rejects quick-open items that collide with thread sections or lack actions', () => {
    const registration = { extensionId: 'ext', id: 'files', provider: 'provider' } as never;

    expect(
      normalizeQuickOpenItem(registration, { id: 'bad', section: 'threads', title: 'Bad', action: { kind: 'navigate', to: '/' } }, 0),
    ).toBeNull();
    expect(normalizeQuickOpenItem(registration, { id: 'missing-action', title: 'Missing action' }, 0)).toBeNull();
  });

  it('normalizes quick-open and extension search items', () => {
    expect(
      normalizeQuickOpenItem(
        { extensionId: 'ext', id: 'files', provider: 'provider', section: 'knowledge' } as never,
        { id: 'guide', title: 'Guide', keywords: ['docs', undefined], action: { kind: 'navigate', to: '/knowledge' } },
        3,
      ),
    ).toMatchObject({
      id: 'extension-quick-open:ext:files:guide',
      section: 'knowledge',
      keywords: ['docs'],
      order: 3,
    });

    expect(
      normalizeExtensionSearchItem(
        { extensionId: 'ext', id: 'search' } as never,
        { id: 'result', title: 'Result', snippet: 'Snippet', action: { kind: 'navigate', to: '/result' }, keywords: ['one', undefined] },
        4,
      ),
    ).toMatchObject({
      id: 'extension-search:ext:search:result',
      section: 'search',
      meta: 'Snippet',
      keywords: ['one'],
      action: { kind: 'extensionSearchAction', extensionId: 'ext' },
    });
  });

  it('builds live and archived conversation content search results', () => {
    expect(
      buildConversationContentSearchItems(
        [
          {
            conversationId: 'live one',
            blockId: 'b1',
            title: 'Live',
            cwd: '/Users/patrick/workingdir/neon-pilot',
            snippet: 'match',
            isLive: true,
          },
          { conversationId: 'archived one', blockId: 'b2', title: 'Archived', cwd: '/repo', snippet: 'match', isLive: false },
        ],
        'match',
      ).map((item) => ({ action: item.action, subtitle: item.subtitle })),
    ).toEqual([
      { action: { kind: 'navigate', to: '/conversations/live%20one' }, subtitle: 'neon-pilot' },
      { action: { kind: 'restoreArchivedConversation', conversationId: 'archived one' }, subtitle: 'repo' },
    ]);
  });
});
