import { describe, expect, it } from 'vitest';

import { assertRollbackLiveSessionNotStreaming, buildRollbackConversationResponse } from './localApiRollbackResponse';

describe('localApiRollbackResponse', () => {
  it('builds rollback responses', () => {
    expect(buildRollbackConversationResponse({ id: 'c1', sessionFile: '/tmp/c1.jsonl' })).toEqual({
      id: 'c1',
      sessionFile: '/tmp/c1.jsonl',
    });
  });

  it('rejects rollback while live session is streaming', () => {
    expect(() => assertRollbackLiveSessionNotStreaming(false)).not.toThrow();
    expect(() => assertRollbackLiveSessionNotStreaming(true)).toThrow('Cannot roll back a running conversation. Interrupt it first.');
  });
});
