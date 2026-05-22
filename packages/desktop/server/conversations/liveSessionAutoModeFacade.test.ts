import { describe, expect, it } from 'vitest';

import * as facade from './liveSessionAutoModeFacade.js';

describe('liveSessionAutoModeFacade', () => {
  it('is an empty compatibility module because auto mode moved to system-goal', () => {
    expect(Object.keys(facade)).toEqual([]);
  });
});
