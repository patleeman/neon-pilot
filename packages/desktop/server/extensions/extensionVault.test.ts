import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getVaultRoot = vi.fn();
vi.mock('@neon-pilot/core', () => ({ getVaultRoot }));

const { createExtensionVaultCapability } = await import('./extensionVault.js');

describe('extensionVault', () => {
  const vaultRoot = join(tmpdir(), `extension-vault-${randomUUID()}`);

  beforeEach(() => {
    getVaultRoot.mockReturnValue(vaultRoot);
    rmSync(vaultRoot, { recursive: true, force: true });
    mkdirSync(vaultRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(vaultRoot, { recursive: true, force: true });
  });

  it('writes nested files and returns normalized vault entries', async () => {
    const vault = createExtensionVaultCapability();

    const entry = await vault.write('/notes/today.md', 'hello world');

    expect(entry).toMatchObject({ id: 'notes/today.md', kind: 'file', name: 'today.md', sizeBytes: 11, updatedAt: expect.any(String) });
    await expect(vault.read('notes/today.md')).resolves.toMatchObject({
      id: 'notes/today.md',
      content: 'hello world',
      updatedAt: expect.any(String),
    });
  });

  it('lists visible files and folders, skipping dotfiles and symlinks', async () => {
    mkdirSync(join(vaultRoot, 'folder'), { recursive: true });
    writeFileSync(join(vaultRoot, 'b.md'), 'b', 'utf-8');
    writeFileSync(join(vaultRoot, '.hidden.md'), 'hidden', 'utf-8');
    symlinkSync(join(vaultRoot, 'b.md'), join(vaultRoot, 'linked.md'));

    await expect(createExtensionVaultCapability().list()).resolves.toEqual([
      expect.objectContaining({ id: 'b.md', kind: 'file', name: 'b.md', sizeBytes: 1 }),
      expect.objectContaining({ id: 'folder/', kind: 'folder', name: 'folder', sizeBytes: 0 }),
    ]);
  });

  it('searches markdown files case-insensitively and ignores hidden, node_modules, and non-markdown files', async () => {
    mkdirSync(join(vaultRoot, 'docs'), { recursive: true });
    mkdirSync(join(vaultRoot, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(vaultRoot, 'docs', 'guide.md'), 'This has a Needle in a haystack.', 'utf-8');
    writeFileSync(join(vaultRoot, 'docs', 'skip.txt'), 'Needle but not markdown.', 'utf-8');
    writeFileSync(join(vaultRoot, 'node_modules', 'pkg', 'skip.md'), 'Needle ignored.', 'utf-8');
    writeFileSync(join(vaultRoot, '.hidden.md'), 'Needle hidden.', 'utf-8');

    await expect(createExtensionVaultCapability().search(' needle ')).resolves.toEqual([
      { id: 'docs/guide.md', name: 'guide.md', excerpt: 'This has a Needle in a haystack.' },
    ]);
    await expect(createExtensionVaultCapability().search('   ')).resolves.toEqual([]);
  });

  it('rejects unsafe paths and missing files or directories', async () => {
    const vault = createExtensionVaultCapability();

    await expect(vault.read('../outside.md')).rejects.toThrow('Invalid vault path');
    await expect(vault.write('bad\0path.md', 'x')).rejects.toThrow('Invalid vault path');
    await expect(vault.write('x.md', 1 as never)).rejects.toThrow('content must be a string');
    await expect(vault.read('missing.md')).rejects.toThrow('Vault file not found');
    await expect(vault.list('missing')).rejects.toThrow('Vault directory not found');
  });
});
