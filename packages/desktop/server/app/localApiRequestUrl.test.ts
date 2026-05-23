import { describe, expect, it } from 'vitest';

import { buildLocalApiRequestUrl } from './localApiRequestUrl';

describe('localApiRequestUrl', () => {
  it('builds local API request urls from pathname and search', () => {
    expect(buildLocalApiRequestUrl('/api/session', '?tail=10')).toBe('/api/session?tail=10');
    expect(buildLocalApiRequestUrl('/api/session', '')).toBe('/api/session');
  });
});
