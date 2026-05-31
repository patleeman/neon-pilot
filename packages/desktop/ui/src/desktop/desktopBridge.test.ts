import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('shouldUseNativeAppContextMenus', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('keeps app-owned context menus in-app across desktop and web', async () => {
    const { shouldUseNativeAppContextMenus } = await import('./desktopBridge');

    expect(shouldUseNativeAppContextMenus()).toBe(false);
  });
});

describe('readDesktopEnvironment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('reuses the same bridge request across repeated reads', async () => {
    const getEnvironment = vi.fn().mockResolvedValue({ activeHostKind: 'local', activeHostLabel: 'Local' });
    vi.stubGlobal('window', {
      neonPilotDesktop: {
        getEnvironment,
      },
    } as unknown as Window & typeof globalThis);

    const { readDesktopEnvironment } = await import('./desktopBridge');

    await expect(readDesktopEnvironment()).resolves.toEqual({ activeHostKind: 'local', activeHostLabel: 'Local' });
    await expect(readDesktopEnvironment()).resolves.toEqual({ activeHostKind: 'local', activeHostLabel: 'Local' });
    expect(getEnvironment).toHaveBeenCalledTimes(1);
  });

  it('clears the cached request after a bridge failure', async () => {
    const getEnvironment = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ activeHostKind: 'local', activeHostLabel: 'Local' });
    vi.stubGlobal('window', {
      neonPilotDesktop: {
        getEnvironment,
      },
    } as unknown as Window & typeof globalThis);

    const { readDesktopEnvironment } = await import('./desktopBridge');

    await expect(readDesktopEnvironment()).rejects.toThrow('boom');
    await expect(readDesktopEnvironment()).resolves.toEqual({ activeHostKind: 'local', activeHostLabel: 'Local' });
    expect(getEnvironment).toHaveBeenCalledTimes(2);
  });
});

describe('Tauri desktop bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('creates a desktop bridge backed by Tauri invoke', async () => {
    const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>) => {
      if (command === 'get_environment') {
        return { isTauri: true, activeHostKind: 'local', activeHostLabel: 'Local' };
      }
      if (command === 'open_path') {
        return { path: payload?.targetPath, opened: true };
      }
      if (command === 'scoped_read_text') {
        return 'hello';
      }
      if (command === 'apply_sqlite_migrations_command') {
        return 2;
      }
      throw new Error(`unexpected command ${command}`);
    });
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: { invoke },
      history: { length: 1, back: vi.fn(), forward: vi.fn() },
      location: { assign: vi.fn() },
    } as unknown as Window & typeof globalThis);

    const { getDesktopBridge, readDesktopEnvironment } = await import('./desktopBridge');
    const bridge = getDesktopBridge();

    await expect(readDesktopEnvironment()).resolves.toMatchObject({ isTauri: true, activeHostKind: 'local' });
    await expect(bridge?.openPath('/tmp')).resolves.toEqual({ path: '/tmp', opened: true });
    expect(invoke).toHaveBeenCalledWith('open_path', { targetPath: '/tmp' });
    await expect(bridge?.hostCore?.readScopedText({ root: '/tmp/state', path: 'notes.txt' })).resolves.toBe('hello');
    expect(invoke).toHaveBeenCalledWith('scoped_read_text', { input: { root: '/tmp/state', path: 'notes.txt' } });
    await expect(
      bridge?.hostCore?.applySqliteMigrations({
        root: '/tmp/state',
        path: 'extension-data/sample/databases/main.db',
        migrations: [{ version: 2, description: 'schema', sql: 'CREATE TABLE items (id TEXT PRIMARY KEY);' }],
      }),
    ).resolves.toBe(2);
    expect(invoke).toHaveBeenCalledWith('apply_sqlite_migrations_command', {
      input: {
        root: '/tmp/state',
        path: 'extension-data/sample/databases/main.db',
        migrations: [{ version: 2, description: 'schema', sql: 'CREATE TABLE items (id TEXT PRIMARY KEY);' }],
      },
    });
  });
});
