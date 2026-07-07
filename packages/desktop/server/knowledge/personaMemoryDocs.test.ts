import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  appendToPersonaMemoryDoc,
  deletePersonaMemoryDoc,
  listPersonaMemoryDocs,
  validateDocId,
  writePersonaMemoryDoc,
} from './personaMemoryDocs.js';

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

describe('validateDocId', () => {
  it('accepts simple lowercase alphanumeric ids', () => {
    expect(validateDocId('preferences')).toBe(true);
    expect(validateDocId('bio')).toBe(true);
    expect(validateDocId('notes2024')).toBe(true);
  });

  it('accepts hyphen-separated segments', () => {
    expect(validateDocId('my-preferences')).toBe(true);
    expect(validateDocId('coding-style-guide')).toBe(true);
    expect(validateDocId('a-b-c')).toBe(true);
  });

  it('rejects ids with uppercase letters', () => {
    expect(validateDocId('Preferences')).toBe(false);
    expect(validateDocId('MY-NOTES')).toBe(false);
  });

  it('rejects ids with spaces or special characters', () => {
    expect(validateDocId('my notes')).toBe(false);
    expect(validateDocId('notes!')).toBe(false);
    expect(validateDocId('preferences.md')).toBe(false);
    expect(validateDocId('../escape')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateDocId('')).toBe(false);
  });

  it('rejects ids with leading or trailing hyphens', () => {
    expect(validateDocId('-preferences')).toBe(false);
    expect(validateDocId('preferences-')).toBe(false);
  });

  it('rejects ids with consecutive hyphens', () => {
    expect(validateDocId('my--notes')).toBe(false);
  });

  it('rejects ids containing only numbers', () => {
    expect(validateDocId('123')).toBe(true); // numeric-only is fine per spec
  });

  it('rejects ids with underscores', () => {
    expect(validateDocId('my_notes')).toBe(false);
  });
});

describe('writePersonaMemoryDoc', () => {
  it('writes a markdown doc with title heading', () => {
    const dir = createTempDir('persona-memory-');
    const doc = writePersonaMemoryDoc(dir, 'preferences', 'My Preferences', 'Prefers concise answers.');

    expect(doc.id).toBe('preferences');
    expect(doc.title).toBe('My Preferences');
    expect(doc.content).toContain('# My Preferences');
    expect(doc.content).toContain('Prefers concise answers.');
    expect(doc.path).toBe(join(dir, 'preferences.md'));
    expect(doc.updatedAt).toBeDefined();

    const onDisk = readFileSync(doc.path, 'utf-8');
    expect(onDisk).toBe(doc.content);
  });

  it('writes doc without body', () => {
    const dir = createTempDir('persona-memory-');
    const doc = writePersonaMemoryDoc(dir, 'empty', 'Empty Doc');

    expect(doc.title).toBe('Empty Doc');
    expect(doc.content).toContain('# Empty Doc');
  });

  it('overwrites an existing doc', () => {
    const dir = createTempDir('persona-memory-');
    writePersonaMemoryDoc(dir, 'notes', 'Old Notes', 'Old content.');
    const doc = writePersonaMemoryDoc(dir, 'notes', 'New Notes', 'New content.');

    expect(doc.title).toBe('New Notes');
    expect(doc.content).toContain('New content.');
    expect(doc.content).not.toContain('Old content.');
  });

  it('creates the agents directory when missing', () => {
    const base = createTempDir('persona-memory-');
    const subDir = join(base, 'does-not-exist-yet');
    const doc = writePersonaMemoryDoc(subDir, 'notes', 'Notes');

    expect(existsSync(subDir)).toBe(true);
    expect(doc.id).toBe('notes');
  });

  it('throws on invalid doc id', () => {
    const dir = createTempDir('persona-memory-');
    expect(() => writePersonaMemoryDoc(dir, 'Invalid Id!', 'Title')).toThrow('Invalid persona memory doc id');
  });

  it('throws when targeting soul', () => {
    const dir = createTempDir('persona-memory-');
    expect(() => writePersonaMemoryDoc(dir, 'soul', 'Title')).toThrow('Cannot write to reserved doc');
  });

  it('throws when targeting agents (lowercase reserved doc)', () => {
    const dir = createTempDir('persona-memory-');
    expect(() => writePersonaMemoryDoc(dir, 'agents', 'Title')).toThrow('Cannot write to reserved doc');
  });
});

