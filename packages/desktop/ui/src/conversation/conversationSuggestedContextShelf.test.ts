import { describe, expect, it, vi } from 'vitest';

import { buildSuggestedContextShelfState } from './conversationSuggestedContextShelf';

describe('conversationSuggestedContextShelf', () => {
  it('builds suggested context shelf state without reshaping values', () => {
    const onToggle = vi.fn();
    const results = [{ id: 'a' }];
    expect(
      buildSuggestedContextShelfState({
        query: 'abc',
        results,
        selectedSessionIds: ['a'],
        autoSelectedSessionIds: ['b'],
        loading: true,
        busy: false,
        error: 'nope',
        maxSelections: 5,
        hotkeyLimit: 9,
        onToggle,
      }),
    ).toEqual({
      query: 'abc',
      results,
      selectedSessionIds: ['a'],
      autoSelectedSessionIds: ['b'],
      loading: true,
      busy: false,
      error: 'nope',
      maxSelections: 5,
      hotkeyLimit: 9,
      onToggle,
    });
  });
});
