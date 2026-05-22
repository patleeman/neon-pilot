import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ existing: new Set<string>(), existsSync: vi.fn((path: string) => fs.existing.has(path)) }));
vi.mock('node:fs', () => fs);

import { buildBackgroundAgentArgv, looksLikeBackgroundAgentRunnerEntryPath } from './background-run-agent.js';

describe('background run agent argv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    fs.existing.clear();
    process.env = { ...originalEnv };
  });

  it('recognizes background agent runner entry paths', () => {
    expect(looksLikeBackgroundAgentRunnerEntryPath(undefined)).toBe(false);
    expect(looksLikeBackgroundAgentRunnerEntryPath('/repo/daemon/background-agent-runner.js')).toBe(true);
    expect(looksLikeBackgroundAgentRunnerEntryPath('C:\\repo\\daemon\\background-agent-runner.js')).toBe(true);
    expect(looksLikeBackgroundAgentRunnerEntryPath('/repo/daemon/other.js')).toBe(false);
  });

  it('prefers dev repo runner path when present and includes optional flags', () => {
    process.env.NEON_PILOT_REPO_ROOT = '/repo';
    fs.existing.add('/repo/packages/desktop/server/dist/daemon/background-agent-runner.js');

    expect(
      buildBackgroundAgentArgv({ prompt: 'do work', noSession: true, model: 'provider/model', allowedTools: ['bash', 'read'] }),
    ).toEqual([
      process.execPath,
      '/repo/packages/desktop/server/dist/daemon/background-agent-runner.js',
      '--prompt',
      'do work',
      '--no-session',
      '--model',
      'provider/model',
      '--tools',
      'bash,read',
    ]);
  });

  it('falls back through app/resources candidates and omits empty optional flags', () => {
    process.env.NEON_PILOT_REPO_ROOT = '';
    process.env.NEON_PILOT_APP_ROOT = '/app';
    process.env.NEON_PILOT_RESOURCES_ROOT = '/resources';
    fs.existing.add('/resources/app.asar/server/dist/daemon/background-agent-runner.js');

    expect(buildBackgroundAgentArgv({ prompt: 'do work', allowedTools: [] })).toEqual([
      process.execPath,
      '/resources/app.asar/server/dist/daemon/background-agent-runner.js',
      '--prompt',
      'do work',
    ]);
  });

  it('uses the first candidate when no candidate exists', () => {
    process.env.NEON_PILOT_REPO_ROOT = '/repo';
    expect(buildBackgroundAgentArgv({ prompt: 'do work' }).slice(1, 4)).toEqual([
      '/repo/packages/desktop/server/dist/daemon/background-agent-runner.js',
      '--prompt',
      'do work',
    ]);
  });
});
