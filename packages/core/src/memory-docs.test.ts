import { mkdirSync, mkdtempSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { getMemoryDocsDir } from './memory-docs.js';

const tempDirs: string[] = [];

function createTempKnowledgeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'neon-pilot-memory-docs-'));
  const dir = join(root, 'sync');
  mkdirSync(dir, { recursive: true });
  tempDirs.push(root);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('note node paths', () => {
  it('stores shared note nodes under the sync notes root', () => {
    const knowledgeRoot = createTempKnowledgeRoot();
    expect(getMemoryDocsDir({ knowledgeRoot })).toBe(join(knowledgeRoot, 'notes'));
  });
});
