import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { coreMocks, extensionHostClientMocks, scheduledTaskCapabilityMocks } = vi.hoisted(() => {
  const desktopRootLayout = {
    root: '/tmp/neon-pilot-desktop-root-sentinel',
    apps: '/tmp/neon-pilot-desktop-root-sentinel/apps',
    data: '/tmp/neon-pilot-desktop-root-sentinel/data',
    dataApps: '/tmp/neon-pilot-desktop-root-sentinel/data/apps',
    dataDocuments: '/tmp/neon-pilot-desktop-root-sentinel/data/documents',
    documents: '/tmp/neon-pilot-desktop-root-sentinel/documents',
    agents: '/tmp/neon-pilot-desktop-root-sentinel/agents',
    logs: '/tmp/neon-pilot-desktop-root-sentinel/logs',
    logsDesktop: '/tmp/neon-pilot-desktop-root-sentinel/logs/desktop',
    logsDaemon: '/tmp/neon-pilot-desktop-root-sentinel/logs/daemon',
    logsTelemetry: '/tmp/neon-pilot-desktop-root-sentinel/logs/telemetry',
    system: '/tmp/neon-pilot-desktop-root-sentinel/system',
    systemAgents: '/tmp/neon-pilot-desktop-root-sentinel/system/agents',
    systemApps: '/tmp/neon-pilot-desktop-root-sentinel/system/apps',
    systemCache: '/tmp/neon-pilot-desktop-root-sentinel/system/cache',
    systemConfig: '/tmp/neon-pilot-desktop-root-sentinel/system/config',
    systemConversations: '/tmp/neon-pilot-desktop-root-sentinel/system/conversations',
    systemSessions: '/tmp/neon-pilot-desktop-root-sentinel/system/conversations/sessions',
    systemDaemon: '/tmp/neon-pilot-desktop-root-sentinel/system/daemon',
    systemElectron: '/tmp/neon-pilot-desktop-root-sentinel/system/electron',
    systemElectronUserData: '/tmp/neon-pilot-desktop-root-sentinel/system/electron/user-data',
    systemObservability: '/tmp/neon-pilot-desktop-root-sentinel/system/observability',
    systemRuntime: '/tmp/neon-pilot-desktop-root-sentinel/system/runtime',
    systemSecrets: '/tmp/neon-pilot-desktop-root-sentinel/system/secrets',
    systemState: '/tmp/neon-pilot-desktop-root-sentinel/system/state',
  };

  return {
    coreMocks: {
      desktopRootLayout,
      ensureDesktopRootDir: vi.fn(() => desktopRootLayout.root),
      resolveDesktopRootLayout: vi.fn(() => desktopRootLayout),
    },
    extensionHostClientMocks: {
      getExtensionHostClient: vi.fn(() => ({
        beginStartupGuard: async () => ({ safeMode: false, disabledIds: [] }),
        completeStartupGuard: async () => undefined,
        invokeAction: async () => ({ ok: true, result: null }),
        listEventSubscriptions: async () => [],
        listPromptAssemblyContributions: async () => ({ assemblyProviders: [], contextProviders: [], hooks: [] }),
        listServices: async () => [],
        listStaticContributions: async () => ({ modelDiscovery: [], skills: [], tools: [] }),
        readRegistryPresentation: async () => ({
          commandRegistrations: [],
          installSummaries: [],
          keybindingRegistrations: [],
          mentionRegistrations: [],
          quickOpenRegistrations: [],
          schema: { extensions: [] },
          searchProviderRegistrations: [],
          slashCommandRegistrations: [],
          snapshot: { extensions: [] },
        }),
        resolveFilePath: async () => {
          throw new Error('Extension files are unavailable for this extension.');
        },
        startStartupActions: async () => [],
      })),
    },
    scheduledTaskCapabilityMocks: {
      createScheduledTaskCapability: vi.fn(async () => ({ ok: true, task: { id: 'task-created' } })),
      deleteScheduledTaskCapability: vi.fn(async () => ({ deleted: true, ok: true })),
      listScheduledTasksCapability: vi.fn(() => ({ tasks: [] })),
      readScheduledTaskCapability: vi.fn(() => ({ task: null })),
      readScheduledTaskLogCapability: vi.fn(() => ({ log: null })),
      readScheduledTaskSchedulerHealth: vi.fn(() => ({ ok: true })),
      runScheduledTaskCapability: vi.fn(async () => ({ accepted: true, ok: true, runId: 'run-1' })),
      updateScheduledTaskCapability: vi.fn(async () => ({ ok: true, task: { id: 'task-updated' } })),
    },
  };
});

vi.mock('./bootstrap.js', async () => {
  const actual = await vi.importActual<typeof import('./bootstrap.js')>('./bootstrap.js');
  return {
    ...actual,
    startAttentionDispatchLoop: vi.fn(),
    startDeferredResumeLoop: vi.fn(),
  };
});

vi.mock('@neon-pilot/core', async () => {
  const actual = await vi.importActual<typeof import('@neon-pilot/core')>('@neon-pilot/core');
  return {
    ...actual,
    ensureDesktopRootDir: coreMocks.ensureDesktopRootDir,
    resolveDesktopRootLayout: coreMocks.resolveDesktopRootLayout,
    startKnowledgeBaseSyncLoop: vi.fn(),
    subscribeKnowledgeBaseState: vi.fn(() => vi.fn()),
  };
});

vi.mock('../extensions/extensionHostClient.js', () => extensionHostClientMocks);
vi.mock('../automation/scheduledTaskCapability.js', () => scheduledTaskCapabilityMocks);

import { createDesktopScheduledTask, deleteDesktopScheduledTask, runDesktopScheduledTask, updateDesktopScheduledTask } from './localApi.js';

describe('desktop local API scheduled task layout threading', () => {
  let stateRoot: string | undefined;

  beforeEach(() => {
    stateRoot = mkdtempSync(join(tmpdir(), 'np-local-api-layout-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    for (const mock of Object.values(scheduledTaskCapabilityMocks)) {
      mock.mockClear();
    }
  });

  afterEach(() => {
    delete process.env.NEON_PILOT_STATE_ROOT;
    if (stateRoot) rmSync(stateRoot, { force: true, recursive: true });
  });

  it('passes the local server route desktop layout into scheduled task mutations', async () => {
    await createDesktopScheduledTask({ title: 'Create', prompt: 'Run create' });
    await updateDesktopScheduledTask({ taskId: 'task-1', title: 'Update' });
    await runDesktopScheduledTask('task-1');
    await deleteDesktopScheduledTask('task-1');

    expect(scheduledTaskCapabilityMocks.createScheduledTaskCapability).toHaveBeenCalledWith(
      'shared',
      expect.objectContaining({ prompt: 'Run create', title: 'Create' }),
      coreMocks.desktopRootLayout,
    );
    expect(scheduledTaskCapabilityMocks.updateScheduledTaskCapability).toHaveBeenCalledWith(
      'shared',
      expect.objectContaining({ taskId: 'task-1', title: 'Update' }),
      coreMocks.desktopRootLayout,
    );
    expect(scheduledTaskCapabilityMocks.runScheduledTaskCapability).toHaveBeenCalledWith('shared', 'task-1', coreMocks.desktopRootLayout);
    expect(scheduledTaskCapabilityMocks.deleteScheduledTaskCapability).toHaveBeenCalledWith(
      'shared',
      'task-1',
      coreMocks.desktopRootLayout,
    );
  });
});
