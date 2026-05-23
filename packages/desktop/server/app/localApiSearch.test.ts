import { describe, expect, it } from 'vitest';

import {
  buildFastConversationContentSearchResponse,
  normalizeFastConversationSearchLimit,
  normalizeFastConversationSearchTerms,
} from './localApiSearch';

const decoder = new TextDecoder();

function payload(response: NonNullable<ReturnType<typeof buildFastConversationContentSearchResponse>>) {
  return JSON.parse(decoder.decode(response.body)) as Record<string, unknown>;
}

describe('localApiSearch', () => {
  it('normalizes search terms and limits', () => {
    expect(normalizeFastConversationSearchTerms('  Hello   WORLD ')).toEqual(['hello', 'world']);
    expect(normalizeFastConversationSearchTerms('   ')).toBeNull();
    expect(normalizeFastConversationSearchTerms(null)).toBeNull();
    expect(normalizeFastConversationSearchLimit(undefined)).toBe(80);
    expect(normalizeFastConversationSearchLimit(0)).toBe(1);
    expect(normalizeFastConversationSearchLimit(2.9)).toBe(2);
    expect(normalizeFastConversationSearchLimit(500)).toBe(100);
  });

  it('builds a fast all-term conversation content search response', () => {
    const response = buildFastConversationContentSearchResponse({
      body: { query: 'hello world', limit: 1 },
      sessions: [
        {
          id: 'one',
          title: 'One',
          cwd: '/repo',
          timestamp: '2026-05-23T00:00:00.000Z',
          lastActivityAt: '2026-05-23T01:00:00.000Z',
          isLive: true,
          isRunning: true,
        },
        { id: 'two', title: 'Two', timestamp: '2026-05-23T00:00:00.000Z' },
      ],
      readSearchText: (session) => (session.id === 'one' ? 'hello\n   brave world transcript' : 'hello only'),
    });

    expect(response?.statusCode).toBe(200);
    expect(payload(response!)).toMatchObject({
      query: 'hello world',
      mode: 'allTerms',
      scope: 'all',
      totalMatching: 1,
      returnedCount: 1,
      matches: [
        {
          conversationId: 'one',
          title: 'One',
          cwd: '/repo',
          lastActivityAt: '2026-05-23T01:00:00.000Z',
          isLive: true,
          isRunning: true,
          blockId: 'search-index',
          blockType: 'text',
          blockIndex: 0,
          snippet: 'hello brave world transcript',
        },
      ],
    });
  });

  it('returns null for missing query strings', () => {
    expect(buildFastConversationContentSearchResponse({ body: {}, sessions: [], readSearchText: () => null })).toBeNull();
  });
});
