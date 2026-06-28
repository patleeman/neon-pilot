import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getKnowledgeRoot = vi.fn();
vi.mock('@neon-pilot/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@neon-pilot/core')>()),
  getKnowledgeRoot,
}));

const { createExtensionKnowledgeCapability } = await import('./extensionKnowledge.js');

describe('extensionKnowledge', () => {
  const knowledgeRoot = join(tmpdir(), `extension-knowledge-${randomUUID()}`);

  beforeEach(() => {
    getKnowledgeRoot.mockReturnValue(knowledgeRoot);
    rmSync(knowledgeRoot, { recursive: true, force: true });
    mkdirSync(knowledgeRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(knowledgeRoot, { recursive: true, force: true });
  });

  it('writes nested files and returns normalized knowledge entries', async () => {
    const knowledge = createExtensionKnowledgeCapability();

    const entry = await knowledge.write('/notes/today.md', 'hello world');

    expect(entry).toMatchObject({ id: 'notes/today.md', kind: 'file', name: 'today.md', sizeBytes: 11, updatedAt: expect.any(String) });
    await expect(knowledge.read('notes/today.md')).resolves.toMatchObject({
      id: 'notes/today.md',
      content: 'hello world',
      updatedAt: expect.any(String),
    });
  });

  it('routes memory-shaped writes through the Git-backed memory store', async () => {
    const knowledge = createExtensionKnowledgeCapability('system-knowledge');

    const entry = await knowledge.write('memory/system.md', '# System Memory\n\nWritten through extension.\n');

    expect(entry).toMatchObject({ id: 'memory/system.md', kind: 'file', name: 'system.md' });
    expect(readFileSync(join(knowledgeRoot, 'memory', 'system.md'), 'utf-8')).toContain('Written through extension.');
    expect(existsSync(join(knowledgeRoot, 'memory', '.git'))).toBe(true);
  });

  it('creates parent directories for valid memory-shaped extension writes', async () => {
    const knowledge = createExtensionKnowledgeCapability('system-knowledge');

    await knowledge.write(
      'memory/scopes/ext/memory.md',
      '---\nname: Extension scope\ntype: workspace\nroots: []\naliases: []\ninject: false\n---\n\n# Extension scope\n',
    );

    expect(readFileSync(join(knowledgeRoot, 'memory', 'scopes', 'ext', 'memory.md'), 'utf-8')).toContain('Extension scope');
    expect(existsSync(join(knowledgeRoot, 'memory', '.git'))).toBe(true);
  });

  it('rejects unsafe memory-shaped extension writes before mutating memory', async () => {
    const knowledge = createExtensionKnowledgeCapability('system-knowledge');
    await knowledge.write('memory/system.md', '# System Memory\n\nOriginal.\n');

    await expect(knowledge.write('memory/scopes/../system.md', '# System Memory\n\nMutated.\n')).rejects.toThrow('Invalid knowledge path');
    expect(readFileSync(join(knowledgeRoot, 'memory', 'system.md'), 'utf-8')).toContain('Original.');
    expect(readFileSync(join(knowledgeRoot, 'memory', 'system.md'), 'utf-8')).not.toContain('Mutated.');
  });

  it('lists visible files and folders, skipping dotfiles and symlinks', async () => {
    mkdirSync(join(knowledgeRoot, 'folder'), { recursive: true });
    writeFileSync(join(knowledgeRoot, 'b.md'), 'b', 'utf-8');
    writeFileSync(join(knowledgeRoot, '.hidden.md'), 'hidden', 'utf-8');
    symlinkSync(join(knowledgeRoot, 'b.md'), join(knowledgeRoot, 'linked.md'));

    await expect(createExtensionKnowledgeCapability().list()).resolves.toEqual([
      expect.objectContaining({ id: 'b.md', kind: 'file', name: 'b.md', sizeBytes: 1 }),
      expect.objectContaining({ id: 'folder/', kind: 'folder', name: 'folder', sizeBytes: 0 }),
    ]);
  });

  it('searches markdown files case-insensitively and ignores hidden, node_modules, and non-markdown files', async () => {
    mkdirSync(join(knowledgeRoot, 'docs'), { recursive: true });
    mkdirSync(join(knowledgeRoot, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(knowledgeRoot, 'docs', 'guide.md'), 'This has a Needle in a haystack.', 'utf-8');
    writeFileSync(join(knowledgeRoot, 'docs', 'skip.txt'), 'Needle but not markdown.', 'utf-8');
    writeFileSync(join(knowledgeRoot, 'node_modules', 'pkg', 'skip.md'), 'Needle ignored.', 'utf-8');
    writeFileSync(join(knowledgeRoot, '.hidden.md'), 'Needle hidden.', 'utf-8');

    await expect(createExtensionKnowledgeCapability().search(' needle ')).resolves.toEqual([
      { id: 'docs/guide.md', name: 'guide.md', excerpt: 'This has a Needle in a haystack.' },
    ]);
    await expect(createExtensionKnowledgeCapability().search('   ')).resolves.toEqual([]);
  });

  it('rejects unsafe paths and missing files or directories', async () => {
    const knowledge = createExtensionKnowledgeCapability();

    await expect(knowledge.read('../outside.md')).rejects.toThrow('Invalid knowledge path');
    await expect(knowledge.write('bad\0path.md', 'x')).rejects.toThrow('Invalid knowledge path');
    await expect(knowledge.write('x.md', 1 as never)).rejects.toThrow('content must be a string');
    await expect(knowledge.read('missing.md')).rejects.toThrow('Knowledge file not found');
    await expect(knowledge.list('missing')).rejects.toThrow('Knowledge directory not found');
  });
});
