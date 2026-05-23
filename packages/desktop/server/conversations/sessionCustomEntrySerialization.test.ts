import { describe, expect, it } from 'vitest';

import { buildCustomMessageSessionEntry, buildCustomSessionEntry, serializeSessionJsonLine } from './sessionCustomEntrySerialization';

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

  it('builds custom message session entries with optional details', () => {
    expect(buildCustomMessageSessionEntry({ id: 'id', parentId: 'parent', timestamp: 'now', customType: 'kind', content: 'body' })).toEqual(
      {
        type: 'custom_message',
        id: 'id',
        parentId: 'parent',
        timestamp: 'now',
        customType: 'kind',
        content: 'body',
      },
    );
    expect(
      buildCustomMessageSessionEntry({
        id: 'id',
        parentId: null,
        timestamp: 'now',
        customType: 'kind',
        content: 'body',
        details: { ok: true },
      }),
    ).toMatchObject({ details: { ok: true } });
  });
});
