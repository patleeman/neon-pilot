import { describe, expect, it } from 'vitest';

import { decorateSessionParentIds, readSourceRunIdFromSessionFilePath, resolveSessionIdByFile } from './sessionTopologyMetadata';

const normalizeOptionalPath = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

describe('sessionTopologyMetadata', () => {
  it('reads source run ids from run session paths', () => {
    expect(readSourceRunIdFromSessionFilePath({ sessionsDir: '/sessions', filePath: '/sessions/__runs/run-1/thread/a.jsonl' })).toBe(
      'run-1',
    );
    expect(readSourceRunIdFromSessionFilePath({ sessionsDir: '/sessions', filePath: '/sessions/a.jsonl' })).toBeUndefined();
  });

  it('decorates parent session ids from parent session files', () => {
    const parent = { id: 'parent', file: '/sessions/parent.jsonl' };
    const child = { id: 'child', file: '/sessions/child.jsonl', parentSessionFile: ' /sessions/parent.jsonl ' };

    expect(decorateSessionParentIds([parent, child], normalizeOptionalPath)).toEqual([
      parent,
      { ...child, parentSessionFile: '/sessions/parent.jsonl', parentSessionId: 'parent' },
    ]);
  });

  it('resolves session ids by normalized file path', () => {
    expect(
      resolveSessionIdByFile({
        filePath: ' /sessions/a.jsonl ',
        sessionFileById: new Map([['s1', '/sessions/a.jsonl']]),
        normalizeOptionalPath,
      }),
    ).toBe('s1');
    expect(resolveSessionIdByFile({ filePath: '   ', sessionFileById: new Map(), normalizeOptionalPath })).toBeUndefined();
  });
});
