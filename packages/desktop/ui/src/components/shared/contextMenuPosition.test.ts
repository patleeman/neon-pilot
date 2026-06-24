import { describe, expect, it } from 'vitest';

import { clampViewportMenuPosition, estimateContextMenuHeight } from './contextMenuPosition';

describe('context menu positioning', () => {
  it('estimates compact menu height from items and separators', () => {
    expect(estimateContextMenuHeight({ itemCount: 1 })).toBe(34);
    expect(estimateContextMenuHeight({ itemCount: 3, separatorCount: 2 })).toBe(100);
  });

  it('clamps menus inside the viewport edge padding', () => {
    expect(clampViewportMenuPosition({ x: 1, y: 2 }, { width: 224, height: 64 }, { width: 500, height: 300 })).toEqual({
      x: 12,
      y: 12,
    });
    expect(clampViewportMenuPosition({ x: 490, y: 290 }, { width: 224, height: 64 }, { width: 500, height: 300 })).toEqual({
      x: 264,
      y: 224,
    });
  });

  it('falls back when geometry is malformed', () => {
    expect(
      clampViewportMenuPosition({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, { width: 224, height: 64 }, { width: 500, height: 300 }),
    ).toEqual({ x: 12, y: 12 });
  });
});
