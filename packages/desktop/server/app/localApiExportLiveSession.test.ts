import { describe, expect, it } from 'vitest';

import {
  buildExportLiveSessionResponse,
  normalizeExportLiveSessionConversationId,
  normalizeOptionalExportOutputPath,
} from './localApiExportLiveSession';

describe('localApiExportLiveSession', () => {
  it('normalizes required conversation ids', () => {
    expect(normalizeExportLiveSessionConversationId(' c1 ')).toBe('c1');
    expect(() => normalizeExportLiveSessionConversationId('  ')).toThrow('conversationId required');
  });

  it('normalizes optional output paths', () => {
    expect(normalizeOptionalExportOutputPath(' /tmp/out.html ')).toBe('/tmp/out.html');
    expect(normalizeOptionalExportOutputPath('  ')).toBeUndefined();
    expect(normalizeOptionalExportOutputPath(undefined)).toBeUndefined();
  });

  it('builds export responses', () => {
    expect(buildExportLiveSessionResponse({ path: '/tmp/out.html' })).toEqual({ ok: true, path: '/tmp/out.html' });
  });
});
