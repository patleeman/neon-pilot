import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readFileLinesReverse } from './reverseFileLines';

let tempDir: string | null = null;

function writeTempFile(content: string): string {
  tempDir = mkdtempSync(join(tmpdir(), 'reverse-file-lines-'));
  const filePath = join(tempDir, 'session.jsonl');
  writeFileSync(filePath, content);
  return filePath;
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('readFileLinesReverse', () => {
  it('visits lines from bottom to top and strips carriage returns', () => {
    const filePath = writeTempFile('one\r\ntwo\nthree');
    const lines: string[] = [];

    readFileLinesReverse(
      filePath,
      (line) => {
        lines.push(line);
      },
      4,
    );

    expect(lines).toEqual(['three', 'two', 'one']);
  });

  it('stops early when the visitor returns false', () => {
    const filePath = writeTempFile('one\ntwo\nthree');
    const lines: string[] = [];

    readFileLinesReverse(
      filePath,
      (line) => {
        lines.push(line);
        return false;
      },
      4,
    );

    expect(lines).toEqual(['three']);
  });
});
