import { describe, expect, it } from 'vitest';

import { appendSessionSearchSegment, buildSessionSearchTextFromEntries, normalizeSearchSegment } from './sessionSearchText';

describe('sessionSearchText', () => {
  it('normalizes and truncates search segments', () => {
    expect(normalizeSearchSegment('  hello\n world  ')).toBe('hello world');
    expect(normalizeSearchSegment('abcdef', 4)).toBe('abc…');
    expect(normalizeSearchSegment('   ')).toBe('');
  });

  it('appends segments within the remaining budget', () => {
    const segments: string[] = [];
    expect(appendSessionSearchSegment(segments, '  hello world  ', 20)).toBe(8);
    expect(segments).toEqual(['hello world']);
    expect(appendSessionSearchSegment(segments, 'abcdef', 4)).toBe(0);
    expect(segments).toEqual(['hello world', 'abc…']);
    expect(appendSessionSearchSegment(segments, 'ignored', 0)).toBe(0);
  });

  it('builds recent-first search text and returns chronological output', () => {
    const entries = [
      { type: 'message', message: { text: 'old' } },
      { type: 'model_change', message: { text: 'ignored' } },
      { type: 'message', message: { text: 'new' } },
    ];

    expect(buildSessionSearchTextFromEntries(entries, 100, (message) => message.text)).toBe('old\nnew');
    expect(buildSessionSearchTextFromEntries(entries, 4, (message) => message.text)).toBe('new');
  });
});
