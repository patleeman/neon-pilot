import { describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ getDurableSessionsDir: vi.fn(() => '/durable/sessions') }));

vi.mock('@neon-pilot/core', () => core);

import { resolvePersistentSessionDir, resolveSessionsDir, resolveSessionsIndexFile } from './sessionPaths';

describe('sessionPaths', () => {
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

  describe('resolvePersistentSessionDir', () => {
    it('uses getDurableSessionsDir when no options are provided', () => {
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
  });
});
