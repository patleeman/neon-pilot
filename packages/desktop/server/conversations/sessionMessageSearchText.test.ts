import { describe, expect, it } from 'vitest';

import { extractSearchTextFromMessage } from './sessionMessageSearchText';

describe('sessionMessageSearchText', () => {
  it('extracts user text through user content normalization', () => {
    expect(extractSearchTextFromMessage({ role: 'user', content: [{ type: 'text', text: ' hello ' }] })).toBe('hello');
  });

  it('extracts assistant text blocks without trimming aggregate text', () => {
    expect(
      extractSearchTextFromMessage({
        role: 'assistant',
        content: [
          { type: 'text', text: ' first ' },
          { type: 'toolCall', id: 't1', name: 'x', arguments: {} },
          { type: 'text', text: 'second' },
        ],
      }),
    ).toBe(' first \nsecond');
  });

  it('ignores non-user and non-assistant messages', () => {
    expect(extractSearchTextFromMessage({ role: 'toolResult', content: [{ type: 'text', text: 'hidden' }] })).toBe('');
  });
});
