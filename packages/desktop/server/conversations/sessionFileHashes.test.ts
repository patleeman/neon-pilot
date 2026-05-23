import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeFileContentHash, computeFilePrefixHash, getFileSignature, parseSignatureSize } from './sessionFileHashes';

describe('sessionFileHashes', () => {
  it('reads file signatures and parses sizes', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-session-hashes-'));
    const filePath = join(root, 'session.jsonl');
    writeFileSync(filePath, 'hello');

    const signature = getFileSignature(filePath);
    expect(signature).toMatch(/^5:\d+(\.\d+)?$/);
    expect(parseSignatureSize(signature ?? '')).toBe(5);
    expect(parseSignatureSize('')).toBeNull();
    expect(parseSignatureSize('-1:123')).toBeNull();
    expect(getFileSignature(join(root, 'missing'))).toBeNull();
  });

  it('computes content and prefix hashes', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-session-hashes-'));
    const filePath = join(root, 'session.jsonl');
    writeFileSync(filePath, 'abcdef');

    expect(computeFileContentHash(filePath)).toBe('bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721');
    expect(computeFilePrefixHash(filePath, 3)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(computeFileContentHash(join(root, 'missing'))).toBeNull();
    expect(computeFilePrefixHash(join(root, 'missing'), 3)).toBeNull();
  });
});
