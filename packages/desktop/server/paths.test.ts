import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveDaemonPaths } from './paths.js';

const originalStateRoot = process.env.NEON_PILOT_STATE_ROOT;
const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createDesktopLayout(root: string) {
  return resolveDesktopRootLayout({ root });
}

describe('daemon paths', () => {
  afterEach(async () => {
    if (originalStateRoot === undefined) {
      delete process.env.NEON_PILOT_STATE_ROOT;
    } else {
      process.env.NEON_PILOT_STATE_ROOT = originalStateRoot;
    }

    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('uses the default daemon directory under the state root', () => {
    const stateRoot = createTempDir('pa-dp-');
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;

    expect(resolveDaemonPaths()).toMatchObject({
      stateRoot,
      root: join(stateRoot, 'daemon'),
      socketPath: join(stateRoot, 'daemon', 'neon-pilotd.sock'),
      pidFile: join(stateRoot, 'daemon', 'neon-pilotd.pid'),
      logFile: join(stateRoot, 'daemon', 'logs', 'daemon.log'),
    });
  });

  it('isolates daemon runtime files under a namespace', () => {
    const stateRoot = createTempDir('pa-dp-');
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;

    expect(resolveDaemonPaths(undefined, 'dev run/1')).toMatchObject({
      stateRoot,
      root: join(stateRoot, 'daemon-dev-run-1'),
      socketPath: join(stateRoot, 'daemon-dev-run-1', 'neon-pilotd.sock'),
      pidFile: join(stateRoot, 'daemon-dev-run-1', 'neon-pilotd.pid'),
      logFile: join(stateRoot, 'daemon-dev-run-1', 'logs', 'daemon.log'),
    });
  });

  it('uses a short derived socket path when a namespaced runtime root would exceed the socket limit', () => {
    const stateRoot = join(tmpdir(), 'neon-pilot-qa', 'row-daemon-background-rerun', 'state');
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;

    const paths = resolveDaemonPaths(undefined, 'qa-row-daemon-background-rerun');

    expect(paths).toMatchObject({
      stateRoot,
      root: join(stateRoot, 'daemon-qa-row-daemon-background-rerun'),
      pidFile: join(stateRoot, 'daemon-qa-row-daemon-background-rerun', 'neon-pilotd.pid'),
      logFile: join(stateRoot, 'daemon-qa-row-daemon-background-rerun', 'logs', 'daemon.log'),
    });
    expect(paths.socketPath.length).toBeLessThanOrEqual(103);
    expect(paths.socketPath).toMatch(/neon-pilotd-[a-f0-9]{16}\.sock$/u);
  });

  it('isolates daemon runtime files beside an explicit socket path', () => {
    const stateRoot = createTempDir('pa-daemon-paths-state-');
    const daemonRoot = createTempDir('pa-daemon-paths-explicit-');
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;

    expect(resolveDaemonPaths(join(daemonRoot, 'custom.sock'))).toMatchObject({
      stateRoot,
      root: daemonRoot,
      socketPath: join(daemonRoot, 'custom.sock'),
      pidFile: join(daemonRoot, 'neon-pilotd.pid'),
      logFile: join(daemonRoot, 'logs', 'daemon.log'),
    });
  });

  describe('with DesktopRootLayout', () => {
    it('uses layout systemDaemon as root and layout logsDaemon for logs', () => {
      const stateRoot = createTempDir('pa-dp-layout-');
      process.env.NEON_PILOT_STATE_ROOT = stateRoot;
      const layout = createDesktopLayout('/mock/desktop-root');

      const result = resolveDaemonPaths(undefined, undefined, layout);

      expect(result).toMatchObject({
        stateRoot,
        root: '/mock/desktop-root/system/daemon',
        socketPath: '/mock/desktop-root/system/daemon/neon-pilotd.sock',
        pidFile: '/mock/desktop-root/system/daemon/neon-pilotd.pid',
        logDir: '/mock/desktop-root/logs/daemon',
        logFile: '/mock/desktop-root/logs/daemon/daemon.log',
      });
    });

    it('applies namespace suffix to layout systemDaemon', () => {
      const stateRoot = createTempDir('pa-dp-layout-ns-');
      process.env.NEON_PILOT_STATE_ROOT = stateRoot;
      const layout = createDesktopLayout('/mock/ns-root');

      const result = resolveDaemonPaths(undefined, 'staging-2', layout);

      expect(result).toMatchObject({
        stateRoot,
        root: '/mock/ns-root/system/daemon-staging-2',
        socketPath: '/mock/ns-root/system/daemon-staging-2/neon-pilotd.sock',
        pidFile: '/mock/ns-root/system/daemon-staging-2/neon-pilotd.pid',
        logDir: '/mock/ns-root/logs/daemon',
        logFile: '/mock/ns-root/logs/daemon/daemon.log',
      });
    });

    it('ignores layout when explicit socket path is provided', () => {
      const stateRoot = createTempDir('pa-dp-layout-explicit-');
      const daemonRoot = createTempDir('pa-dp-layout-explicit-daemon-');
      process.env.NEON_PILOT_STATE_ROOT = stateRoot;
      const layout = createDesktopLayout('/ignored-root');

      expect(resolveDaemonPaths(join(daemonRoot, 'custom.sock'), undefined, layout)).toMatchObject({
        stateRoot,
        root: daemonRoot,
        socketPath: join(daemonRoot, 'custom.sock'),
        pidFile: join(daemonRoot, 'neon-pilotd.pid'),
        logFile: join(daemonRoot, 'logs', 'daemon.log'),
      });
    });
  });
});
