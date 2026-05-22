import { describe, expect, it } from 'vitest';

import * as ops from './liveSessionAutoModeOps.js';

describe('liveSessionAutoModeOps', () => {
  it('is an empty compatibility module because auto mode moved to system-goal', () => {
    expect(Object.keys(ops)).toEqual([]);
  });
});
