import { randomUUID } from 'node:crypto';
import { chmodSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@neon-pilot/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@neon-pilot/core')>();
  return { ...actual, getStateRoot: vi.fn() };
});

const core = await import('@neon-pilot/core');
const {
  closeExtensionDatabaseManagersForTests,
  createExtensionDatabaseManager,
  getExtensionDatabasePathFromLayout,
  getExtensionDataRootFromLayout,
} = await import('./extensionDatabase.js');

describe('extensionDatabase', () => {
  const stateRoot = join(tmpdir(), `extension-database-${randomUUID()}`);

  beforeEach(() => {
    vi.mocked(core.getStateRoot).mockReturnValue(stateRoot);
    closeExtensionDatabaseManagersForTests();
    rmSync(stateRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    closeExtensionDatabaseManagersForTests();
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('opens extension-scoped sqlite databases and applies migrations', async () => {
    const manager = createExtensionDatabaseManager('ext');
    const db = await manager.open('main', {
      migrations: [
        {
          version: 1,
          description: 'create todos',
          up: (database) => {
            database.exec('CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)');
          },
        },
      ],
    });

    db.prepare('INSERT INTO todos (id, title) VALUES (?, ?)').run('one', 'Write tests');

    await manager.close('main');
    const reopened = await manager.open('main');
    expect(reopened.prepare('SELECT title FROM todos WHERE id = ?').get('one')).toEqual({ title: 'Write tests' });
  });

  it('creates and repairs private sqlite database file permissions', async () => {
    const manager = createExtensionDatabaseManager('ext');
    const db = await manager.open('main');
    db.exec('CREATE TABLE IF NOT EXISTS marker (value TEXT)');
    await manager.close('main');

    const dbDir = join(stateRoot, 'extension-data', 'ext', 'databases');
    const dbPath = join(dbDir, 'main.sqlite');
    chmodSync(dbDir, 0o755);
    chmodSync(dbPath, 0o644);

    await manager.open('main');
    await manager.close('main');

    expect(statSync(dbDir).mode & 0o777).toBe(0o700);
    expect(statSync(dbPath).mode & 0o777).toBe(0o600);
  });

  it('resolves extension database paths from DesktopRootLayout', () => {
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
    const dbPath = getExtensionDatabasePathFromLayout('my-ext', 'main', layout);
    expect(dbPath).toBe('/root/data/apps/my-ext/databases/main.sqlite');

    expect(getExtensionDataRootFromLayout(layout)).toBe('/root/data/apps');
  });

  it('uses DesktopRootLayout-based paths when layout option is provided', async () => {
    const dbRoot = join(tmpdir(), `extension-database-layout-${randomUUID()}`);
    closeExtensionDatabaseManagersForTests();
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

    const expectedDbPath = join(layout.dataApps, 'layout-ext', 'databases', 'main.sqlite');
    const manager = createExtensionDatabaseManager('layout-ext', { layout });
    const db = await manager.open('main');
    db.exec('CREATE TABLE IF NOT EXISTS layout_marker (value TEXT)');
    db.prepare('INSERT INTO layout_marker (value) VALUES (?)').run('layout-works');
    await manager.close('main');

    expect(await import('node:fs').then((fs) => fs.existsSync(expectedDbPath))).toBe(true);

    const reopened = await manager.open('main');
    expect(reopened.prepare('SELECT value FROM layout_marker WHERE value = ?').get('layout-works')).toEqual({
      value: 'layout-works',
    });

    closeExtensionDatabaseManagersForTests();
    rmSync(dbRoot, { recursive: true, force: true });
  });

  it('preserves backwards-compatible stateRoot-based paths when layout is not provided', async () => {
    closeExtensionDatabaseManagersForTests();
    const dbRoot = join(tmpdir(), `extension-database-state-${randomUUID()}`);
    vi.mocked(core.getStateRoot).mockReturnValue(dbRoot);
    rmSync(dbRoot, { recursive: true, force: true });

    const expectedDbPath = join(dbRoot, 'extension-data', 'state-ext', 'databases', 'main.sqlite');
    const manager = createExtensionDatabaseManager('state-ext');
    const db = await manager.open('main');
    db.exec('CREATE TABLE IF NOT EXISTS state_marker (value TEXT)');
    db.prepare('INSERT INTO state_marker (value) VALUES (?)').run('state-works');
    await manager.close('main');

    expect(await import('node:fs').then((fs) => fs.existsSync(expectedDbPath))).toBe(true);

    closeExtensionDatabaseManagersForTests();
    rmSync(dbRoot, { recursive: true, force: true });
    vi.mocked(core.getStateRoot).mockReturnValue(stateRoot);
  });

  it('isolates databases by extension id and rejects unsafe names', async () => {
    const first = await createExtensionDatabaseManager('first').open();
    first.exec('CREATE TABLE marker (value TEXT)');
    first.prepare('INSERT INTO marker (value) VALUES (?)').run('first');

    const second = await createExtensionDatabaseManager('second').open();
    expect(second.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'marker'").get()).toBeUndefined();

    await expect(createExtensionDatabaseManager('first').open('../escape')).rejects.toThrow('Extension database name is invalid');
    await expect(createExtensionDatabaseManager('first').open('bad/name')).rejects.toThrow('Extension database name is invalid');
  });
});
