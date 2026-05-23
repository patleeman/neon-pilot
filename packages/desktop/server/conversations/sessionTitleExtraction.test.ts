import { describe, expect, it } from 'vitest';

import { extractTitleFromMessage } from './sessionTitleExtraction';

const tinyPng = 'iVBORw0KGgo=';

describe('sessionTitleExtraction', () => {
  it('extracts a title from user text', () => {
    expect(extractTitleFromMessage({ role: 'user', content: [{ type: 'text', text: '  hello title  ' }] })).toBe('hello title');
  });

  it('includes image-only user messages in title generation', () => {
    expect(extractTitleFromMessage({ role: 'user', content: [{ type: 'image', mimeType: 'image/png', data: tinyPng }] })).toBe(
      '(image attachment)',
    );
  });

  it('ignores non-user messages', () => {
    expect(extractTitleFromMessage({ role: 'assistant', content: [{ type: 'text', text: 'hello' }] })).toBeNull();
  });
});
