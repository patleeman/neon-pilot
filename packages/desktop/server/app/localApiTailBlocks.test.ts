import { describe, expect, it } from 'vitest';

import { normalizeDesktopLocalApiTailBlocks } from './localApiTailBlocks';

describe('localApiTailBlocks', () => {
  it('accepts positive safe integers and caps large values', () => {
    expect(normalizeDesktopLocalApiTailBlocks(20)).toBe(20);
    expect(normalizeDesktopLocalApiTailBlocks(50000)).toBe(10000);
  });

  it('rejects non-positive, non-number, and unsafe values', () => {
    expect(normalizeDesktopLocalApiTailBlocks(0)).toBeUndefined();
    expect(normalizeDesktopLocalApiTailBlocks(-1)).toBeUndefined();
    expect(normalizeDesktopLocalApiTailBlocks(1.5)).toBeUndefined();
    expect(normalizeDesktopLocalApiTailBlocks('20')).toBeUndefined();
    expect(normalizeDesktopLocalApiTailBlocks(Number.MAX_SAFE_INTEGER + 1)).toBeUndefined();
  });
});
