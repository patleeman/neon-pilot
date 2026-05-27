import { describe, expect, it } from 'vitest';

import { normalizeConversationContentSearchLimit, normalizeDurableRunLogTailParam, normalizeKnowledgeSearchLimit } from './api';

describe('normalizeDurableRunLogTailParam', () => {
  it('rejects malformed run log tails and caps expensive tails', () => {
    expect(normalizeDurableRunLogTailParam(25)).toBe(25);
    expect(normalizeDurableRunLogTailParam(25.5)).toBeUndefined();
    expect(normalizeDurableRunLogTailParam(Number.MAX_SAFE_INTEGER + 1)).toBeUndefined();
    expect(normalizeDurableRunLogTailParam(5000)).toBe(1000);
  });
});

describe('normalizeConversationContentSearchLimit', () => {
  it('rejects malformed search limits and caps expensive searches', () => {
    expect(normalizeConversationContentSearchLimit(25)).toBe(25);
    expect(normalizeConversationContentSearchLimit(25.5)).toBe(80);
    expect(normalizeConversationContentSearchLimit(5000)).toBe(100);
  });
});

describe('normalizeKnowledgeSearchLimit', () => {
  it('rejects malformed knowledge search limits and caps expensive searches', () => {
    expect(normalizeKnowledgeSearchLimit(12)).toBe(12);
    expect(normalizeKnowledgeSearchLimit(12.5)).toBe(20);
    expect(normalizeKnowledgeSearchLimit(Number.MAX_SAFE_INTEGER + 1)).toBe(20);
    expect(normalizeKnowledgeSearchLimit(5000)).toBe(50);
  });
});
