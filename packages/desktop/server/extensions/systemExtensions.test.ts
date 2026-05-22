import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const listExtensionPackagePaths = vi.fn();

vi.mock('./extensionPackagePaths.js', () => ({ listExtensionPackagePaths }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: vi.fn() };
});

describe('systemExtensions', () => {
  beforeEach(() => {
    vi.resetModules();
    listExtensionPackagePaths.mockReset();
    vi.mocked(readFileSync).mockReset();
  });

  it('reads bundled extension manifests and marks them as system packages', async () => {
    listExtensionPackagePaths.mockReturnValue([
      { source: 'bundled', packageRoot: '/extensions/system-a' },
      { source: 'experimental', packageRoot: '/experimental/system-b' },
    ]);
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes('system-a')) return JSON.stringify({ schemaVersion: 2, id: 'system-a', name: 'System A' });
      if (String(path).includes('system-b')) return JSON.stringify({ schemaVersion: 2, id: 'system-b', name: 'System B' });
      throw new Error('missing');
    });

    const module = await import('./systemExtensions.js');

    expect(module.readBundledExtensionEntries()).toEqual([
      { packageRoot: '/extensions/system-a', manifest: { schemaVersion: 2, id: 'system-a', name: 'System A', packageType: 'system' } },
    ]);
    expect(module.readExperimentalExtensionEntries()).toEqual([
      { packageRoot: '/experimental/system-b', manifest: { schemaVersion: 2, id: 'system-b', name: 'System B', packageType: 'system' } },
    ]);
  });

  it('skips invalid, unreadable, or incomplete extension manifests', async () => {
    listExtensionPackagePaths.mockReturnValue([
      { source: 'bundled', packageRoot: '/extensions/missing-name' },
      { source: 'bundled', packageRoot: '/extensions/bad-json' },
      { source: 'bundled', packageRoot: '/extensions/good' },
    ]);
    vi.mocked(readFileSync).mockImplementation((path) => {
      const value = String(path);
      if (value.includes('missing-name')) return JSON.stringify({ id: 'missing-name' });
      if (value.includes('bad-json')) return '{bad';
      return JSON.stringify({ id: 'good', name: 'Good' });
    });

    const module = await import('./systemExtensions.js');

    expect(module.readBundledExtensionEntries()).toEqual([
      { packageRoot: '/extensions/good', manifest: { id: 'good', name: 'Good', packageType: 'system' } },
    ]);
    expect(module.SYSTEM_EXTENSIONS).toEqual([{ id: 'good', name: 'Good', packageType: 'system' }]);
  });
});
