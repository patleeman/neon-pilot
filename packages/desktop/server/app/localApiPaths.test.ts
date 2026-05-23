import { describe, expect, it } from 'vitest';

import { resolveLocalApiRepoRoot } from './localApiPaths';

describe('localApiPaths', () => {
  it('resolves repo root with env precedence', () => {
    expect(resolveLocalApiRepoRoot({ envRepoRoot: '/repo', envResourcesRoot: '/resources', defaultRepoRoot: '/default' })).toBe('/repo');
    expect(resolveLocalApiRepoRoot({ envResourcesRoot: '/resources', defaultRepoRoot: '/default' })).toBe('/resources');
    expect(resolveLocalApiRepoRoot({ defaultRepoRoot: '/default' })).toBe('/default');
  });
});