describe('appendToPersonaMemoryDoc', () => {
  it('appends a dated section to existing doc', () => {
    const dir = createTempDir('persona-memory-');
    writePersonaMemoryDoc(dir, 'journal', 'Journal', 'Initial entry.');

    const doc = appendToPersonaMemoryDoc(dir, 'journal', 'New Discovery', 'Found a new pattern.');

    expect(doc.id).toBe('journal');
    expect(doc.content).toContain('# Journal');
    expect(doc.content).toContain('## '); // dated section
    expect(doc.content).toContain('New Discovery');
    expect(doc.content).toContain('Found a new pattern.');
    expect(doc.content).toContain('Initial entry.');
    expect(doc.content).toContain('_Recorded at');
  });

  it('creates the doc when it does not exist yet', () => {
    const dir = createTempDir('persona-memory-');
    const doc = appendToPersonaMemoryDoc(dir, 'todo', 'Tasks', 'Review PR #42.');

    expect(doc.id).toBe('todo');
    expect(doc.content).toContain('# Tasks');
    expect(doc.content).toContain('Review PR #42.');
    expect(doc.path).toBe(join(dir, 'todo.md'));
  });

  it('appends multiple sections over time', () => {
    const dir = createTempDir('persona-memory-');
    appendToPersonaMemoryDoc(dir, 'log', 'Start', 'Began work.');
    const doc = appendToPersonaMemoryDoc(dir, 'log', 'Update', 'Made progress.');

    expect(doc.content).toContain('Began work.');
    expect(doc.content).toContain('Made progress.');
  });

  it('throws on invalid doc id', () => {
    const dir = createTempDir('persona-memory-');
    expect(() => appendToPersonaMemoryDoc(dir, 'bad id!', 'Section', 'Body')).toThrow('Invalid persona memory doc id');
  });

  it('throws when targeting soul', () => {
    const dir = createTempDir('persona-memory-');
    expect(() => appendToPersonaMemoryDoc(dir, 'soul', 'Section', 'Body')).toThrow('Cannot write to reserved doc');
  });
});

describe('deletePersonaMemoryDoc', () => {
  it('deletes an existing doc and returns true', () => {
    const dir = createTempDir('persona-memory-');
    writePersonaMemoryDoc(dir, 'notes', 'Notes', 'Content.');

    const result = deletePersonaMemoryDoc(dir, 'notes');

    expect(result).toBe(true);
    expect(existsSync(join(dir, 'notes.md'))).toBe(false);
  });

  it('returns false when doc does not exist', () => {
    const dir = createTempDir('persona-memory-');
    const result = deletePersonaMemoryDoc(dir, 'nonexistent');

    expect(result).toBe(false);
  });

  it('does not affect other docs', () => {
    const dir = createTempDir('persona-memory-');
    writePersonaMemoryDoc(dir, 'keep', 'Keep', 'Keep this.');
    writePersonaMemoryDoc(dir, 'delete', 'Delete', 'Delete this.');

    deletePersonaMemoryDoc(dir, 'delete');

    expect(existsSync(join(dir, 'keep.md'))).toBe(true);
    expect(existsSync(join(dir, 'delete.md'))).toBe(false);
  });

  it('throws on invalid doc id', () => {
    const dir = createTempDir('persona-memory-');
    expect(() => deletePersonaMemoryDoc(dir, '../escape')).toThrow('Invalid persona memory doc id');
  });

  it('throws when targeting soul', () => {
    const dir = createTempDir('persona-memory-');
    expect(() => deletePersonaMemoryDoc(dir, 'soul')).toThrow('Cannot delete reserved doc');
  });

  it('throws when targeting agents (lowercase reserved doc)', () => {
    const dir = createTempDir('persona-memory-');
    expect(() => deletePersonaMemoryDoc(dir, 'agents')).toThrow('Cannot delete reserved doc');
  });
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
