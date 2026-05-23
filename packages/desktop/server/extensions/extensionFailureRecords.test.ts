import { describe, expect, it } from 'vitest';

import { normalizeExtensionFailureRecords } from './extensionFailureRecords';

describe('extensionFailureRecords', () => {
  it('normalizes failure records and drops malformed entries', () => {
    expect(
      normalizeExtensionFailureRecords({
        flaky: [
          { at: '2026-05-23T00:00:00.000Z', operation: 'tool call', error: 'boom' },
          { at: '2026-05-23T00:01:00.000Z', operation: 'missing error' },
          null,
        ],
        ignored: 'not records',
      }),
    ).toEqual({
      flaky: [{ at: '2026-05-23T00:00:00.000Z', operation: 'tool call', error: 'boom' }],
    });
  });

  it('returns an empty map for non-record values', () => {
    expect(normalizeExtensionFailureRecords(null)).toEqual({});
    expect(normalizeExtensionFailureRecords([])).toEqual({});
  });
});
