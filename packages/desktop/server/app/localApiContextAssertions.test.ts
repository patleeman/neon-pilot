import { describe, expect, it } from 'vitest';

import {
  assertLocalLiveSessionCapabilityContext,
  assertLocalProviderDesktopCapabilityContext,
  assertLocalServerRouteContext,
} from './localApiContextAssertions';

describe('localApiContextAssertions', () => {
  it('returns initialized contexts', () => {
    const context = { ok: true };
    expect(assertLocalServerRouteContext(context)).toBe(context);
    expect(assertLocalLiveSessionCapabilityContext(context)).toBe(context);
    expect(assertLocalProviderDesktopCapabilityContext(context)).toBe(context);
  });

  it('throws stable initialization errors for missing contexts', () => {
    expect(() => assertLocalServerRouteContext(null)).toThrow('Local server route context is not initialized.');
    expect(() => assertLocalLiveSessionCapabilityContext(undefined)).toThrow('Local live-session capability context is not initialized.');
    expect(() => assertLocalProviderDesktopCapabilityContext(null)).toThrow('Local provider/model capability context is not initialized.');
  });
});
