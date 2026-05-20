import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyDesktopRuntimeEnvironmentOverrides,
  resolveDesktopRuntimeEnvironmentOverrides,
  seedTestingRuntimeState,
} from './runtime-env.js';

describe('desktop runtime environment overrides', () => {
  it('does not override stable desktop launches', () => {
    expect(resolveDesktopRuntimeEnvironmentOverrides({}, { defaultStateRoot: '/state/neon-pilot' })).toEqual({});
  });

  it('isolates testing launches onto a separate state root', () => {
    expect(
      resolveDesktopRuntimeEnvironmentOverrides(
        {
          NEON_PILOT_DESKTOP_VARIANT: 'testing',
        },
        { defaultStateRoot: '/state/neon-pilot' },
      ),
    ).toEqual({
      stateRoot: '/state/neon-pilot-testing',
    });
  });

  it('isolates packaged RC launches onto a separate state root', () => {
    expect(
      resolveDesktopRuntimeEnvironmentOverrides({}, { defaultStateRoot: '/state/neon-pilot', version: '0.7.9-rc.10', packaged: true }),
    ).toEqual({
      stateRoot: '/state/neon-pilot-rc',
    });
  });

  it('respects explicit user overrides in testing launches', () => {
    expect(
      resolveDesktopRuntimeEnvironmentOverrides(
        {
          NEON_PILOT_DESKTOP_VARIANT: 'testing',
          NEON_PILOT_STATE_ROOT: '/custom/state',
        },
        { defaultStateRoot: '/state/neon-pilot' },
      ),
    ).toEqual({});
  });

  it('applies testing overrides directly onto the process environment', () => {
    const env: NodeJS.ProcessEnv = {
      NEON_PILOT_DESKTOP_DEV_BUNDLE: '1',
    };

    applyDesktopRuntimeEnvironmentOverrides(env);

    expect(env.NEON_PILOT_STATE_ROOT).toBeTruthy();
    expect(env.NEON_PILOT_STATE_ROOT).toMatch(/neon-pilot-testing$/);
    expect(env.CODEX_PORT).toBeUndefined();
    expect(env.NEON_PILOT_COMPANION_PORT).toBe('0');
    expect(env.NEON_PILOT_RUNTIME_CHANNEL).toBe('test');
    expect(env.NEON_PILOT_DAEMON_NAMESPACE).toMatch(/^test-[0-9a-f-]+$/u);
  });

  it('applies dev overrides directly onto the process environment', () => {
    const env: NodeJS.ProcessEnv = {
      NEON_PILOT_RUNTIME_CHANNEL: 'dev',
      XDG_STATE_HOME: '/state',
    };

    applyDesktopRuntimeEnvironmentOverrides(env);

    expect(env.NEON_PILOT_STATE_ROOT).toBe('/state/neon-pilot-dev');
    expect(env.CODEX_PORT).toBeUndefined();
    expect(env.NEON_PILOT_COMPANION_PORT).toBe('0');
    expect(env.NEON_PILOT_RUNTIME_CHANNEL).toBe('dev');
    expect(env.NEON_PILOT_DAEMON_NAMESPACE).toMatch(/^dev-[0-9a-f-]+$/u);
  });

  it('respects explicit daemon namespace for dev launches', () => {
    const env: NodeJS.ProcessEnv = {
      NEON_PILOT_RUNTIME_CHANNEL: 'dev',
      NEON_PILOT_DAEMON_NAMESPACE: 'pinned',
      XDG_STATE_HOME: '/state',
    };

    applyDesktopRuntimeEnvironmentOverrides(env);

    expect(env.NEON_PILOT_DAEMON_NAMESPACE).toBe('pinned');
  });

  it('applies RC overrides directly onto the process environment', () => {
    const env: NodeJS.ProcessEnv = {
      XDG_STATE_HOME: '/state',
    };

    applyDesktopRuntimeEnvironmentOverrides(env, { version: '0.7.9-rc.10', packaged: true });

    expect(env.NEON_PILOT_STATE_ROOT).toBe('/state/neon-pilot-rc');
    expect(env.CODEX_PORT).toBe('3847');
    expect(env.NEON_PILOT_COMPANION_PORT).toBe('3843');
    expect(env.NEON_PILOT_RUNTIME_CHANNEL).toBe('rc');
  });

  it('seeds testing auth from the stable runtime when the testing auth file is empty', () => {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-desktop-runtime-env-'));
    const stableAgentDir = join(root, 'neon-pilot', 'neon-pilot-runtime');
    const testingStateRoot = join(root, 'neon-pilot-testing');
    const testingAgentDir = join(testingStateRoot, 'neon-pilot-runtime');
    mkdirSync(stableAgentDir, { recursive: true });
    mkdirSync(testingAgentDir, { recursive: true });
    writeFileSync(join(stableAgentDir, 'auth.json'), JSON.stringify({ 'openai-codex': { accessToken: 'token' } }));
    writeFileSync(join(testingAgentDir, 'auth.json'), '{}');

    const env: NodeJS.ProcessEnv = {
      NEON_PILOT_DESKTOP_VARIANT: 'testing',
      NEON_PILOT_STATE_ROOT: testingStateRoot,
      XDG_STATE_HOME: root,
    };

    seedTestingRuntimeState(env);

    expect(JSON.parse(readFileSync(join(testingAgentDir, 'auth.json'), 'utf-8'))).toEqual({
      'openai-codex': { accessToken: 'token' },
    });
  });

  it('seeds missing stable credentials without overwriting testing auth', () => {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-desktop-runtime-env-'));
    const stableAgentDir = join(root, 'neon-pilot', 'neon-pilot-runtime');
    const testingStateRoot = join(root, 'neon-pilot-testing');
    const testingAgentDir = join(testingStateRoot, 'neon-pilot-runtime');
    mkdirSync(stableAgentDir, { recursive: true });
    mkdirSync(testingAgentDir, { recursive: true });
    writeFileSync(
      join(stableAgentDir, 'auth.json'),
      JSON.stringify({
        'openai-codex': { accessToken: 'stable-token' },
        openrouter: { type: 'api_key', key: 'stable-openrouter-token' },
      }),
    );
    writeFileSync(
      join(testingAgentDir, 'auth.json'),
      JSON.stringify({
        'openai-codex': { accessToken: 'testing-token' },
        telegram: { type: 'api_key', key: 'telegram-token' },
      }),
    );

    const env: NodeJS.ProcessEnv = {
      NEON_PILOT_DESKTOP_VARIANT: 'testing',
      NEON_PILOT_STATE_ROOT: testingStateRoot,
      XDG_STATE_HOME: root,
    };

    seedTestingRuntimeState(env);

    expect(JSON.parse(readFileSync(join(testingAgentDir, 'auth.json'), 'utf-8'))).toEqual({
      'openai-codex': { accessToken: 'testing-token' },
      openrouter: { type: 'api_key', key: 'stable-openrouter-token' },
      telegram: { type: 'api_key', key: 'telegram-token' },
    });
  });
});
