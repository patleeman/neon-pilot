import { describe, expect, it } from 'vitest';

import { buildCustomSessionEntry, serializeSessionJsonLine } from './sessionCustomEntrySerialization';

describe('sessionCustomEntrySerialization', () => {
  it('serializes JSONL entries with a trailing newline', () => {
    expect(serializeSessionJsonLine({ type: 'custom', id: 'x' })).toBe('{"type":"custom","id":"x"}\n');
  });

  it('builds custom session metadata entries', () => {
    expect(buildCustomSessionEntry({ id: 'id', parentId: null, timestamp: 'now', customType: 'kind', data: { ok: true } })).toEqual({
      type: 'custom',
      id: 'id',
      parentId: null,
      timestamp: 'now',
      customType: 'kind',
      data: { ok: true },
    });
  });
});
