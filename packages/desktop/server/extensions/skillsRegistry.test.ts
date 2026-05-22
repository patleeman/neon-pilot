import { describe, expect, it } from 'vitest';

import { buildFilteredSkillPaths, readDisabledSkillIds, setSkillEnabled } from './skillsRegistry.js';

describe('extension skillsRegistry API', () => {
  it('re-exports skill inventory controls for extension backends', () => {
    expect(buildFilteredSkillPaths).toBeTypeOf('function');
    expect(readDisabledSkillIds).toBeTypeOf('function');
    expect(setSkillEnabled).toBeTypeOf('function');
  });
});
