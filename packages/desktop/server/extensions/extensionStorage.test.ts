import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@neon-pilot/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@neon-pilot/core')>();
  return { ...actual, getStateRoot: vi.fn() };
});

const core = await import('@neon-pilot/core');
const { closeExtensionStateDbs, deleteExtensionState, listExtensionState, readExtensionState, writeExtensionState } =
  await import('./extensionStorage.js');

describe('extensionStorage', () => {
  const stateRoot = join(tmpdir(), `extension-storage-${randomUUID()}`);

  beforeEach(() => {
    vi.mocked(core.getStateRoot).mockReturnValue(stateRoot);
    closeExtensionStateDbs();
    rmSync(stateRoot, { recursive: true, force: true });
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    closeExtensionStateDbs();
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('normalizes keys, writes versioned documents, and reads them back', () => {
    const written = writeExtensionState('ext', '/settings.json', { theme: 'dark' });

    expect(written).toEqual({ key: 'settings', value: { theme: 'dark' }, version: 1, createdAt: 1_000, updatedAt: 1_000 });
    expect(readExtensionState('ext', 'settings')).toEqual(written);
    expect(readExtensionState('other', 'settings')).toBeNull();
  });

  it('increments versions, preserves createdAt, and enforces expected versions', () => {
    writeExtensionState('ext', 'settings', { theme: 'dark' });
    vi.mocked(Date.now).mockReturnValue(2_000);

    expect(writeExtensionState('ext', 'settings', { theme: 'light' }, { expectedVersion: 1 })).toEqual({
      key: 'settings',
      value: { theme: 'light' },
      version: 2,
      createdAt: 1_000,
      updatedAt: 2_000,
    });

    expect(() => writeExtensionState('ext', 'settings', { theme: 'blue' }, { expectedVersion: 1 })).toThrow(
      'Extension state version conflict',
    );
    try {
      writeExtensionState('ext', 'settings', { theme: 'blue' }, { expectedVersion: 1 });
    } catch (error) {
      expect((error as Error & { current?: unknown }).current).toMatchObject({ version: 2, value: { theme: 'light' } });
    }
  });

  it('lists by prefix in key order and deletes documents', () => {
    writeExtensionState('ext', 'prefs/a', 1);
    writeExtensionState('ext', 'prefs/b', 2);
    writeExtensionState('ext', 'other', 3);

    expect(listExtensionState('ext', 'prefs')).toEqual([
      expect.objectContaining({ key: 'prefs/a', value: 1 }),
      expect.objectContaining({ key: 'prefs/b', value: 2 }),
    ]);
    expect(deleteExtensionState('ext', 'prefs/a')).toEqual({ ok: true, deleted: true });
    expect(deleteExtensionState('ext', 'prefs/a')).toEqual({ ok: true, deleted: false });
  });

  it('rejects invalid state keys and prefixes', () => {
    for (const key of ['', '  ', '../secret', 'nested/../secret', 'bad\0key']) {
      expect(() => readExtensionState('ext', key)).toThrow('Extension state key is invalid');
    }
    expect(() => listExtensionState('ext', '../secret')).toThrow('Extension state prefix is invalid');
    expect(() => listExtensionState('ext', 'bad\0prefix')).toThrow('Extension state prefix is invalid');
  });
});
