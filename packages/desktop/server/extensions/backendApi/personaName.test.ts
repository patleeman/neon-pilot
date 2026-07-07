import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

const DEFAULT_SOUL_DOC = `# Neon Pilot Persona

You are Neon Pilot, an AI assistant.

## Identity

You help users with coding, writing, and everyday tasks.
`;

describe('personaName backend API shim', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'persona-name-test-'));
  });

  it('reads the persona name from a soul doc', async () => {
    const soulDocPath = join(tmpDir, 'soul.md');
    writeFileSync(soulDocPath, DEFAULT_SOUL_DOC, 'utf-8');

    const { readPersonaName } = await import('./personaName.js');
    const name = await readPersonaName(soulDocPath);

    expect(name).toBe('Neon Pilot Persona');
  });

  it('reads the default persona name when the soul doc has no H1', async () => {
    const soulDocPath = join(tmpDir, 'soul.md');
    writeFileSync(soulDocPath, 'Some content without an H1 heading.\n', 'utf-8');

    const { readPersonaName } = await import('./personaName.js');
    const name = await readPersonaName(soulDocPath);

    expect(name).toBe('Neon Pilot Persona');
  });

  it('reads the default persona name when the soul doc is empty', async () => {
    const soulDocPath = join(tmpDir, 'empty.md');
    writeFileSync(soulDocPath, '', 'utf-8');

    const { readPersonaName } = await import('./personaName.js');
    const name = await readPersonaName(soulDocPath);

    expect(name).toBe('Neon Pilot Persona');
  });

  it('writes a custom persona name and reads it back', async () => {
    const soulDocPath = join(tmpDir, 'soul.md');
    writeFileSync(soulDocPath, DEFAULT_SOUL_DOC, 'utf-8');

    const { writePersonaName, readPersonaName } = await import('./personaName.js');
    await writePersonaName(soulDocPath, 'My Custom Assistant');
    const name = await readPersonaName(soulDocPath);

    expect(name).toBe('My Custom Assistant');
    const content = readFileSync(soulDocPath, 'utf-8');
    expect(content).toContain('# My Custom Assistant');
    expect(content).toContain('You are Neon Pilot');
  });

  it('replaces the first H1 only, preserving other headings', async () => {
    const soulDocPath = join(tmpDir, 'soul.md');
    writeFileSync(soulDocPath, DEFAULT_SOUL_DOC, 'utf-8');

    const { writePersonaName } = await import('./personaName.js');
    await writePersonaName(soulDocPath, 'Assistant Alpha');

    const content = readFileSync(soulDocPath, 'utf-8');
    // First H1 replaced
    expect(content).toMatch(/^# Assistant Alpha\n/);
    // ## Identity (H2) preserved
    expect(content).toContain('## Identity');
  });

  it('throws when writing an empty name', async () => {
    const soulDocPath = join(tmpDir, 'soul.md');
    writeFileSync(soulDocPath, DEFAULT_SOUL_DOC, 'utf-8');

    const { writePersonaName } = await import('./personaName.js');
    await expect(writePersonaName(soulDocPath, '  ')).rejects.toThrow('Persona name must not be empty');
  });

  it('returns default name when soul doc does not exist', async () => {
    const soulDocPath = join(tmpDir, 'nonexistent.md');

    const { readPersonaName } = await import('./personaName.js');
    const name = await readPersonaName(soulDocPath);

    expect(name).toBe('Neon Pilot Persona');
  });
});
