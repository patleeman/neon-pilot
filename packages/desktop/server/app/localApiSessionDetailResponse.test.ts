import { describe, expect, it } from 'vitest';

import {
  buildUnchangedSessionDetailResponse,
  shouldBuildAppendOnlySessionDetail,
  shouldReturnUnchangedSessionDetail,
} from './localApiSessionDetailResponse';

describe('localApiSessionDetailResponse', () => {
  it('builds unchanged responses', () => {
    expect(buildUnchangedSessionDetailResponse({ sessionId: 's1', signature: 'sig' })).toEqual({
      unchanged: true,
      sessionId: 's1',
      signature: 'sig',
    });
  });

  it('detects unchanged session details only when known and current signatures match', () => {
    expect(shouldReturnUnchangedSessionDetail({ knownSessionSignature: 'a', currentSessionSignature: 'a' })).toBe(true);
    expect(shouldReturnUnchangedSessionDetail({ knownSessionSignature: 'a', currentSessionSignature: 'b' })).toBe(false);
    expect(shouldReturnUnchangedSessionDetail({ knownSessionSignature: 'a', currentSessionSignature: null })).toBe(false);
  });

  it('builds append-only details when known and next signatures differ', () => {
    expect(shouldBuildAppendOnlySessionDetail({ knownSessionSignature: 'a', nextSessionSignature: 'b' })).toBe(true);
    expect(shouldBuildAppendOnlySessionDetail({ knownSessionSignature: 'a', nextSessionSignature: 'a' })).toBe(false);
    expect(shouldBuildAppendOnlySessionDetail({ nextSessionSignature: 'b' })).toBe(false);
  });
});
