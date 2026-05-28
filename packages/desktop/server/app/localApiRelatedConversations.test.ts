import { describe, expect, it } from 'vitest';

import { buildRelatedConversationResults } from './localApiRelatedConversations.js';

describe('buildRelatedConversationResults', () => {
  it('ranks related conversations and keeps selected conversations visible', () => {
    const result = buildRelatedConversationResults({
      sessions: [
        {
          id: 'selected',
          title: 'Selected thread',
          cwd: '/repo',
          timestamp: '2026-04-10T12:00:00.000Z',
          messageCount: 4,
        },
        {
          id: 'match',
          title: 'Transcript loading performance',
          cwd: '/repo',
          timestamp: '2026-04-11T12:00:00.000Z',
          lastActivityAt: '2026-04-12T12:00:00.000Z',
          messageCount: 8,
        },
        {
          id: 'other',
          title: 'Unrelated notes',
          cwd: '/elsewhere',
          timestamp: '2026-04-09T12:00:00.000Z',
          messageCount: 5,
        },
      ],
      searchIndex: {
        selected: 'manual selected context',
        match: 'renderer transcript loading backend performance',
        other: 'calendar reminders',
      },
      summaries: {
        match: {
          displaySummary: 'Moved transcript loading work out of the renderer.',
          searchText: 'transcript renderer backend performance',
          keyTerms: ['transcript', 'renderer'],
          filesTouched: ['packages/desktop/server/app/localApi.ts'],
          status: 'done',
        },
      },
      query: 'transcript backend performance',
      workspaceCwd: '/repo',
      selectedRelatedThreadIds: ['selected'],
      limit: 5,
      nowMs: Date.parse('2026-04-13T12:00:00.000Z'),
    });

    expect(result.searchResults.map((item) => item.sessionId)).toEqual(['match']);
    expect(result.visibleResults.map((item) => item.sessionId)).toEqual(['selected', 'match']);
    expect(result.visibleResults[1]?.sameWorkspace).toBe(true);
    expect(result.visibleResults[1]?.reason).toContain('Same workspace');
  });

  it('does not fuzzy-match unrelated tokens across long transcript text', () => {
    const longTranscriptText = `${'renderer '.repeat(1000)}${'background '.repeat(1000)}performance`;

    const result = buildRelatedConversationResults({
      sessions: [
        {
          id: 'long',
          title: 'Long transcript',
          cwd: '/repo',
          timestamp: '2026-04-10T12:00:00.000Z',
        },
      ],
      searchIndex: {
        long: longTranscriptText,
      },
      summaries: {},
      query: 'zzzz',
      workspaceCwd: '/repo',
      limit: 5,
      nowMs: Date.parse('2026-04-13T12:00:00.000Z'),
    });

    expect(result.searchResults).toEqual([]);
    expect(result.visibleResults).toEqual([]);
  });
});
