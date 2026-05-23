import { describe, expect, it } from 'vitest';

import { nextDragOverStateForDragEnd, nextDragOverStateForDragOver, shouldHandleDroppedComposerFiles } from './conversationDragDrop';

describe('conversationDragDrop', () => {
  it('resolves drag-over state transitions', () => {
    expect(nextDragOverStateForDragOver()).toBe(true);
    expect(nextDragOverStateForDragEnd()).toBe(false);
  });

  it('detects dropped files worth handling', () => {
    expect(shouldHandleDroppedComposerFiles([])).toBe(false);
    expect(shouldHandleDroppedComposerFiles([{} as File])).toBe(true);
  });
});
