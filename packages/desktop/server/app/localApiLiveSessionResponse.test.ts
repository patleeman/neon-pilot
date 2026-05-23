import { describe, expect, it } from 'vitest';

import {
  assertLiveConversationExists,
  buildDesktopLiveSessionResponse,
  normalizeRequiredLiveConversationId,
} from './localApiLiveSessionResponse';

describe('localApiLiveSessionResponse', () => {
  it('normalizes required live conversation ids', () => {
    expect(normalizeRequiredLiveConversationId(' live ', 'missing')).toBe('live');
    expect(() => normalizeRequiredLiveConversationId('  ', 'missing')).toThrow('missing');
  });

  it('asserts live conversation availability', () => {
    expect(() => assertLiveConversationExists({ conversationId: 'live', isLive: true }, '404 Not Found')).not.toThrow();
    expect(() => assertLiveConversationExists({ conversationId: '', isLive: true }, '404 Not Found')).toThrow('404 Not Found');
    expect(() => assertLiveConversationExists({ conversationId: 'stored', isLive: false }, '404 Not Found')).toThrow('404 Not Found');
  });

  it('builds live session responses', () => {
    expect(buildDesktopLiveSessionResponse({ id: 'live' })).toEqual({ live: true, id: 'live' });
  });
});
