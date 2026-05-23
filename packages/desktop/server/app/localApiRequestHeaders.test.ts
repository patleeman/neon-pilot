import { describe, expect, it } from 'vitest';

import { normalizeLocalApiRequestHeaders, readLocalApiRequestHeader } from './localApiRequestHeaders';

describe('localApiRequestHeaders', () => {
  it('normalizes request header names to lowercase', () => {
    expect(normalizeLocalApiRequestHeaders({ Authorization: 'token', 'X-Test': 'yes' })).toEqual({
      authorization: 'token',
      'x-test': 'yes',
    });
    expect(normalizeLocalApiRequestHeaders()).toEqual({});
  });

  it('reads headers case-insensitively from normalized headers', () => {
    const headers = normalizeLocalApiRequestHeaders({ Authorization: 'token' });
    expect(readLocalApiRequestHeader(headers, 'authorization')).toBe('token');
    expect(readLocalApiRequestHeader(headers, 'Authorization')).toBe('token');
    expect(readLocalApiRequestHeader(headers, 'missing')).toBeUndefined();
  });
});
