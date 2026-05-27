import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { getMemoryDocsDir, migrateLegacyProfileMemoryDirs } from './memory-docs.js';

const tempDirs: string[] = [];

function createTempKnowledgeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'neon-pilot-memory-docs-'));
  const dir = join(root, 'sync');
  mkdirSync(dir, { recursive: true });
  tempDirs.push(root);
  return dir;
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('note node paths', () => {
  it('stores shared note nodes under the sync notes root', () => {
    const knowledgeRoot = createTempKnowledgeRoot();
    expect(getMemoryDocsDir({ knowledgeRoot })).toBe(join(knowledgeRoot, 'notes'));
  });

  it('does not migrate legacy profile, shared, or runtime memory anymore', () => {
    const knowledgeRoot = createTempKnowledgeRoot();
    const legacyProfilesRoot = join(knowledgeRoot, '_profiles');
    const assistantMemory = join(legacyProfilesRoot, 'assistant', 'agent', 'memory', 'runpod.md');
    const legacyPackagePath = join(knowledgeRoot, 'memory', 'runpod', 'MEMORY.md');
    const runtimeNote = join(knowledgeRoot, '..', 'neon-pilot-runtime', 'notes', 'desktop.md');

    writeFile(assistantMemory, '---\nid: runpod\ntitle: Runpod\nsummary: Notes\n---\nRunpod\n');
    writeFile(legacyPackagePath, '---\nname: runpod\ndescription: Runpod notes.\n---\n# Runpod\n');
    writeFile(runtimeNote, '---\nid: desktop\ntitle: Desktop\nsummary: Server notes\n---\n# Desktop\n');

    const result = migrateLegacyProfileMemoryDirs({ knowledgeRoot });

    expect(result.memoryDir).toBe(join(knowledgeRoot, 'notes'));
    expect(result.migratedFiles).toEqual([]);
    expect(existsSync(assistantMemory)).toBe(true);
    expect(existsSync(legacyPackagePath)).toBe(true);
    expect(existsSync(runtimeNote)).toBe(true);
    expect(existsSync(join(knowledgeRoot, 'notes', 'runpod', 'INDEX.md'))).toBe(false);
    expect(existsSync(join(knowledgeRoot, 'notes', 'desktop.md'))).toBe(false);
  });
});
