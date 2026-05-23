import { describe, expect, it } from 'vitest';

import {
  buildPersistentSessionIndexDocument,
  loadPersistentSessionIndexEntry,
  serializePersistentSessionIndex,
  type SessionMetaLike,
} from './sessionIndexPersistence';

const meta = (overrides: Partial<SessionMetaLike> = {}): SessionMetaLike => ({
  id: 's1',
  file: '/sessions/a.jsonl',
  timestamp: '2026-05-23T00:00:00.000Z',
  cwd: '/repo',
  cwdSlug: '',
  model: 'model',
  title: 'Title',
  messageCount: 3,
  ...overrides,
});

describe('sessionIndexPersistence', () => {
  it('builds sorted persistent index documents and serializes JSON', () => {
    const cache = new Map([
      ['/sessions/b.jsonl', { signature: '2:2', meta: meta({ id: 'b', file: '/sessions/b.jsonl' }) }],
      ['/sessions/a.jsonl', { signature: '1:1', meta: meta({ id: 'a', file: '/sessions/a.jsonl' }) }],
    ]);

    const document = buildPersistentSessionIndexDocument('/sessions', cache);
    expect(document.entries.map((entry) => entry.filePath)).toEqual(['/sessions/a.jsonl', '/sessions/b.jsonl']);
    expect(serializePersistentSessionIndex(document)).toBe(JSON.stringify(document));
  });

  it('loads and normalizes valid persistent entries', () => {
    expect(
      loadPersistentSessionIndexEntry({
        filePath: '/sessions/a.jsonl',
        signature: '1:1',
        meta: {
          ...meta({ file: 'ignored' }),
          workspaceCwd: ' /workspace ',
          parentSessionFile: ' /sessions/parent.jsonl ',
          parentSessionId: ' parent ',
          parentMessageId: ' message ',
          offshootKind: ' fork ',
          offshootTimestamp: ' time ',
          sourceRunId: ' run ',
        },
      }),
    ).toEqual({
      filePath: '/sessions/a.jsonl',
      signature: '1:1',
      meta: {
        ...meta({ file: '/sessions/a.jsonl' }),
        workspaceCwd: '/workspace',
        parentSessionFile: '/sessions/parent.jsonl',
        parentSessionId: 'parent',
        parentMessageId: 'message',
        offshootKind: 'fork',
        offshootTimestamp: 'time',
        sourceRunId: 'run',
      },
    });
  });

  it('rejects invalid entries', () => {
    expect(loadPersistentSessionIndexEntry(null)).toBeNull();
    expect(loadPersistentSessionIndexEntry({ filePath: '/sessions/a.jsonl', signature: '1:1', meta: { id: 'missing' } })).toBeNull();
  });
});
