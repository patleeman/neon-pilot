import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestRoot = vi.fn();
const createTempRoot = vi.fn();
const getStateRoot = vi.fn(() => '/tmp/neon-pilot-extension-filesystem-test-state');

vi.mock('../filesystem/filesystemAuthority.js', () => ({
  defaultFileSystemAuthority: { requestRoot, createTempRoot },
}));

vi.mock('@neon-pilot/core', () => ({ getStateRoot }));

const { createExtensionFilesystemCapability } = await import('./extensionFilesystem.js');

describe('extensionFilesystem', () => {
  beforeEach(() => {
    requestRoot.mockReset().mockResolvedValue({ root: 'workspace' });
    createTempRoot.mockReset().mockResolvedValue({ root: 'temp' });
  });

  it('requests explicit workspace roots with requested access and reason', async () => {
    const fs = createExtensionFilesystemCapability('ext');

    await expect(fs.requestRoot({ kind: 'workspace', cwd: '/repo/../repo', access: ['read'], reason: 'inspect' })).resolves.toEqual({
      root: 'workspace',
    });
    expect(requestRoot).toHaveBeenCalledWith({
      subject: { type: 'extension', extensionId: 'ext' },
      root: { kind: 'workspace', id: expect.stringMatching(/\/repo$/), path: '/repo/../repo', displayName: '/repo/../repo' },
      access: ['read'],
      reason: 'inspect',
    });
  });

  it('uses tool context cwd and default workspace access for workspace helper', async () => {
    const fs = createExtensionFilesystemCapability('ext', { cwd: '/workspace' });

    await expect(fs.workspace()).resolves.toEqual({ root: 'workspace' });
    expect(requestRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        root: { kind: 'workspace', id: '/workspace', path: '/workspace', displayName: '/workspace' },
        access: ['read', 'list', 'metadata'],
        reason: 'extension workspace access',
      }),
    );
  });

  it('rejects unsupported root kinds and missing cwd', async () => {
    const fs = createExtensionFilesystemCapability('ext');

    await expect(fs.requestRoot({ kind: 'other' as never, cwd: '/workspace' })).rejects.toThrow(
      'Unsupported extension filesystem root kind: other',
    );
    await expect(fs.workspace()).rejects.toThrow('Workspace cwd required');
  });

  it('creates extension app and cache roots under extension data', async () => {
    const fs = createExtensionFilesystemCapability('ext');
    requestRoot.mockResolvedValueOnce({ root: 'app' }).mockResolvedValueOnce({ root: 'cache' });

    await expect(fs.app({ access: ['read'], reason: 'read app file' })).resolves.toEqual({ root: 'app' });
    expect(requestRoot).toHaveBeenCalledWith({
      subject: { type: 'extension', extensionId: 'ext' },
      root: {
        kind: 'extension-storage',
        id: 'ext:app',
        path: '/tmp/neon-pilot-extension-filesystem-test-state/extension-data/ext/files',
        displayName: 'ext app files',
        labels: { bucket: 'app' },
      },
      access: ['read'],
      reason: 'read app file',
    });

    await expect(fs.requestRoot({ kind: 'cache' })).resolves.toEqual({ root: 'cache' });
    expect(requestRoot).toHaveBeenLastCalledWith({
      subject: { type: 'extension', extensionId: 'ext' },
      root: {
        kind: 'extension-storage',
        id: 'ext:cache',
        path: '/tmp/neon-pilot-extension-filesystem-test-state/extension-data/ext/cache',
        displayName: 'ext cache',
        labels: { bucket: 'cache' },
      },
      access: ['read', 'write', 'delete', 'list', 'metadata'],
      reason: 'extension cache file access',
    });
  });

  it('creates temp roots with defaults and caller overrides', async () => {
    const fs = createExtensionFilesystemCapability('ext');

    await expect(fs.temp({ access: ['write'], reason: 'scratch', prefix: 'x-' })).resolves.toEqual({ root: 'temp' });
    expect(createTempRoot).toHaveBeenCalledWith({
      subject: { type: 'extension', extensionId: 'ext' },
      access: ['write'],
      reason: 'scratch',
      prefix: 'x-',
    });

    await fs.temp();
    expect(createTempRoot).toHaveBeenLastCalledWith({
      subject: { type: 'extension', extensionId: 'ext' },
      access: ['read', 'write', 'delete', 'list', 'metadata'],
      reason: 'extension temp workspace',
      prefix: undefined,
    });
  });
});
