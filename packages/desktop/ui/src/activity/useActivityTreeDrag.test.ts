import { describe, expect, it } from 'vitest';

import { getActivityTreeDropPosition } from './useActivityTreeDrag';

function dragEvent(clientY: number, top = 10, height = 100): React.DragEvent<HTMLElement> {
  return {
    clientY,
    currentTarget: {
      getBoundingClientRect: () => ({ top, height }) as DOMRect,
    },
  } as React.DragEvent<HTMLElement>;
}

describe('getActivityTreeDropPosition', () => {
  it('uses the target midpoint to choose before or after', () => {
    expect(getActivityTreeDropPosition(dragEvent(25))).toBe('before');
    expect(getActivityTreeDropPosition(dragEvent(75))).toBe('after');
  });
});
