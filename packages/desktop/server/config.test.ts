import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDaemonConfigFilePath, getDefaultDaemonConfig, loadDaemonConfig } from './config.js';

describe('daemon config', () => {
  const stateRoot = join(tmpdir(), `daemon-config-test-${randomUUID()}`);
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, NEON_PILOT_STATE_ROOT: stateRoot };
    delete process.env.NEON_PILOT_DAEMON_CONFIG;
    delete process.env.NEON_PILOT_DAEMON_SOCKET_PATH;
    delete process.env.NEON_PILOT_COMPANION_PORT;
    rmSync(stateRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('resolves an explicit daemon config path with home expansion', () => {
    process.env.NEON_PILOT_DAEMON_CONFIG = ' ~/daemon.yaml ';

    expect(getDaemonConfigFilePath()).toBe(resolve(join(homedir(), 'daemon.yaml')));
  });

  it('falls back to the runtime machine config path when no explicit daemon config is set', () => {
    expect(getDaemonConfigFilePath()).toBe(join(stateRoot, 'config', 'config.json'));
  });

  it('builds defaults from durable task paths, socket override, and companion port override', () => {
    process.env.NEON_PILOT_DAEMON_SOCKET_PATH = '/tmp/neon.sock';
    process.env.NEON_PILOT_COMPANION_PORT = '4567';

    expect(getDefaultDaemonConfig()).toEqual({
      logLevel: 'info',
      queue: { maxDepth: 1000 },
      ipc: { socketPath: '/tmp/neon.sock' },
      companion: { port: 4567 },
      modules: {
        maintenance: { enabled: true, cleanupIntervalMinutes: 60 },
        tasks: {
          enabled: true,
          taskDir: join(stateRoot, 'sync', 'tasks'),
          tickIntervalSeconds: 30,
          maxRetries: 3,
          reapAfterDays: 7,
          defaultTimeoutSeconds: 1800,
        },
      },
    });
  });

  it('deep merges daemon config overrides and expands configured paths', () => {
    mkdirSync(join(stateRoot, 'config'), { recursive: true });
    writeFileSync(
      join(stateRoot, 'config', 'config.json'),
      JSON.stringify({
        daemon: {
          logLevel: 'debug',
          queue: { maxDepth: 10 },
          ipc: { socketPath: '~/runtime/daemon.sock' },
          modules: { tasks: { enabled: false, taskDir: '~/tasks', maxRetries: 8 } },
        },
      }),
    );

    expect(loadDaemonConfig()).toMatchObject({
      logLevel: 'debug',
      queue: { maxDepth: 10 },
      ipc: { socketPath: resolve(join(homedir(), 'runtime/daemon.sock')) },
      modules: {
        maintenance: { enabled: true, cleanupIntervalMinutes: 60 },
        tasks: {
          enabled: false,
          taskDir: resolve(join(homedir(), 'tasks')),
          tickIntervalSeconds: 30,
          maxRetries: 8,
          reapAfterDays: 7,
          defaultTimeoutSeconds: 1800,
        },
      },
    });
  });

  it('creates nested override records from scratch', () => {
    mkdirSync(join(stateRoot, 'config'), { recursive: true });
    writeFileSync(join(stateRoot, 'config', 'config.json'), JSON.stringify({ daemon: { modules: { custom: { values: ['b'] } } } }));

    expect(loadDaemonConfig()).toMatchObject({ modules: { custom: { values: ['b'] } } });
  });
});
