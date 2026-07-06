import { describe, expect, it, vi } from 'vitest';

const { sentinelLayout } = vi.hoisted(() => ({
  sentinelLayout: {
    root: '/mock/neon-pilot-desktop',
    apps: '/mock/neon-pilot-desktop/apps',
    data: '/mock/neon-pilot-desktop/data',
    dataApps: '/mock/neon-pilot-desktop/data/apps',
    dataDocuments: '/mock/neon-pilot-desktop/data/documents',
    documents: '/mock/neon-pilot-desktop/documents',
    agents: '/mock/neon-pilot-desktop/agents',
    logs: '/mock/neon-pilot-desktop/logs',
    logsDesktop: '/mock/neon-pilot-desktop/logs/desktop',
    logsDaemon: '/mock/neon-pilot-desktop/logs/daemon',
    logsTelemetry: '/mock/neon-pilot-desktop/logs/telemetry',
    system: '/mock/neon-pilot-desktop/system',
    systemAgents: '/mock/neon-pilot-desktop/system/agents',
    systemApps: '/mock/neon-pilot-desktop/system/apps',
    systemCache: '/mock/neon-pilot-desktop/system/cache',
    systemConfig: '/mock/neon-pilot-desktop/system/config',
    systemConversations: '/mock/neon-pilot-desktop/system/conversations',
    systemSessions: '/mock/neon-pilot-desktop/system/conversations/sessions',
    systemDaemon: '/mock/neon-pilot-desktop/system/daemon',
    systemElectron: '/mock/neon-pilot-desktop/system/electron',
    systemElectronUserData: '/mock/neon-pilot-desktop/system/electron/user-data',
    systemObservability: '/mock/neon-pilot-desktop/system/observability',
    systemRuntime: '/mock/neon-pilot-desktop/system/runtime',
    systemSecrets: '/mock/neon-pilot-desktop/system/secrets',
    systemState: '/mock/neon-pilot-desktop/system/state',
  },
}));

const captured = vi.hoisted(() => ({
  resourceLayout: undefined as Record<string, unknown> | undefined,
  assemblyLayout: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@neon-pilot/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@neon-pilot/core')>();
  return {
    ...mod,
    resolveDesktopRootLayout: () => sentinelLayout,
    resolveRuntimeResources: ((name: string, options: Record<string, unknown>) => {
      captured.resourceLayout = options.desktopRootLayout as Record<string, unknown> | undefined;
      return mod.resolveRuntimeResources(name, options);
    }) as typeof mod.resolveRuntimeResources,
  };
});

vi.mock('../prompt-assembly/promptAssembly.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../prompt-assembly/promptAssembly.js')>();
  return {
    ...mod,
    buildPromptAssemblyPlan: ((ctx: Record<string, unknown>) => {
      captured.assemblyLayout = ctx.desktopRootLayout as Record<string, unknown> | undefined;
      return mod.buildPromptAssemblyPlan(ctx);
    }) as typeof mod.buildPromptAssemblyPlan,
  };
});

import { buildLiveSessionExtensionFactoriesForRuntime, buildLiveSessionResourceOptionsForRuntime } from './runtimeAgentHooks.js';

describe('runtime agent hooks', () => {
  it('builds live-session resources and extension factories before the app runtime registers builders', () => {
    process.env.NEON_PILOT_REPO_ROOT = process.cwd();

    const options = buildLiveSessionResourceOptionsForRuntime();
    const factories = buildLiveSessionExtensionFactoriesForRuntime();

    expect(options.additionalExtensionPaths).toEqual(expect.any(Array));
    expect(options.additionalSkillPaths).toEqual(expect.any(Array));
    expect(options.additionalPromptTemplatePaths).toEqual(expect.any(Array));
    expect(options.additionalThemePaths).toEqual(expect.any(Array));
    expect(factories.length).toBeGreaterThan(0);
  });

  it('forwards resolveDesktopRootLayout result to both resolveRuntimeResources and buildPromptAssemblyPlan in the fallback path', () => {
    process.env.NEON_PILOT_REPO_ROOT = process.cwd();

    const options = buildLiveSessionResourceOptionsForRuntime();

    // The fallback path should forward the resolved desktop root layout
    // to both runtime resource resolution and prompt assembly
    expect(captured.resourceLayout).toBe(sentinelLayout);
    expect(captured.assemblyLayout).toBe(sentinelLayout);

    // Verify the result is still coherent
    expect(options.additionalExtensionPaths).toEqual(expect.any(Array));
    expect(options.additionalSkillPaths).toEqual(expect.any(Array));
    expect(options.additionalPromptTemplatePaths).toEqual(expect.any(Array));
    expect(options.additionalThemePaths).toEqual(expect.any(Array));
  });
});
