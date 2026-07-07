import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildPersonaSoulDocContext, readPersonaSoulDoc } from './personaSoulDoc.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createFile(dir: string, name: string, content: string): void {
  writeFileSync(join(dir, name), content, 'utf-8');
}

function ensureAgentsDir(): string {
  const dir = createTempDir('persona-soul-');
  mkdirSync(dir, { recursive: true });
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('readPersonaSoulDoc', () => {
  it('returns empty string when agents directory does not exist', () => {
    const content = readPersonaSoulDoc('/nonexistent/path/to/agents/soul.md');
    expect(content).toBe('');
  });

  it('returns empty string when soul.md does not exist', () => {
    const dir = ensureAgentsDir();
    const content = readPersonaSoulDoc(join(dir, 'soul.md'));
    expect(content).toBe('');
  });

  it('returns the full content of soul.md', () => {
    const dir = ensureAgentsDir();
    const expected = '# My Persona\n\nI am a coding assistant.\n';
    createFile(dir, 'soul.md', expected);

    const content = readPersonaSoulDoc(join(dir, 'soul.md'));
    expect(content).toBe(expected);
  });

  it('reads soul.md even when other markdown files exist', () => {
    const dir = ensureAgentsDir();
    createFile(dir, 'soul.md', '# Soul Identity\n\nIdentity instructions.');
    createFile(dir, 'preferences.md', '# Preferences\n\nPrefers clean code.');
    createFile(dir, 'AGENTS.md', '# Agents\n\nAgent instructions.');

    const content = readPersonaSoulDoc(join(dir, 'soul.md'));
    expect(content).toBe('# Soul Identity\n\nIdentity instructions.');
  });

  it('handles empty soul.md file', () => {
    const dir = ensureAgentsDir();
    createFile(dir, 'soul.md', '');

    const content = readPersonaSoulDoc(join(dir, 'soul.md'));
    expect(content).toBe('');
  });
});

describe('buildPersonaSoulDocContext', () => {
  it('returns empty string when no soul doc exists', () => {
    const dir = ensureAgentsDir();
    const context = buildPersonaSoulDocContext(join(dir, 'soul.md'));
    expect(context).toBe('');
  });

  it('returns formatted context block with soul doc content', () => {
    const dir = ensureAgentsDir();
    createFile(dir, 'soul.md', '# My Persona\n\nYou are a coding assistant.');

    const context = buildPersonaSoulDocContext(join(dir, 'soul.md'));
    expect(context).toBe('Persona identity:\n# My Persona\n\nYou are a coding assistant.');
  });

  it('returns empty string when soul.md is empty', () => {
    const dir = ensureAgentsDir();
    createFile(dir, 'soul.md', '');

    const context = buildPersonaSoulDocContext(join(dir, 'soul.md'));
    expect(context).toBe('');
  });

  it('returns empty string when soul.md is whitespace only', () => {
    const dir = ensureAgentsDir();
    createFile(dir, 'soul.md', '   \n\n  ');

    const context = buildPersonaSoulDocContext(join(dir, 'soul.md'));
    expect(context).toBe('');
  });
});

describe('writePersonaSoulDoc', () => {
  it('writes content to a new soul.md file', async () => {
    const dir = ensureAgentsDir();
    const soulPath = join(dir, 'soul.md');
    const { writePersonaSoulDoc } = await import('./personaSoulDoc.js');

    writePersonaSoulDoc(soulPath, '# Custom Persona\n\nContent.');

    const content = readPersonaSoulDoc(soulPath);
    expect(content).toBe('# Custom Persona\n\nContent.');
  });

  it('overwrites existing content', async () => {
    const dir = ensureAgentsDir();
    const soulPath = join(dir, 'soul.md');
    createFile(dir, 'soul.md', '# Original\n\nOld content.');
    const { writePersonaSoulDoc } = await import('./personaSoulDoc.js');

    writePersonaSoulDoc(soulPath, '# Updated\n\nNew content.');

    const content = readPersonaSoulDoc(soulPath);
    expect(content).toBe('# Updated\n\nNew content.');
  });

  it('creates parent directories when they do not exist', async () => {
    const dir = createTempDir('persona-soul-nested-');
    const nestedDir = join(dir, 'deep', 'nested');
    const soulPath = join(nestedDir, 'soul.md');
    const { writePersonaSoulDoc } = await import('./personaSoulDoc.js');

    writePersonaSoulDoc(soulPath, '# Nested\n\nContent.');

    const content = readPersonaSoulDoc(soulPath);
    expect(content).toBe('# Nested\n\nContent.');
  });
});
