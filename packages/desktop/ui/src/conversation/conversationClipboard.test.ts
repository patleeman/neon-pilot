import { describe, expect, it } from 'vitest';

import { shouldHandlePastedComposerFiles } from './conversationClipboard';

describe('conversationClipboard', () => {
  it('handles paste only when files are present', () => {
    expect(shouldHandlePastedComposerFiles([])).toBe(false);
    expect(shouldHandlePastedComposerFiles([{} as File])).toBe(true);
  });
});
