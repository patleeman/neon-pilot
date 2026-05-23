import { describe, expect, it } from 'vitest';

import type { SessionMeta } from '../shared/types';
import { resolveRelatedThreadResults, selectDraftRelatedThreadCandidates } from './conversationRelatedThreadPanel';

function buildSession(overrides: Partial<SessionMeta> & Pick<SessionMeta, 'id' | 'title' | 'cwd'>): SessionMeta {
  return {
    id: overrides.id,
    file: overrides.file ?? `/sessions/${overrides.id}.jsonl`,
    timestamp: overrides.timestamp ?? '2026-04-10T12:00:00.000Z',
    cwd: overrides.cwd,
    cwdSlug: overrides.cwd.replace(/\//g, '-'),
    model: overrides.model ?? 'openai/gpt-5',
    title: overrides.title,
    messageCount: overrides.messageCount ?? 6,
    ...(overrides.lastActivityAt ? { lastActivityAt: overrides.lastActivityAt } : {}),
  };
}

describe('conversationRelatedThreadPanel', () => {
  it('selects candidates only for draft conversations', () => {
    const sessions = [buildSession({ id: 'a', title: 'A', cwd: '/repo', lastActivityAt: new Date().toISOString() })];
    expect(selectDraftRelatedThreadCandidates({ draft: false, sessions, workspaceCwd: '/repo', recentWindowDays: 3, limit: 5 })).toEqual(
      [],
    );
    expect(
      selectDraftRelatedThreadCandidates({ draft: true, sessions, workspaceCwd: '/repo', recentWindowDays: 3, limit: 5 }),
    ).toHaveLength(1);
  });

  it('resolves visible related thread results from candidates', () => {
    const candidates = [
      buildSession({ id: 'a', title: 'Alpha', cwd: '/repo', lastActivityAt: '2026-01-01T00:00:00.000Z' }),
      buildSession({ id: 'b', title: 'Beta', cwd: '/repo', lastActivityAt: '2026-01-02T00:00:00.000Z' }),
    ];
    const results = resolveRelatedThreadResults({
      selectedRelatedThreadIds: ['a'],
      query: 'beta',
      candidates,
      searchIndex: new Map([
        ['a', 'alpha'],
        ['b', 'beta'],
      ]),
      summaries: new Map(),
      workspaceCwd: '/repo',
      limit: 10,
    });
    expect(results.map((result) => result.sessionId)).toContain('a');
    expect(results.map((result) => result.sessionId)).toContain('b');
  });
});
