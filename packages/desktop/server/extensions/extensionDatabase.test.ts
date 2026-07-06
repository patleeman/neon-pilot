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
