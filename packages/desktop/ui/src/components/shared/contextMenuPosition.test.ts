import { describe, expect, it } from 'vitest';

import { clampViewportMenuPosition, estimateContextMenuHeight, getViewportMenuTranslation } from './contextMenuPosition';

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

  it('uses fractional browser-measured geometry when clamping menus', () => {
    expect(clampViewportMenuPosition({ x: 780, y: 590 }, { width: 224.5, height: 80.5 }, { width: 800, height: 600 })).toEqual({
      x: 563.5,
      y: 507.5,
    });
  });

  it('falls back when geometry is malformed', () => {
    expect(
      clampViewportMenuPosition({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, { width: 224, height: 64 }, { width: 500, height: 300 }),
    ).toEqual({ x: 12, y: 12 });
  });

  it('translates measured menu bounds inside the viewport edge padding', () => {
    expect(
      getViewportMenuTranslation(
        { left: 490, right: 714, top: 290, bottom: 370 },
        {
          width: 500,
          height: 300,
        },
      ),
    ).toEqual({ x: -226, y: -82 });
  });
});
