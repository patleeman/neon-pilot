import { describe, expect, it } from 'vitest';

import { assertAttentionTargetUpdated, buildDesktopOkResponse, resolveAttentionReadValue } from './localApiAttentionResponse';

describe('localApiAttentionResponse', () => {
  it('defaults attention read updates to true unless explicitly false', () => {
    expect(resolveAttentionReadValue(undefined)).toBe(true);
    expect(resolveAttentionReadValue(true)).toBe(true);
    expect(resolveAttentionReadValue(false)).toBe(false);
  });

  it('throws the supplied not-found message when no target was updated', () => {
    expect(() => assertAttentionTargetUpdated(false, 'Conversation not found')).toThrow('Conversation not found');
    expect(() => assertAttentionTargetUpdated(true, 'Conversation not found')).not.toThrow();
  });

  it('builds a standard ok response', () => {
    expect(buildDesktopOkResponse()).toEqual({ ok: true });
  });
});
