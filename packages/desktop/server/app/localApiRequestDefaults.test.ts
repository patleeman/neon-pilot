import { describe, expect, it } from 'vitest';

import { buildLocalApiRequestSocket, LOCAL_API_LOOPBACK_IP, LOCAL_API_REQUEST_PROTOCOL } from './localApiRequestDefaults';

describe('localApiRequestDefaults', () => {
  it('exposes desktop local API request defaults', () => {
    expect(LOCAL_API_REQUEST_PROTOCOL).toBe('desktop');
    expect(LOCAL_API_LOOPBACK_IP).toBe('127.0.0.1');
    expect(buildLocalApiRequestSocket()).toEqual({ remoteAddress: '127.0.0.1' });
  });
});
