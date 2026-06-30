import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExtensionHostClient } from './extensions/extensionHostClient.js';
import type { ServerRouteContext } from './routes/context.js';
import { dismissSetupReadinessItem, readSetupReadiness, runSetupReadinessAction } from './setupReadiness.js';

function context(stateRoot: string): ServerRouteContext {
  return {
    getRuntimeScope: () => 'test',
    getRepoRoot: () => '/repo',
    getRuntimeConfigRoot: () => '/config',
    materializeWebRuntimeConfig: () => undefined,
    getSettingsFile: () => '/settings.json',
    getAuthFile: () => '/auth.json',
    getStateRoot: () => stateRoot,
    getServerPort: () => 0,
    getDefaultWebCwd: () => '/repo',
    resolveRequestedCwd: () => '/repo',
    buildLiveSessionResourceOptions: () => ({
      additionalExtensionPaths: [],
      additionalSkillPaths: [],
      additionalPromptTemplatePaths: [],
      additionalThemePaths: [],
    }),
    buildLiveSessionExtensionFactories: () => [],
    flushLiveDeferredResumes: async () => undefined,
    getSavedUiPreferences: () => ({}) as never,
    listTasksForRuntimeScope: () => [],
    listMemoryDocs: () => [],
    listSkillsForRuntimeScope: () => [],
    listProfileAgentItems: () => [],
    withTemporaryRuntimeAgentDir: async (_profile, run) => run('/tmp/agent'),
    getDurableRunSnapshot: async () => null,
  };
}

function client(input: { statusResult?: unknown; actionResult?: unknown } = {}) {
  const invokeAction = vi.fn(async (request: { actionId: string }) => {
    if (request.actionId === 'status')
      return { ok: true as const, result: input.statusResult ?? { status: 'needs_setup', detail: 'Missing.' } };
    return { ok: true as const, result: input.actionResult ?? { ok: true } };
  });
  const readRegistryPresentation = vi.fn(async () => ({
    schema: {},
    commandRegistrations: [],
    cliCommandRegistrations: [],
    keybindingRegistrations: [],
    slashCommandRegistrations: [],
    mentionRegistrations: [],
    quickOpenRegistrations: [],
    searchProviderRegistrations: [],
    snapshot: { extensions: [], routes: [], surfaces: [], views: [] },
    installSummaries: [
      {
        id: 'ext',
        name: 'Extension',
        status: 'enabled',
        manifest: {
          id: 'ext',
          name: 'Extension',
          schemaVersion: 2,
          packageType: 'system',
          contributes: {
            setupItems: [
              {
                id: 'item',
                title: 'Install thing',
                description: 'Adds the thing.',
                statusAction: 'status',
                severity: 'recommended',
                actions: [{ id: 'install', label: 'Install', action: 'install', tone: 'primary' }],
              },
            ],
          },
          backend: { entry: 'backend.js', actions: [] },
        },
      },
    ],
  }));
  return { readRegistryPresentation, invokeAction } as unknown as ExtensionHostClient & {
    readRegistryPresentation: typeof readRegistryPresentation;
    invokeAction: typeof invokeAction;
  };
}

describe('setupReadiness', () => {
  const tmpRoots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function tempRoot() {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-readiness-'));
    tmpRoots.push(root);
    return root;
  }

  it('reads enabled extension setup items and counts actionable incomplete items', async () => {
    const root = tempRoot();
    const host = client({ statusResult: { status: 'needs_setup', detail: 'Install required.', actions: ['install'] } });

    const snapshot = await readSetupReadiness(context(root), {
      extensionHostClient: host,
      now: () => new Date('2026-06-30T12:00:00.000Z'),
    });

    expect(snapshot.counts).toMatchObject({ total: 1, incomplete: 1, actionable: 1, ready: 0 });
    expect(snapshot.items[0]).toMatchObject({
      key: 'ext:item',
      title: 'Install thing',
      status: 'needs_setup',
      detail: 'Install required.',
      actions: [{ id: 'install', label: 'Install', tone: 'primary' }],
    });
    expect(host.invokeAction).toHaveBeenCalledWith(expect.objectContaining({ extensionId: 'ext', actionId: 'status' }));
  });

  it('persists dismissal and excludes dismissed items from actionable count', async () => {
    const root = tempRoot();
    const host = client();
    const ctx = context(root);

    const dismissed = await dismissSetupReadinessItem(
      ctx,
      { extensionId: 'ext', itemId: 'item', dismissed: true },
      { extensionHostClient: host },
    );

    expect(dismissed.counts).toMatchObject({ incomplete: 1, actionable: 0, dismissed: 1 });
    expect(dismissed.items[0].dismissed).toBe(true);
    expect(JSON.parse(readFileSync(join(root, 'setup-readiness.json'), 'utf8')).dismissed['ext:item']).toBeTruthy();
  });

  it('runs declared setup actions and clears dismissal', async () => {
    const root = tempRoot();
    const host = client({ statusResult: { status: 'ready', detail: 'Installed.' } });
    const ctx = context(root);
    await dismissSetupReadinessItem(ctx, { extensionId: 'ext', itemId: 'item', dismissed: true }, { extensionHostClient: host });

    const snapshot = await runSetupReadinessAction(
      ctx,
      { extensionId: 'ext', itemId: 'item', actionId: 'install' },
      { extensionHostClient: host },
    );

    expect(host.invokeAction).toHaveBeenCalledWith(expect.objectContaining({ extensionId: 'ext', actionId: 'install' }));
    expect(snapshot.items[0]).toMatchObject({ status: 'ready', dismissed: false });
    expect(snapshot.counts).toMatchObject({ ready: 1, actionable: 0 });
  });

  it('renders failed status checks as unknown instead of failing the full drawer', async () => {
    const root = tempRoot();
    const host = client();
    host.invokeAction.mockResolvedValueOnce({ ok: false, error: 'backend unavailable' });

    const snapshot = await readSetupReadiness(context(root), { extensionHostClient: host });

    expect(snapshot.items[0]).toMatchObject({ status: 'unknown', error: 'backend unavailable' });
    expect(snapshot.counts).toMatchObject({ incomplete: 1, unknown: 1 });
  });
});
