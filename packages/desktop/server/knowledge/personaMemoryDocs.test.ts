import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { listPersonaMemoryDocs } from './personaMemoryDocs.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createFile(dir: string, name: string, content: string): void {
  writeFileSync(join(dir, name), content, 'utf-8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('listPersonaMemoryDocs', () => {
  it('returns empty array when agents directory does not exist', () => {
    const docs = listPersonaMemoryDocs('/nonexistent/path/to/agents');
    expect(docs).toEqual([]);
  });

  it('returns empty array when agents path is not a directory', () => {
    const dir = createTempDir('persona-memory-');
    createFile(dir, 'memory.md', '# Memory');

    const docs = listPersonaMemoryDocs(join(dir, 'memory.md'));

    expect(docs).toEqual([]);
  });

  it('returns markdown files excluding AGENTS.md and soul.md', () => {
    const dir = createTempDir('persona-memory-');
    createFile(dir, 'AGENTS.md', '# Soul\n\nSoul instructions.');
    createFile(dir, 'soul.md', '# Persona Soul\n\nIdentity.');
    createFile(dir, 'preferences.md', '# Preferences\n\nPrefers concise answers.');
    createFile(dir, 'bio.md', '# Biography\n\nWrites Python.');
    createFile(dir, 'notes.md', '# Notes\n\nSome random notes.');

    const docs = listPersonaMemoryDocs(dir);

    expect(docs).toHaveLength(3);
    const ids = docs.map((d) => d.id);
    expect(ids).not.toContain('AGENTS');
    expect(ids).not.toContain('soul');
    expect(ids).toEqual(['bio', 'notes', 'preferences']);
  });

  it('excludes hidden files', () => {
    const dir = createTempDir('persona-memory-');
    createFile(dir, '.hidden.md', '# Hidden');
    createFile(dir, 'visible.md', '# Visible');

    const docs = listPersonaMemoryDocs(dir);

    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('visible');
  });

  it('excludes symlinked markdown files', () => {
    const dir = createTempDir('persona-memory-');
    const outsideDir = createTempDir('persona-memory-outside-');
    createFile(dir, 'visible.md', '# Visible');
    createFile(outsideDir, 'secret.md', '# Secret');
    symlinkSync(join(outsideDir, 'secret.md'), join(dir, 'secret.md'));

    const docs = listPersonaMemoryDocs(dir);

    expect(docs.map((doc) => doc.id)).toEqual(['visible']);
  });

  it('excludes directories and non-markdown files', () => {
    const dir = createTempDir('persona-memory-');
    mkdirSync(join(dir, 'subdir'));
    createFile(dir, 'notes.md', '# Notes');
    createFile(dir, 'data.json', '{}');
    createFile(dir, 'README.txt', 'text');

    const docs = listPersonaMemoryDocs(dir);

    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('notes');
  });

  it('extracts title from first # heading', () => {
    const dir = createTempDir('persona-memory-');
    createFile(dir, 'preferences.md', '# Communication Style\n\nPrefers concise answers.\n\n## Subheading');
    createFile(dir, 'bio.md', 'No heading here');

    const docs = listPersonaMemoryDocs(dir);

    expect(docs).toHaveLength(2);

    const prefs = docs.find((d) => d.id === 'preferences');
    expect(prefs).toBeDefined();
    expect(prefs!.title).toBe('Communication Style');

    const bio = docs.find((d) => d.id === 'bio');
    expect(bio).toBeDefined();
    expect(bio!.title).toBe('bio');
  });

  it('returns full file content', () => {
    const dir = createTempDir('persona-memory-');
    const content = '# Skills\n\n- Python\n- TypeScript\n- API Design\n';
    createFile(dir, 'skills.md', content);

    const docs = listPersonaMemoryDocs(dir);

    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe(content);
  });

  it('returns updatedAt from file mtime', () => {
    const dir = createTempDir('persona-memory-');
    createFile(dir, 'notes.md', '# Notes');

    const docs = listPersonaMemoryDocs(dir);

    expect(docs).toHaveLength(1);
    expect(docs[0].updatedAt).toBeDefined();
    expect(typeof docs[0].updatedAt).toBe('string');
    expect(() => new Date(docs[0].updatedAt!)).not.toThrow();
  });

  it('returns in stable alphabetical order', () => {
    const dir = createTempDir('persona-memory-');
    createFile(dir, 'zebra.md', '# Zebra');
    createFile(dir, 'alpha.md', '# Alpha');
    createFile(dir, 'bravo.md', '# Bravo');
    createFile(dir, 'charlie.md', '# Charlie');

    const docs = listPersonaMemoryDocs(dir);

    expect(docs.map((d) => d.id)).toEqual(['alpha', 'bravo', 'charlie', 'zebra']);
  });

  it('returns empty array when only AGENTS.md or soul.md exist', () => {
    const dir = createTempDir('persona-memory-');
    createFile(dir, 'AGENTS.md', '# Soul');
    createFile(dir, 'soul.md', '# Persona Soul');

    const docs = listPersonaMemoryDocs(dir);

    expect(docs).toEqual([]);
  });

  it('returns correct path for each document', () => {
    const dir = createTempDir('persona-memory-');
    createFile(dir, 'style.md', '# Style');

    const docs = listPersonaMemoryDocs(dir);

    expect(docs).toHaveLength(1);
    expect(docs[0].path).toBe(join(dir, 'style.md'));
  });
});
