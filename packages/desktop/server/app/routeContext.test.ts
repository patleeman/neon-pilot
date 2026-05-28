import { beforeEach, describe, expect, it } from 'vitest';

import { createServerRouteContext } from './routeContext.js';

describe('createServerRouteContext', () => {
  beforeEach(() => {
    process.env.NEON_PILOT_PROFILES_ROOT = '/tmp/test-runtime-config';
  });

  it('maps the provided route context callbacks and values', async () => {
    const options = {
      repoRoot: '/repo',
      settingsFile: '/repo/settings.json',
      authFile: '/repo/auth.json',
      getRuntimeScope: () => 'shared',
      materializeWebRuntimeConfig: () => undefined,
      getStateRoot: () => '/state',
      serverPort: 4111,
      getDefaultWebCwd: () => '/repo',
      resolveRequestedCwd: (cwd: string | null | undefined, defaultCwd?: string) => cwd ?? defaultCwd,
      buildLiveSessionResourceOptions: () => ({
        additionalExtensionPaths: [],
        additionalSkillPaths: [],
        additionalPromptTemplatePaths: [],
        additionalThemePaths: [],
      }),
      buildLiveSessionExtensionFactories: () => [],
      flushLiveDeferredResumes: async () => undefined,
      getSavedUiPreferences: () => ({ sidebarExpanded: true }),
      listTasksForRuntimeScope: () => [{ id: 'daily', title: 'Daily', prompt: 'Run daily', enabled: true, running: false }],
      listMemoryDocs: () => [{ id: 'desktop', title: 'Desktop', path: '/knowledge/notes/Desktop.md' }],
      listSkillsForRuntimeScope: () => [
        {
          name: 'agent-browser',
          source: 'shared',
          description: 'Browser automation',
          path: '/knowledge/_skills/agent-browser/SKILL.md',
        },
      ],
      listProfileAgentItems: () => [{ source: 'shared', path: '/knowledge/_profiles/assistant/AGENTS.md' }],
      withTemporaryRuntimeAgentDir: async <T>(_profile: string, run: (agentDir: string) => Promise<T>) => run('/tmp/agent-dir'),
      getDurableRunSnapshot: async () => ({ runId: 'run-123' }),
    };

    const context = createServerRouteContext(options);

    expect(context.getRuntimeScope()).toBe('shared');
    expect(context.getRepoRoot()).toBe('/repo');
    expect(context.getRuntimeConfigRoot()).toBe('/tmp/test-runtime-config');
    expect(context.getSettingsFile()).toBe('/repo/settings.json');
    expect(context.getAuthFile()).toBe('/repo/auth.json');
    expect(context.getStateRoot()).toBe('/state');
    expect(context.getServerPort()).toBe(4111);
    expect(context.getDefaultWebCwd()).toBe('/repo');
    expect(context.resolveRequestedCwd(undefined, '/fallback')).toBe('/fallback');
    expect(context.buildLiveSessionResourceOptions()).toEqual({
      additionalExtensionPaths: [],
      additionalSkillPaths: [],
      additionalPromptTemplatePaths: [],
      additionalThemePaths: [],
    });
    expect(context.buildLiveSessionExtensionFactories()).toEqual([]);
    await expect(context.flushLiveDeferredResumes()).resolves.toBeUndefined();
    expect(context.getSavedUiPreferences()).toEqual({ sidebarExpanded: true });
    expect(context.listTasksForRuntimeScope()).toHaveLength(1);
    expect(context.listMemoryDocs()).toHaveLength(1);
    expect(context.listSkillsForRuntimeScope()).toHaveLength(1);
    expect(context.listProfileAgentItems()).toEqual([{ source: 'shared', path: '/knowledge/_profiles/assistant/AGENTS.md' }]);
    await expect(context.withTemporaryRuntimeAgentDir('assistant', async (agentDir) => agentDir)).resolves.toBe('/tmp/agent-dir');
    await expect(context.getDurableRunSnapshot('run-123', 50)).resolves.toEqual({ runId: 'run-123' });
  });
});
