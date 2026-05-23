import { describe, expect, it } from 'vitest';

import {
  buildSuppressedTranscriptError,
  collectSuppressedTranscriptEntryIds,
  shouldSuppressTranscriptDescendants,
} from './sessionSuppression';

describe('sessionSuppression', () => {
  it('does not suppress by default', () => {
    expect(shouldSuppressTranscriptDescendants({ role: 'assistant' })).toBe(false);
    expect(collectSuppressedTranscriptEntryIds([{ id: 'a', message: { role: 'assistant' } }])).toEqual(new Set());
  });

  it('collects descendants of suppressed roots but stops at user messages', () => {
    const messages = [
      { id: 'root', parentId: null, message: { role: 'assistant', suppress: true } },
      { id: 'child', parentId: 'root', message: { role: 'assistant' } },
      { id: 'user', parentId: 'child', message: { role: 'user' } },
      { id: 'after-user', parentId: 'user', message: { role: 'assistant' } },
    ];

    expect(collectSuppressedTranscriptEntryIds(messages, (message) => message.suppress === true)).toEqual(new Set(['root', 'child']));
  });

  it('builds transparency violation errors', () => {
    expect(buildSuppressedTranscriptError(1).message).toContain('entry was');
    expect(buildSuppressedTranscriptError(2).message).toContain('entries were');
  });
});
