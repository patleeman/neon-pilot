import { describe, expect, it } from 'vitest';

import { isRawDisplayLineType, parseJsonLine } from './sessionJsonLines';

describe('sessionJsonLines', () => {
  it('parses JSON lines safely', () => {
    expect(parseJsonLine<{ type: string }>('{"type":"message"}')).toEqual({ type: 'message' });
    expect(parseJsonLine('not json')).toBeNull();
  });

  it('detects display line types', () => {
    expect(isRawDisplayLineType({ type: 'message' })).toBe(true);
    expect(isRawDisplayLineType({ type: 'custom_message' })).toBe(true);
    expect(isRawDisplayLineType({ type: 'compaction' })).toBe(true);
    expect(isRawDisplayLineType({ type: 'branch_summary' })).toBe(true);
    expect(isRawDisplayLineType({ type: 'session' })).toBe(false);
    expect(isRawDisplayLineType({})).toBe(false);
  });
});
