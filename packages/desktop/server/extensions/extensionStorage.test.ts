import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@neon-pilot/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@neon-pilot/core')>();
  return { ...actual, getStateRoot: vi.fn() };
});

const core = await import('@neon-pilot/core');
const {
  closeExtensionStateDbs,
  deleteExtensionState,
  getExtensionStateDbPathFromLayout,
  listExtensionState,
  readExtensionState,
  writeExtensionState,
} = await import('./extensionStorage.js');

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

  it('creates and repairs private sqlite storage file permissions', () => {
    const dbDir = join(stateRoot, 'app-state');
    const dbPath = join(dbDir, 'app-state.sqlite');

    writeExtensionState('ext', 'seed', { ok: true });
    closeExtensionStateDbs();

    chmodSync(dbDir, 0o755);
    chmodSync(dbPath, 0o644);

    writeExtensionState('ext', 'settings', { theme: 'dark' });
    closeExtensionStateDbs();

    expect(statSync(dbDir).mode & 0o777).toBe(0o700);
    expect(statSync(dbPath).mode & 0o777).toBe(0o600);
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

  it('resolves extension state DB path from DesktopRootLayout', () => {
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
    expect(getExtensionStateDbPathFromLayout(layout)).toBe('/root/system/state/app-state.sqlite');
  });

  it('uses DesktopRootLayout-based paths when layout is provided', () => {
    const dbRoot = join(tmpdir(), `extension-storage-layout-${randomUUID()}`);
    closeExtensionStateDbs();
    rmSync(dbRoot, { recursive: true, force: true });

    const layout = {
      root: dbRoot,
      apps: join(dbRoot, 'apps'),
      data: join(dbRoot, 'data'),
      dataApps: join(dbRoot, 'data', 'apps'),
      dataDocuments: join(dbRoot, 'data', 'documents'),
      documents: join(dbRoot, 'documents'),
      agents: join(dbRoot, 'agents'),
      logs: join(dbRoot, 'logs'),
      logsDesktop: join(dbRoot, 'logs', 'desktop'),
      logsDaemon: join(dbRoot, 'logs', 'daemon'),
      logsTelemetry: join(dbRoot, 'logs', 'telemetry'),
      system: join(dbRoot, 'system'),
      systemAgents: join(dbRoot, 'system', 'agents'),
      systemApps: join(dbRoot, 'system', 'apps'),
      systemCache: join(dbRoot, 'system', 'cache'),
      systemConfig: join(dbRoot, 'system', 'config'),
      systemConversations: join(dbRoot, 'system', 'conversations'),
      systemSessions: join(dbRoot, 'system', 'conversations', 'sessions'),
      systemDaemon: join(dbRoot, 'system', 'daemon'),
      systemElectron: join(dbRoot, 'system', 'electron'),
      systemElectronUserData: join(dbRoot, 'system', 'electron', 'user-data'),
      systemObservability: join(dbRoot, 'system', 'observability'),
      systemRuntime: join(dbRoot, 'system', 'runtime'),
      systemSecrets: join(dbRoot, 'system', 'secrets'),
      systemState: join(dbRoot, 'system', 'state'),
    };

    writeExtensionState('layout-ext', 'key', 'layout-value', {}, layout);
    expect(readExtensionState('layout-ext', 'key', layout)).toEqual(
      expect.objectContaining({ key: 'key', value: 'layout-value', version: 1 }),
    );

    expect(listExtensionState('layout-ext', '', layout)).toHaveLength(1);
    expect(deleteExtensionState('layout-ext', 'key', layout)).toEqual({ ok: true, deleted: true });
    expect(readExtensionState('layout-ext', 'key', layout)).toBeNull();

    // Verify the DB was created at the layout path
    const expectedDbPath = join(layout.systemState, 'app-state.sqlite');
    expect(existsSync(expectedDbPath)).toBe(true);

    closeExtensionStateDbs();
    rmSync(dbRoot, { recursive: true, force: true });
  });

  it('preserves backwards-compatible stateRoot-based paths when layout is not provided', () => {
    writeExtensionState('state-ext', 'state-key', 'state-value');
    expect(readExtensionState('state-ext', 'state-key')).toEqual(
      expect.objectContaining({ key: 'state-key', value: 'state-value', version: 1 }),
    );

    // Clean up the test data we added
    closeExtensionStateDbs();
  });

  it('rejects invalid state keys and prefixes', () => {
    for (const key of ['', '  ', '../secret', 'nested/../secret', 'bad\0key']) {
      expect(() => readExtensionState('ext', key)).toThrow('Extension state key is invalid');
    }
    expect(() => listExtensionState('ext', '../secret')).toThrow('Extension state prefix is invalid');
    expect(() => listExtensionState('ext', 'bad\0prefix')).toThrow('Extension state prefix is invalid');
  });
});
