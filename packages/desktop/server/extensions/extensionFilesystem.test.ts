import { rmSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestRoot = vi.fn();
const createTempRoot = vi.fn();
const getStateRoot = vi.fn(() => '/tmp/neon-pilot-extension-filesystem-test-state');

vi.mock('../filesystem/filesystemAuthority.js', () => ({
  defaultFileSystemAuthority: { requestRoot, createTempRoot },
}));

vi.mock('@neon-pilot/core', () => ({ getStateRoot }));
vi.mock('./extensionPermissions.js', () => ({
  assertExtensionAnyPermission: vi.fn(),
}));

const { createExtensionFilesystemCapability, extensionFileRootPathFromLayout } = await import('./extensionFilesystem.js');

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

  it('resolves extension file root paths from DesktopRootLayout', () => {
    const layout = {
      root: '/root',
      apps: '/root/apps',
      data: '/root/data',
      dataApps: '/root/data/apps',
      dataDocuments: '/root/data/documents',
      documents: '/root/documents',
      agents: '/root/agents',
      logs: '/root/logs',
      logsDesktop: '/root/logs/desktop',
      logsDaemon: '/root/logs/daemon',
      logsTelemetry: '/root/logs/telemetry',
      system: '/root/system',
      systemAgents: '/root/system/agents',
      systemApps: '/root/system/apps',
      systemCache: '/root/system/cache',
      systemConfig: '/root/system/config',
      systemConversations: '/root/system/conversations',
      systemSessions: '/root/system/conversations/sessions',
      systemDaemon: '/root/system/daemon',
      systemElectron: '/root/system/electron',
      systemElectronUserData: '/root/system/electron/user-data',
      systemObservability: '/root/system/observability',
      systemRuntime: '/root/system/runtime',
      systemSecrets: '/root/system/secrets',
      systemState: '/root/system/state',
    };
    expect(extensionFileRootPathFromLayout('my-ext', 'app', layout)).toBe('/root/data/apps/my-ext/files');
    expect(extensionFileRootPathFromLayout('my-ext', 'cache', layout)).toBe('/root/data/apps/my-ext/cache');
  });

  it('uses DesktopRootLayout-based paths when layout option is provided', async () => {
    const { mkdtempSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const layoutRoot = mkdtempSync(join(tmpdir(), 'np-ext-fs-layout-'));
    const layout = {
      root: layoutRoot,
      apps: join(layoutRoot, 'apps'),
      data: join(layoutRoot, 'data'),
      dataApps: join(layoutRoot, 'data', 'apps'),
      dataDocuments: join(layoutRoot, 'data', 'documents'),
      documents: join(layoutRoot, 'documents'),
      agents: join(layoutRoot, 'agents'),
      logs: join(layoutRoot, 'logs'),
      logsDesktop: join(layoutRoot, 'logs', 'desktop'),
      logsDaemon: join(layoutRoot, 'logs', 'daemon'),
      logsTelemetry: join(layoutRoot, 'logs', 'telemetry'),
      system: join(layoutRoot, 'system'),
      systemAgents: join(layoutRoot, 'system', 'agents'),
      systemApps: join(layoutRoot, 'system', 'apps'),
      systemCache: join(layoutRoot, 'system', 'cache'),
      systemConfig: join(layoutRoot, 'system', 'config'),
      systemConversations: join(layoutRoot, 'system', 'conversations'),
      systemSessions: join(layoutRoot, 'system', 'conversations', 'sessions'),
      systemDaemon: join(layoutRoot, 'system', 'daemon'),
      systemElectron: join(layoutRoot, 'system', 'electron'),
      systemElectronUserData: join(layoutRoot, 'system', 'electron', 'user-data'),
      systemObservability: join(layoutRoot, 'system', 'observability'),
      systemRuntime: join(layoutRoot, 'system', 'runtime'),
      systemSecrets: join(layoutRoot, 'system', 'secrets'),
      systemState: join(layoutRoot, 'system', 'state'),
    };
    mkdirSync(layout.dataApps, { recursive: true });
    const fs = createExtensionFilesystemCapability('ext', undefined, { layout });
    requestRoot.mockResolvedValueOnce({ root: 'app' }).mockResolvedValueOnce({ root: 'cache' });

    await expect(fs.app()).resolves.toEqual({ root: 'app' });
    expect(requestRoot).toHaveBeenCalledWith({
      subject: { type: 'extension', extensionId: 'ext' },
      root: {
        kind: 'extension-storage',
        id: 'ext:app',
        path: join(layout.dataApps, 'ext', 'files'),
        displayName: 'ext app files',
        labels: { bucket: 'app' },
      },
      access: ['read', 'write', 'delete', 'list', 'metadata'],
      reason: 'extension app files',
    });

    await expect(fs.cache()).resolves.toEqual({ root: 'cache' });
    expect(requestRoot).toHaveBeenLastCalledWith({
      subject: { type: 'extension', extensionId: 'ext' },
      root: {
        kind: 'extension-storage',
        id: 'ext:cache',
        path: join(layout.dataApps, 'ext', 'cache'),
        displayName: 'ext cache',
        labels: { bucket: 'cache' },
      },
      access: ['read', 'write', 'delete', 'list', 'metadata'],
      reason: 'extension cache files',
    });

    rmSync(layoutRoot, { recursive: true, force: true });
  });

  it('preserves backwards-compatible default paths when layout is not provided', async () => {
    const fs = createExtensionFilesystemCapability('ext');
    requestRoot.mockResolvedValueOnce({ root: 'app' });

    await fs.app();
    expect(requestRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        root: expect.objectContaining({
          path: '/tmp/neon-pilot-extension-filesystem-test-state/extension-data/ext/files',
        }),
      }),
    );
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
