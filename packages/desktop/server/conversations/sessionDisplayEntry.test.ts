import { describe, expect, it } from 'vitest';

import { buildDisplayMessageEntryFromRawLine } from './sessionDisplayEntry';

describe('sessionDisplayEntry', () => {
  it('maps raw message lines through unchanged', () => {
    const message = { role: 'user', content: 'hello' };
    expect(buildDisplayMessageEntryFromRawLine({ type: 'message', id: 'm1', parentId: null, timestamp: 1, message })).toEqual({
      id: 'm1',
      parentId: null,
      timestamp: 1,
      message,
    });
  });

  it('maps custom, compaction, and branch summary lines to display entries', () => {
    expect(
      buildDisplayMessageEntryFromRawLine({
        type: 'custom_message',
        id: 'c1',
        parentId: 'm1',
        timestamp: 2,
        content: 'body',
        customType: 'x',
        display: true,
      }),
    ).toMatchObject({ message: { role: 'custom', content: 'body', customType: 'x', display: true } });
    expect(
      buildDisplayMessageEntryFromRawLine({
        type: 'compaction',
        id: 'k1',
        parentId: 'm1',
        timestamp: 3,
        summary: 'short',
        tokensBefore: 10,
      }),
    ).toMatchObject({ message: { role: 'compactionSummary', summary: 'short', tokensBefore: 10 } });
    expect(
      buildDisplayMessageEntryFromRawLine({
        type: 'branch_summary',
        id: 'b1',
        parentId: 'm1',
        timestamp: 4,
        summary: 'branch',
        fromId: 'm0',
      }),
    ).toMatchObject({ message: { role: 'branchSummary', summary: 'branch', fromId: 'm0' } });
  });
});
