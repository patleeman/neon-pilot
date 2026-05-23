import { describe, expect, it } from 'vitest';

import { buildLocalApiQueryObject, buildLocalApiRoutePattern, findMatchingLocalApiRoute } from './localApiRouting';

describe('localApiRouting', () => {
  it('builds route patterns with named params and wildcard captures', () => {
    const route = buildLocalApiRoutePattern('/api/conversations/:id/files/*');

    expect(route.keys).toEqual(['id', '0']);
    const match = route.pattern.exec('/api/conversations/abc%201/files/path/to/file.txt');
    expect(match?.slice(1)).toEqual(['abc%201', 'path/to/file.txt']);
    expect(route.pattern.test('/api/conversations/abc%201/files')).toBe(false);
  });

  it('escapes literal regex metacharacters in route segments', () => {
    const route = buildLocalApiRoutePattern('/api/model/:id/v1.0+test');

    expect(route.pattern.test('/api/model/openai/v1.0+test')).toBe(true);
    expect(route.pattern.test('/api/model/openai/v110-test')).toBe(false);
  });

  it('builds query objects preserving repeated keys as arrays', () => {
    expect(buildLocalApiQueryObject(new URLSearchParams('q=hello&tag=a&tag=b&empty='))).toEqual({
      q: 'hello',
      tag: ['a', 'b'],
      empty: '',
    });
  });

  it('finds matching routes by method and pattern', () => {
    const routes = [
      { method: 'GET', pattern: buildLocalApiRoutePattern('/api/items/:id').pattern, name: 'get-item' },
      { method: 'POST', pattern: buildLocalApiRoutePattern('/api/items/:id').pattern, name: 'post-item' },
    ];

    expect(findMatchingLocalApiRoute(routes, 'POST', '/api/items/one')?.name).toBe('post-item');
    expect(findMatchingLocalApiRoute(routes, 'DELETE', '/api/items/one')).toBeUndefined();
  });
});
