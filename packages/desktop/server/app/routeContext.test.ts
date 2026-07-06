import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { describe, expect, it } from 'vitest';

import { createServerRouteContext } from './routeContext.js';

describe('createServerRouteContext', () => {
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
          path: '/knowledge/skills/agent-browser/SKILL.md',
        },
      ],
      listProfileAgentItems: () => [{ source: 'shared', path: '/knowledge/_profiles/assistant/AGENTS.md' }],
      withTemporaryRuntimeAgentDir: async <T>(_profile: string, run: (agentDir: string) => Promise<T>) => run('/tmp/agent-dir'),
      getDurableRunSnapshot: async () => ({ runId: 'run-123' }),
    };

    const context = createServerRouteContext(options);

    expect(context.getRuntimeScope()).toBe('shared');
    expect(context.getRepoRoot()).toBe('/repo');
    expect(context.getRuntimeConfigRoot()).toMatch(/\/config\/runtime$/);
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

  it('defaults getDesktopRootLayout to resolveDesktopRootLayout when no option is provided', () => {
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
      listTasksForRuntimeScope: () => [],
      listMemoryDocs: () => [],
      listSkillsForRuntimeScope: () => [],
      listProfileAgentItems: () => [],
      withTemporaryRuntimeAgentDir: async <T>(_profile: string, run: (agentDir: string) => Promise<T>) => run('/tmp/agent-dir'),
      getDurableRunSnapshot: async () => null,
    };

    const context = createServerRouteContext(options);
    const layout = context.getDesktopRootLayout();

    // Should match the core resolver output for default options
    const expected = resolveDesktopRootLayout();
    expect(layout).toEqual(expected);
  });

  it('uses an injected getDesktopRootLayout getter when provided', () => {
    const injectedLayout = {
      root: '/custom/root',
      apps: '/custom/root/apps',
      data: '/custom/root/data',
      dataApps: '/custom/root/data/apps',
      dataDocuments: '/custom/root/data/documents',
      documents: '/custom/root/documents',
      agents: '/custom/root/agents',
      logs: '/custom/root/logs',
      logsDesktop: '/custom/root/logs/desktop',
      logsDaemon: '/custom/root/logs/daemon',
      logsTelemetry: '/custom/root/logs/telemetry',
      system: '/custom/root/system',
      systemAgents: '/custom/root/system/agents',
      systemApps: '/custom/root/system/apps',
      systemCache: '/custom/root/system/cache',
      systemConfig: '/custom/root/system/config',
      systemConversations: '/custom/root/system/conversations',
      systemSessions: '/custom/root/system/conversations/sessions',
      systemDaemon: '/custom/root/system/daemon',
      systemElectron: '/custom/root/system/electron',
      systemElectronUserData: '/custom/root/system/electron/user-data',
      systemObservability: '/custom/root/system/observability',
      systemRuntime: '/custom/root/system/runtime',
      systemSecrets: '/custom/root/system/secrets',
      systemState: '/custom/root/system/state',
    };

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
      getDesktopRootLayout: () => injectedLayout,
      buildLiveSessionResourceOptions: () => ({
        additionalExtensionPaths: [],
        additionalSkillPaths: [],
        additionalPromptTemplatePaths: [],
        additionalThemePaths: [],
      }),
      buildLiveSessionExtensionFactories: () => [],
      flushLiveDeferredResumes: async () => undefined,
      getSavedUiPreferences: () => ({ sidebarExpanded: true }),
      listTasksForRuntimeScope: () => [],
      listMemoryDocs: () => [],
      listSkillsForRuntimeScope: () => [],
      listProfileAgentItems: () => [],
      withTemporaryRuntimeAgentDir: async <T>(_profile: string, run: (agentDir: string) => Promise<T>) => run('/tmp/agent-dir'),
      getDurableRunSnapshot: async () => null,
    };

    const context = createServerRouteContext(options);
    const layout = context.getDesktopRootLayout();

    expect(layout).toBe(injectedLayout);
    expect(layout.root).toBe('/custom/root');
    expect(layout.systemSecrets).toBe('/custom/root/system/secrets');
  });
});
