import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readCurrentSessionLeafIdFromFile, readSessionIdFromSessionRecordFile } from './sessionIdentity';

const parseJsonLine = (rawLine: string) => {
  try {
    return JSON.parse(rawLine) as { type?: string; id?: string };
  } catch {
    return null;
  }
};

describe('sessionIdentity', () => {
  it('reads the latest non-session entry id as current leaf id', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-session-identity-'));
    const filePath = join(root, 'session.jsonl');
    writeFileSync(
      filePath,
      [
        JSON.stringify({ type: 'session', id: 'session-id' }),
        JSON.stringify({ type: 'message', id: 'm1' }),
        'not-json',
        JSON.stringify({ type: 'custom', id: 'c1' }),
      ].join('\n'),
    );

    expect(readCurrentSessionLeafIdFromFile(filePath, parseJsonLine)).toBe('c1');
    expect(readCurrentSessionLeafIdFromFile(join(root, 'missing'), parseJsonLine)).toBeNull();
  });

  it('reads the session id from the first session record', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-session-identity-'));
    const filePath = join(root, 'session.jsonl');
    writeFileSync(filePath, `${JSON.stringify({ type: 'session', id: ' s1 ' })}\n${JSON.stringify({ type: 'message', id: 'm1' })}`);

    expect(readSessionIdFromSessionRecordFile(filePath, parseJsonLine)).toBe('s1');
    writeFileSync(filePath, `${JSON.stringify({ type: 'message', id: 'm1' })}\n`);
    expect(readSessionIdFromSessionRecordFile(filePath, parseJsonLine)).toBeNull();
    expect(readSessionIdFromSessionRecordFile(join(root, 'missing'), parseJsonLine)).toBeNull();
  });
});
