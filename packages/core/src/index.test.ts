import { describe, expect, it } from 'vitest';

import { getDefaultKnowledgeRoot, getDefaultStateRoot } from './index.js';

describe('core exports', () => {
  it('exports runtime path helpers', () => {
    expect(getDefaultStateRoot()).toContain('neon-pilot');
    expect(getDefaultKnowledgeRoot()).toContain('neon-pilot');
  });
});
