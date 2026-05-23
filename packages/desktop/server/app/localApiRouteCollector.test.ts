import { describe, expect, it } from 'vitest';

import { noopLocalApiUse, shouldRegisterLocalApiRoute } from './localApiRouteCollector';

describe('localApiRouteCollector', () => {
  it('registers only when a handler is present', () => {
    expect(shouldRegisterLocalApiRoute(() => undefined)).toBe(true);
    expect(shouldRegisterLocalApiRoute(undefined)).toBe(false);
    expect(shouldRegisterLocalApiRoute(null)).toBe(false);
  });

  it('keeps local API use middleware as a no-op', () => {
    expect(noopLocalApiUse()).toBeUndefined();
  });
});
