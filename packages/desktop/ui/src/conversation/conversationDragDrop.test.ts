import { describe, expect, it } from 'vitest';

import {
  nextDragOverStateForDragEnd,
  nextDragOverStateForDragOver,
  readDroppedComposerWorkspacePath,
  shouldHandleDroppedComposerFiles,
} from './conversationDragDrop';

describe('conversationDragDrop', () => {
  it('resolves drag-over state transitions', () => {
    expect(nextDragOverStateForDragOver()).toBe(true);
    expect(nextDragOverStateForDragEnd()).toBe(false);
  });

  it('detects dropped files worth handling', () => {
    expect(shouldHandleDroppedComposerFiles([])).toBe(false);
    expect(shouldHandleDroppedComposerFiles([{} as File])).toBe(true);
  });

  it('reads workspace paths from File Explorer text drops', () => {
    expect(
      readDroppedComposerWorkspacePath({
        files: { length: 0 },
        types: ['text/plain'],
        getData: () => ' README.md ',
      }),
    ).toBe('README.md');
  });

  it('ignores file, non-text, and multi-line drops for workspace paths', () => {
    expect(
      readDroppedComposerWorkspacePath({
        files: { length: 1 },
        types: ['text/plain'],
        getData: () => 'README.md',
      }),
    ).toBeNull();
    expect(
      readDroppedComposerWorkspacePath({
        files: { length: 0 },
        types: ['text/html'],
        getData: () => 'README.md',
      }),
    ).toBeNull();
    expect(
      readDroppedComposerWorkspacePath({
        files: { length: 0 },
        types: ['text/plain'],
        getData: () => 'README.md\npackage.json',
      }),
    ).toBeNull();
  });
});
