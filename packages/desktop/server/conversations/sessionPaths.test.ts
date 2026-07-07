import { describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ getDurableSessionsDir: vi.fn(() => '/durable/sessions') }));

vi.mock('@neon-pilot/core', () => core);

import {
  resolvePersistentSessionDir,
  resolveSessionsDir,
  resolveSessionsIndexFile,
  resolveSystemSessionsDir,
  setSessionPathsContext,
} from './sessionPaths';

describe('sessionPaths', () => {
  afterEach(() => {
    // Reset the context so tests don't interfere with each other
    setSessionPathsContext({});
  });

  it('uses the configured sessions dir when provided', () => {
    expect(resolveSessionsDir({ envSessionsDir: '/tmp/sessions', defaultSessionsDir: '/default/sessions' })).toBe('/tmp/sessions');
    expect(resolveSessionsDir({ defaultSessionsDir: '/default/sessions' })).toBe('/default/sessions');
  });

  it('resolves the session index file precedence', () => {
    expect(
      resolveSessionsIndexFile({
        envSessionsIndexFile: '/custom/index.json',
        envSessionsDir: '/tmp/sessions',
        defaultSessionsIndexFile: '/default/index.json',
      }),
    ).toBe('/custom/index.json');
    expect(resolveSessionsIndexFile({ envSessionsDir: '/tmp/sessions', defaultSessionsIndexFile: '/default/index.json' })).toBe(
      '/tmp/session-meta-index.json',
    );
    expect(resolveSessionsIndexFile({ defaultSessionsIndexFile: '/default/index.json' })).toBe('/default/index.json');
  });

  describe('resolveSystemSessionsDir', () => {
    it('returns layout.systemSessions when a DesktopRootLayout is provided', () => {
      const layout = { systemSessions: '/desktop-root/system/conversations/sessions' } as ReturnType<
        typeof import('@neon-pilot/core').resolveDesktopRootLayout
      >;
      expect(resolveSystemSessionsDir(layout)).toBe('/desktop-root/system/conversations/sessions');
    });

    it('falls back to getDurableSessionsDir when no layout is provided', () => {
      expect(resolveSystemSessionsDir()).toBe('/durable/sessions');
      expect(core.getDurableSessionsDir).toHaveBeenCalled();
    });

    it('uses the injected getDesktopRootLayout when set via setSessionPathsContext', () => {
      setSessionPathsContext({
        getDesktopRootLayout: () =>
          ({ systemSessions: '/context-root/system/conversations/sessions' }) as ReturnType<
            typeof import('@neon-pilot/core').resolveDesktopRootLayout
          >,
      });
      expect(resolveSystemSessionsDir()).toBe('/context-root/system/conversations/sessions');
    });

    it('falls back to getDurableSessionsDir when context getter throws', () => {
      setSessionPathsContext({
        getDesktopRootLayout: () => {
          throw new Error('no layout');
        },
      });
      expect(resolveSystemSessionsDir()).toBe('/durable/sessions');
    });

    it('layout parameter takes precedence over context', () => {
      setSessionPathsContext({
        getDesktopRootLayout: () =>
          ({ systemSessions: '/context-root/system/conversations/sessions' }) as ReturnType<
            typeof import('@neon-pilot/core').resolveDesktopRootLayout
          >,
      });
      const explicitLayout = { systemSessions: '/explicit/system/conversations/sessions' } as ReturnType<
        typeof import('@neon-pilot/core').resolveDesktopRootLayout
      >;
      expect(resolveSystemSessionsDir(explicitLayout)).toBe('/explicit/system/conversations/sessions');
    });
  });

  describe('resolvePersistentSessionDir', () => {
    it('uses getDurableSessionsDir when no options and no context are provided', () => {
      expect(resolvePersistentSessionDir('/Users/patrick/project')).toBe('/durable/sessions/--Users-patrick-project--');
    });

    it('strips leading slash and replaces separators with hyphens', () => {
      expect(resolvePersistentSessionDir('/dev/my:app', { sessionsDir: '/base' })).toBe('/base/--dev-my-app--');
      expect(resolvePersistentSessionDir('C:\\Users\\test', { sessionsDir: '/base' })).toBe('/base/--C--Users-test--');
    });

    it('uses custom sessionsDir when provided', () => {
      expect(resolvePersistentSessionDir('/project', { sessionsDir: '/custom/sessions' })).toBe('/custom/sessions/--project--');
    });

    it('does not call getDurableSessionsDir when sessionsDir is provided', () => {
      core.getDurableSessionsDir.mockClear();
      resolvePersistentSessionDir('/some/path', { sessionsDir: '/explicit/dir' });
      expect(core.getDurableSessionsDir).not.toHaveBeenCalled();
    });

    it('uses layout-derived sessions dir when context is set', () => {
      setSessionPathsContext({
        getDesktopRootLayout: () =>
          ({ systemSessions: '/desktop-root/system/conversations/sessions' }) as ReturnType<
            typeof import('@neon-pilot/core').resolveDesktopRootLayout
          >,
      });
      expect(resolvePersistentSessionDir('/my/project')).toBe('/desktop-root/system/conversations/sessions/--my-project--');
    });
  });
});
