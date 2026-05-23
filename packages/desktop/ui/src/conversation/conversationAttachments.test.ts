import { describe, expect, it } from 'vitest';

import { appendIfPresent, shouldAddDroppedFiles } from './conversationAttachments';

describe('conversationAttachments', () => {
  it('appends only when there are new items', () => {
    const current = ['a'];
    expect(appendIfPresent(current, [])).toBe(current);
    expect(appendIfPresent(current, ['b'])).toEqual(['a', 'b']);
  });

  it('detects dropped files worth adding', () => {
    expect(shouldAddDroppedFiles([])).toBe(false);
    expect(shouldAddDroppedFiles([{} as File])).toBe(true);
  });
});
