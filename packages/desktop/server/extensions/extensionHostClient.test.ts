import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { describe, expect, it, vi } from 'vitest';

const extensionBackend = vi.hoisted(() => ({
  checkEnabledExtensionBackendHealth: vi.fn(),
  invokeExtensionAction: vi.fn(),
  invokeExtensionRoute: vi.fn(),
  invokeExtensionProtocolEntrypoint: vi.fn(),
  listExtensionActionTelemetry: vi.fn(),
  reloadExtensionBackend: vi.fn(),
  runExtensionSelfTest: vi.fn(),
  startExtensionStartupActions: vi.fn(),
}));
const extensionSubscriptions = vi.hoisted(() => ({
  installSubscriptionsForExtension: vi.fn(),
  publishExtensionHostEvent: vi.fn(),
  uninstallExtensionSubscriptions: vi.fn(),
}));
const extensionServices = vi.hoisted(() => ({
  listRunningExtensionServices: vi.fn(),
  startExtensionServices: vi.fn(),
  startServicesForExtension: vi.fn(),
  stopExtensionServices: vi.fn(),
}));
const extensionEventBus = vi.hoisted(() => ({
  listExtensionEventSubscriptions: vi.fn(),
}));
const extensionStorage = vi.hoisted(() => ({
  deleteExtensionState: vi.fn(),
  listExtensionState: vi.fn(),
  readExtensionState: vi.fn(),
  writeExtensionState: vi.fn(),
}));
const extensionRegistry = vi.hoisted(() => ({
  findExtensionEntry: vi.fn(),
  listExtensionAssemblyProviderRegistrations: vi.fn(),
  listExtensionPromptAssemblyHookRegistrations: vi.fn(),
  listExtensionPromptContextProviderRegistrations: vi.fn(),
  listExtensionSkillRegistrations: vi.fn(),
  listExtensionToolRegistrations: vi.fn(),
  listEnabledExtensionEntries: vi.fn(),
  listExtensionInstallSummaries: vi.fn(),
  listExtensionCliCommandRegistrations: vi.fn(),
  listExtensionCommandRegistrations: vi.fn(),
  listExtensionKeybindingRegistrations: vi.fn(),
  listExtensionMentionRegistrations: vi.fn(),
  listExtensionPromptReferenceRegistrations: vi.fn(),
  listExtensionQuickOpenRegistrations: vi.fn(),
  listExtensionSearchProviderRegistrations: vi.fn(),
  listExtensionSlashCommandRegistrations: vi.fn(),
  readExtensionSchema: vi.fn(),
  readExtensionRegistrySnapshot: vi.fn(),
  resolveExtensionModelProfile: vi.fn(),
  clearBuildError: vi.fn(),
  beginExtensionStartupGuard: vi.fn(),
  completeExtensionStartupGuard: vi.fn(),
  invalidateExtensionRegistryReadCaches: vi.fn(),
  setExtensionEnabled: vi.fn(),
  setExtensionKeybinding: vi.fn(),
  setBuildError: vi.fn(),
}));

vi.mock('./extensionBackend.js', () => extensionBackend);
vi.mock('./extensionSubscriptions.js', () => extensionSubscriptions);
vi.mock('./extensionServices.js', () => extensionServices);
vi.mock('./extensionEventBus.js', () => extensionEventBus);
vi.mock('./extensionStorage.js', () => extensionStorage);
vi.mock('./extensionRegistry.js', () => extensionRegistry);

import { clearExtensionHostAuditEvents, listExtensionHostAuditEvents } from './extensionHostAudit.js';
import {
  createInProcessExtensionHostClient,
  getExtensionHostClient,
  handleInProcessExtensionHostRequest,
  setExtensionHostClient,
} from './extensionHostClient.js';
import { extensionHostRequestName } from './extensionHostProtocol.js';

describe('extension host client', () => {
  it('requires product callers to configure an extension host client', () => {
    setExtensionHostClient(undefined);

    expect(() => getExtensionHostClient()).toThrow('Extension host client is not configured');
  });

  it('reports in-process host health when explicitly configured', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());

    await expect(getExtensionHostClient().health()).resolves.toEqual({ status: 'ready' });
  });

  it('stores the configured client on the process global for split bundle module graphs', () => {
    const client = createInProcessExtensionHostClient();
    setExtensionHostClient(client);

    expect(getExtensionHostClient()).toBe(client);
  });

  it('routes invokeAction through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { done: true } });

    await expect(
      getExtensionHostClient().invokeAction({
        extensionId: 'ext',
        actionId: 'doThing',
        input: { x: 1 },
        serverContextSnapshot: { runtimeScope: 'shared' },
        toolContext: { conversationId: 'conv' },
        agentToolContext: { callId: 'tool-call' },
      }),
    ).resolves.toEqual({ ok: true, result: { done: true } });

    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith(
      'ext',
      'doThing',
      { x: 1 },
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
      { conversationId: 'conv' },
      { callId: 'tool-call' },
    );
  });

  it('allows the in-process request handler to resolve live server contexts internally', async () => {
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { done: true } });

    await expect(
      handleInProcessExtensionHostRequest({
        type: 'invokeAction',
        extensionId: 'ext',
        actionId: 'doThing',
        input: { x: 1 },
        serverContext: { getRuntimeScope: () => 'shared' },
      }),
    ).resolves.toEqual({ ok: true, result: { ok: true, result: { done: true } } });

    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith(
      'ext',
      'doThing',
      { x: 1 },
      { getRuntimeScope: expect.any(Function) },
      undefined,
      undefined,
    );
  });

  it('reconstructs tool context snapshots for in-process request handling', async () => {
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { done: true } });

    await expect(
      handleInProcessExtensionHostRequest({
        type: 'invokeAction',
        extensionId: 'ext',
        actionId: 'doThing',
        input: { x: 1 },
        toolContextSnapshot: {
          cwd: '/repo',
          conversationId: 'conversation-1',
          preferredVisionModel: 'openai/gpt-4o',
          sessionFile: '/repo/session.jsonl',
          sessionId: 'session-1',
        },
      }),
    ).resolves.toEqual({ ok: true, result: { ok: true, result: { done: true } } });

    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith(
      'ext',
      'doThing',
      { x: 1 },
      undefined,
      {
        cwd: '/repo',
        conversationId: 'conversation-1',
        preferredVisionModel: 'openai/gpt-4o',
        sessionFile: '/repo/session.jsonl',
        sessionId: 'session-1',
      },
      undefined,
    );
  });

  it('merges toolContext with toolContextSnapshot when both are present (the real tool invocation path)', async () => {
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { done: true } });

    const onUpdate = () => {};
    await expect(
      handleInProcessExtensionHostRequest({
        type: 'invokeAction',
        extensionId: 'ext',
        actionId: 'doThing',
        input: { x: 1 },
        // toolContext carries the streaming callback (no conversationId)
        toolContext: { onUpdate },
        // toolContextSnapshot carries the static context with conversationId
        toolContextSnapshot: {
          cwd: '/repo',
          conversationId: 'conversation-1',
          preferredVisionModel: 'openai/gpt-4o',
          sessionFile: '/repo/session.jsonl',
          sessionId: 'session-1',
        },
      }),
    ).resolves.toEqual({ ok: true, result: { ok: true, result: { done: true } } });

    // The handler must merge both: conversationId and cwd from snapshot,
    // onUpdate from toolContext, all present in the final tool context.
    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith(
      'ext',
      'doThing',
      { x: 1 },
      undefined,
      {
        cwd: '/repo',
        conversationId: 'conversation-1',
        preferredVisionModel: 'openai/gpt-4o',
        sessionFile: '/repo/session.jsonl',
        sessionId: 'session-1',
        onUpdate,
      },
      undefined,
    );
  });

  it('prefers toolContext fields over toolContextSnapshot when keys overlap', async () => {
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { done: true } });

    await expect(
      handleInProcessExtensionHostRequest({
        type: 'invokeAction',
        extensionId: 'ext',
        actionId: 'doThing',
        input: {},
        toolContext: { conversationId: 'override-conv' },
        toolContextSnapshot: { conversationId: 'snapshot-conv', cwd: '/repo', sessionId: 'session-1' },
      }),
    ).resolves.toEqual({ ok: true, result: { ok: true, result: { done: true } } });

    // The explicit toolContext.conversationId must win over the snapshot value
    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith(
      'ext',
      'doThing',
      {},
      undefined,
      {
        conversationId: 'override-conv',
        cwd: '/repo',
        sessionId: 'session-1',
      },
      undefined,
    );
  });

  it('passes undefined toolContext when neither toolContext nor toolContextSnapshot are provided', async () => {
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { done: true } });

    await expect(
      handleInProcessExtensionHostRequest({
        type: 'invokeAction',
        extensionId: 'ext',
        actionId: 'doThing',
        input: {},
      }),
    ).resolves.toEqual({ ok: true, result: { ok: true, result: { done: true } } });

    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith('ext', 'doThing', {}, undefined, undefined, undefined);
  });

  it('converts request handler throws into protocol errors', async () => {
    clearExtensionHostAuditEvents();
    extensionBackend.invokeExtensionAction.mockRejectedValueOnce(new Error('boom'));

    await expect(
      handleInProcessExtensionHostRequest({ type: 'invokeAction', extensionId: 'ext', actionId: 'explode', input: null }),
    ).resolves.toEqual({ ok: false, error: 'boom' });

    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        id: 1,
        requestType: 'invokeAction',
        requestName: 'invokeAction:ext/explode',
        ok: false,
        error: 'boom',
      }),
    ]);
    expect(listExtensionHostAuditEvents()[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records successful extension host request audit metadata without payloads', async () => {
    clearExtensionHostAuditEvents();

    await expect(handleInProcessExtensionHostRequest({ type: 'health' })).resolves.toEqual({ ok: true, status: 'ready' });

    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        id: 1,
        requestType: 'health',
        requestName: 'health',
        ok: true,
      }),
    ]);
    expect(listExtensionHostAuditEvents()[0]).not.toHaveProperty('payload');
    expect(listExtensionHostAuditEvents()[0]).not.toHaveProperty('body');
  });

  it('routes host audit event reads through the extension host request envelope', async () => {
    clearExtensionHostAuditEvents();
    setExtensionHostClient(createInProcessExtensionHostClient());

    await handleInProcessExtensionHostRequest({ type: 'health' });

    await expect(getExtensionHostClient().listAuditEvents()).resolves.toEqual([
      expect.objectContaining({
        requestType: 'health',
        requestName: 'health',
        ok: true,
      }),
    ]);
  });

  it('routes publishEvent through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionSubscriptions.publishExtensionHostEvent.mockResolvedValueOnce(undefined);

    await expect(getExtensionHostClient().publishEvent('settings', { type: 'changed' })).resolves.toBeUndefined();

    expect(extensionSubscriptions.publishExtensionHostEvent).toHaveBeenCalledWith('settings', { type: 'changed' });
  });

  it('routes subscription lifecycle through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionSubscriptions.installSubscriptionsForExtension.mockResolvedValueOnce(undefined);

    await expect(
      getExtensionHostClient().installSubscriptions({
        extensionId: 'ext',
        serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' },
      }),
    ).resolves.toBeUndefined();
    await expect(getExtensionHostClient().uninstallSubscriptions('ext')).resolves.toBeUndefined();

    expect(extensionSubscriptions.installSubscriptionsForExtension).toHaveBeenCalledWith(
      'ext',
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
    expect(extensionSubscriptions.uninstallExtensionSubscriptions).toHaveBeenCalledWith('ext');
  });

  it('routes service lifecycle through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionServices.listRunningExtensionServices.mockReturnValueOnce([
      { extensionId: 'ext', serviceId: 'svc', startedAt: '2026-01-01T00:00:00.000Z', stop: () => undefined },
    ]);
    extensionServices.startExtensionServices.mockResolvedValueOnce([{ extensionId: 'ext', serviceId: 'svc', ok: true }]);
    extensionServices.stopExtensionServices.mockResolvedValueOnce(undefined);

    await expect(getExtensionHostClient().listServices()).resolves.toEqual([
      { extensionId: 'ext', serviceId: 'svc', startedAt: '2026-01-01T00:00:00.000Z', lastError: undefined },
    ]);
    await expect(
      getExtensionHostClient().startServices({ serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' } }),
    ).resolves.toEqual([{ extensionId: 'ext', serviceId: 'svc', ok: true }]);
    await expect(getExtensionHostClient().stopServices('ext')).resolves.toBeUndefined();

    expect(extensionServices.startExtensionServices).toHaveBeenCalledWith(
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
    expect(extensionServices.stopExtensionServices).toHaveBeenCalledWith('ext');
  });

  it('routes prompt assembly contribution reads through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.listExtensionPromptContextProviderRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', id: 'ctx', handler: 'context' },
    ]);
    extensionRegistry.listExtensionAssemblyProviderRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', id: 'instructions', handler: 'instructions', kind: 'instructions' },
    ]);
    extensionRegistry.listExtensionPromptAssemblyHookRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', id: 'hook', handler: 'hook', phase: 'after-assembly' },
    ]);

    await expect(getExtensionHostClient().listPromptAssemblyContributions()).resolves.toEqual({
      contextProviders: [{ extensionId: 'ext', id: 'ctx', handler: 'context' }],
      assemblyProviders: [{ extensionId: 'ext', id: 'instructions', handler: 'instructions', kind: 'instructions' }],
      hooks: [{ extensionId: 'ext', id: 'hook', handler: 'hook', phase: 'after-assembly' }],
    });
  });

  it('routes static contribution reads through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.listExtensionToolRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', packageType: 'system', id: 'tool', name: 'tool', action: 'run', description: 'Tool', inputSchema: {} },
    ]);
    extensionRegistry.listExtensionSkillRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', packageType: 'system', id: 'skill', name: 'skill', path: '/ext/skill/SKILL.md', packageRoot: '/ext' },
    ]);
    extensionRegistry.listEnabledExtensionEntries.mockReturnValueOnce([
      { manifest: { id: 'ext', contributes: { modelDiscovery: { action: 'discoverModels' } } } },
      { manifest: { id: 'ignored', contributes: { modelDiscovery: { action: 123 } } } },
    ]);

    await expect(getExtensionHostClient().listStaticContributions()).resolves.toEqual({
      tools: [{ extensionId: 'ext', packageType: 'system', id: 'tool', name: 'tool', action: 'run', description: 'Tool', inputSchema: {} }],
      skills: [{ extensionId: 'ext', packageType: 'system', id: 'skill', name: 'skill', path: '/ext/skill/SKILL.md', packageRoot: '/ext' }],
      modelDiscovery: [{ extensionId: 'ext', action: 'discoverModels' }],
    });
  });

  it('threads DesktopRootLayout from serverContextSnapshot through listStaticContributions', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionRegistry.listExtensionToolRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionSkillRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listEnabledExtensionEntries.mockReturnValueOnce([]);

    await expect(
      getExtensionHostClient().listStaticContributions({
        runtimeScope: 'shared',
        stateRoot: '/tmp/neon-pilot-state',
        desktopRootLayout: layout,
      }),
    ).resolves.toEqual({
      tools: [],
      skills: [],
      modelDiscovery: [],
    });

    expect(extensionRegistry.listExtensionToolRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionSkillRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listEnabledExtensionEntries).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
  });

  it('threads DesktopRootLayout from serverContextSnapshot through listPromptAssemblyContributions', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionRegistry.listExtensionPromptContextProviderRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionAssemblyProviderRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionPromptAssemblyHookRegistrations.mockReturnValueOnce([]);

    await expect(
      getExtensionHostClient().listPromptAssemblyContributions({
        runtimeScope: 'shared',
        stateRoot: '/tmp/neon-pilot-state',
        desktopRootLayout: layout,
      }),
    ).resolves.toEqual({
      contextProviders: [],
      assemblyProviders: [],
      hooks: [],
    });

    expect(extensionRegistry.listExtensionPromptContextProviderRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionAssemblyProviderRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionPromptAssemblyHookRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
  });

  it('routes registry presentation reads through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.listExtensionInstallSummaries.mockReturnValueOnce([{ id: 'ext', name: 'Ext' }]);
    extensionRegistry.listExtensionCliCommandRegistrations.mockReturnValueOnce([{ id: 'cli' }]);
    extensionRegistry.listExtensionCommandRegistrations.mockReturnValueOnce([{ id: 'command' }]);
    extensionRegistry.listExtensionKeybindingRegistrations.mockReturnValueOnce([{ id: 'keybinding' }]);
    extensionRegistry.listExtensionSlashCommandRegistrations.mockReturnValueOnce([{ name: 'run' }]);
    extensionRegistry.listExtensionMentionRegistrations.mockReturnValueOnce([{ id: 'mention' }]);
    extensionRegistry.listExtensionQuickOpenRegistrations.mockReturnValueOnce([{ id: 'quick' }]);
    extensionRegistry.listExtensionSearchProviderRegistrations.mockReturnValueOnce([{ id: 'search' }]);
    extensionRegistry.readExtensionSchema.mockReturnValueOnce({ manifestVersion: 2 });
    extensionRegistry.readExtensionRegistrySnapshot.mockReturnValueOnce({
      extensions: [{ id: 'ext' }],
      routes: [],
      surfaces: [],
      views: [],
    });

    await expect(getExtensionHostClient().readRegistryPresentation()).resolves.toEqual({
      schema: { manifestVersion: 2 },
      installSummaries: [{ id: 'ext', name: 'Ext' }],
      commandRegistrations: [{ id: 'command' }],
      cliCommandRegistrations: [{ id: 'cli' }],
      keybindingRegistrations: [{ id: 'keybinding' }],
      slashCommandRegistrations: [{ name: 'run' }],
      mentionRegistrations: [{ id: 'mention' }],
      quickOpenRegistrations: [{ id: 'quick' }],
      searchProviderRegistrations: [{ id: 'search' }],
      snapshot: { extensions: [{ id: 'ext' }], routes: [], surfaces: [], views: [] },
    });
  });

  it('threads stateRoot and DesktopRootLayout through registry presentation reads', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionRegistry.listExtensionInstallSummaries.mockReturnValueOnce([]);
    extensionRegistry.listExtensionCliCommandRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionCommandRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionKeybindingRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionSlashCommandRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionMentionRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionQuickOpenRegistrations.mockReturnValueOnce([]);
    extensionRegistry.listExtensionSearchProviderRegistrations.mockReturnValueOnce([]);
    extensionRegistry.readExtensionSchema.mockReturnValueOnce({ manifestVersion: 2 });
    extensionRegistry.readExtensionRegistrySnapshot.mockReturnValueOnce({
      extensions: [],
      routes: [],
      surfaces: [],
      views: [],
    });

    await expect(
      getExtensionHostClient().readRegistryPresentation({
        runtimeScope: 'shared',
        stateRoot: '/tmp/neon-pilot-state',
        desktopRootLayout: layout,
      }),
    ).resolves.toEqual({
      schema: { manifestVersion: 2 },
      installSummaries: [],
      commandRegistrations: [],
      cliCommandRegistrations: [],
      keybindingRegistrations: [],
      slashCommandRegistrations: [],
      mentionRegistrations: [],
      quickOpenRegistrations: [],
      searchProviderRegistrations: [],
      snapshot: { extensions: [], routes: [], surfaces: [], views: [] },
    });

    expect(extensionRegistry.listExtensionInstallSummaries).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionCommandRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionCliCommandRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionKeybindingRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionSlashCommandRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionMentionRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionQuickOpenRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.listExtensionSearchProviderRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.readExtensionRegistrySnapshot).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
  });

  it('routes event subscription listing through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionEventBus.listExtensionEventSubscriptions.mockReturnValueOnce([{ extensionId: 'ext', pattern: 'host:*' }]);

    await expect(getExtensionHostClient().listEventSubscriptions()).resolves.toEqual([{ extensionId: 'ext', pattern: 'host:*' }]);
  });

  it('routes extension enablement through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionServices.startExtensionServices.mockClear();
    extensionServices.startServicesForExtension.mockClear();
    extensionRegistry.findExtensionEntry.mockReturnValueOnce({
      manifest: { id: 'ext', name: 'Ext', backend: { onEnableAction: 'enabled' } },
    });
    extensionRegistry.listExtensionInstallSummaries
      .mockReturnValueOnce([{ id: 'ext', status: 'disabled' }])
      .mockReturnValueOnce([{ id: 'ext', status: 'disabled' }])
      .mockReturnValue([{ id: 'ext', status: 'enabled', enabled: true }]);
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { enabled: true } });
    extensionSubscriptions.installSubscriptionsForExtension.mockResolvedValueOnce(undefined);
    extensionServices.startServicesForExtension.mockResolvedValueOnce([]);

    await expect(
      getExtensionHostClient().setEnabled({
        extensionId: 'ext',
        enabled: true,
        serverContextSnapshot: { runtimeScope: 'shared', stateRoot: '/tmp/neon-pilot-state', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({
      ok: true,
      extension: { id: 'ext', status: 'enabled', enabled: true },
      actionResult: { ok: true, result: { enabled: true } },
    });
    expect(extensionRegistry.findExtensionEntry).toHaveBeenCalledWith('ext', '/tmp/neon-pilot-state', layout);
    expect(extensionRegistry.setExtensionEnabled).toHaveBeenCalledWith('ext', true, '/tmp/neon-pilot-state', layout);
    expect(extensionSubscriptions.installSubscriptionsForExtension).toHaveBeenCalledWith(
      'ext',
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
    expect(extensionServices.startServicesForExtension).toHaveBeenCalledWith(
      'ext',
      expect.objectContaining({ getRuntimeScope: expect.any(Function) }),
    );
    expect(extensionServices.startExtensionServices).not.toHaveBeenCalled();
  });

  it('rejects disablement for required system extensions through the host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.setExtensionEnabled.mockClear();
    extensionRegistry.findExtensionEntry.mockReturnValueOnce({
      manifest: { id: 'system-settings', name: 'Settings panels', packageType: 'system' },
    });
    extensionRegistry.listExtensionInstallSummaries.mockReturnValueOnce([
      { id: 'system-settings', status: 'enabled', enabled: true, required: true },
    ]);

    await expect(getExtensionHostClient().setEnabled({ extensionId: 'system-settings', enabled: false })).resolves.toEqual({
      ok: false,
      status: 400,
      error: 'Cannot disable system-settings: this extension is required by the application.',
    });
    expect(extensionRegistry.setExtensionEnabled).not.toHaveBeenCalledWith('system-settings', false);
  });

  it('allows enablement for extensions with stale compatibility metadata', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.setExtensionEnabled.mockClear();
    extensionRegistry.findExtensionEntry.mockReturnValueOnce({
      manifest: {
        id: 'old-extension',
        name: 'Old Extension',
        compatibility: { neonPilot: '>=0.10.0 <0.11.0' },
      },
    });
    extensionRegistry.listExtensionInstallSummaries
      .mockReturnValueOnce([{ id: 'old-extension', status: 'disabled' }])
      .mockReturnValueOnce([{ id: 'old-extension', status: 'disabled' }])
      .mockReturnValueOnce([{ id: 'old-extension', status: 'enabled', enabled: true }]);
    extensionSubscriptions.installSubscriptionsForExtension.mockResolvedValueOnce(undefined);
    extensionServices.startServicesForExtension.mockResolvedValueOnce([]);

    await expect(getExtensionHostClient().setEnabled({ extensionId: 'old-extension', enabled: true })).resolves.toEqual({
      ok: true,
      extension: { id: 'old-extension', status: 'enabled', enabled: true },
    });
    expect(extensionRegistry.setExtensionEnabled).toHaveBeenCalledWith('old-extension', true, expect.any(String), undefined);
  });

  it('does not reject enablement for system extensions with stale compatibility metadata', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.setExtensionEnabled.mockClear();
    extensionSubscriptions.installSubscriptionsForExtension.mockClear();
    extensionServices.startServicesForExtension.mockClear();
    extensionRegistry.findExtensionEntry.mockReturnValueOnce({
      manifest: {
        id: 'system-onboarding',
        name: 'Onboarding',
        packageType: 'system',
        compatibility: { neonPilot: '>=0.10.0 <0.11.0' },
      },
    });
    extensionRegistry.listExtensionInstallSummaries
      .mockReturnValueOnce([{ id: 'system-onboarding', status: 'disabled' }])
      .mockReturnValueOnce([{ id: 'system-onboarding', status: 'disabled' }])
      .mockReturnValueOnce([{ id: 'system-onboarding', status: 'enabled', enabled: true }]);
    extensionSubscriptions.installSubscriptionsForExtension.mockResolvedValueOnce(undefined);
    extensionServices.startServicesForExtension.mockResolvedValueOnce([]);

    await expect(getExtensionHostClient().setEnabled({ extensionId: 'system-onboarding', enabled: true })).resolves.toEqual({
      ok: true,
      extension: { id: 'system-onboarding', status: 'enabled', enabled: true },
    });
    expect(extensionRegistry.setExtensionEnabled).toHaveBeenCalledWith('system-onboarding', true, expect.any(String), undefined);
  });

  it('routes keybinding updates through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());

    await expect(
      getExtensionHostClient().setKeybinding({
        extensionId: 'ext',
        keybindingId: 'open',
        command: 'ext.open',
        when: 'workspace.open',
        keys: ['Meta+O'],
        enabled: true,
      }),
    ).resolves.toBeUndefined();

    expect(extensionRegistry.setExtensionKeybinding).toHaveBeenCalledWith({
      extensionId: 'ext',
      keybindingId: 'open',
      command: 'ext.open',
      when: 'workspace.open',
      keys: ['Meta+O'],
      enabled: true,
    });
  });

  it('forwards stateRoot and layout from request to setExtensionKeybinding', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });

    await expect(
      getExtensionHostClient().setKeybinding({
        extensionId: 'ext',
        keybindingId: 'open',
        command: 'ext.open',
        keys: ['Meta+O'],
        stateRoot: '/custom/state/root',
        layout,
      }),
    ).resolves.toBeUndefined();

    expect(extensionRegistry.setExtensionKeybinding).toHaveBeenCalledWith({
      extensionId: 'ext',
      keybindingId: 'open',
      command: 'ext.open',
      keys: ['Meta+O'],
      stateRoot: '/custom/state/root',
      layout,
    });
  });

  it('omits stateRoot and layout from setExtensionKeybinding when request omits them', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());

    await expect(
      getExtensionHostClient().setKeybinding({
        extensionId: 'ext',
        keybindingId: 'close',
        reset: true,
      }),
    ).resolves.toBeUndefined();

    const lastCallArg = extensionRegistry.setExtensionKeybinding.mock.calls.at(-1)?.[0];
    expect(lastCallArg).toEqual({
      extensionId: 'ext',
      keybindingId: 'close',
      reset: true,
    });
    expect(lastCallArg).not.toHaveProperty('stateRoot');
    expect(lastCallArg).not.toHaveProperty('layout');
  });

  it('routes model profile resolution through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.resolveExtensionModelProfile.mockReturnValueOnce({ kind: 'resolved', profile: { extensionId: 'ext', id: 'gpt' } });

    await expect(getExtensionHostClient().resolveModelProfile({ provider: 'openai', model: 'gpt-5' })).resolves.toEqual({
      kind: 'resolved',
      profile: { extensionId: 'ext', id: 'gpt' },
    });
    expect(extensionRegistry.resolveExtensionModelProfile).toHaveBeenCalledWith(
      { provider: 'openai', model: 'gpt-5' },
      expect.any(String),
      undefined,
    );
  });

  it('threads DesktopRootLayout from serverContextSnapshot through resolveModelProfile', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionRegistry.resolveExtensionModelProfile.mockReturnValueOnce({
      kind: 'resolved',
      profile: { extensionId: 'ext', id: 'layout-gpt' },
    });

    await expect(
      getExtensionHostClient().resolveModelProfile({
        provider: 'openai',
        model: 'gpt-5',
        serverContextSnapshot: { runtimeScope: 'shared', stateRoot: '/tmp/neon-pilot-state', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({
      kind: 'resolved',
      profile: { extensionId: 'ext', id: 'layout-gpt' },
    });

    expect(extensionRegistry.resolveExtensionModelProfile).toHaveBeenCalledWith(
      { provider: 'openai', model: 'gpt-5' },
      '/tmp/neon-pilot-state',
      layout,
    );
  });

  it('threads DesktopRootLayout from serverContextSnapshot through resolveFilePath', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionRegistry.findExtensionEntry.mockReturnValueOnce({ packageRoot: '/extensions/ext' });

    await expect(
      getExtensionHostClient().resolveFilePath({
        extensionId: 'ext',
        relativePath: 'dist/frontend.js',
        serverContextSnapshot: { runtimeScope: 'shared', stateRoot: '/tmp/neon-pilot-state', desktopRootLayout: layout },
      }),
    ).resolves.toBe('/extensions/ext/dist/frontend.js');

    expect(extensionRegistry.findExtensionEntry).toHaveBeenCalledWith('ext', '/tmp/neon-pilot-state', layout);
  });

  it('threads DesktopRootLayout from serverContextSnapshot through resolvePromptReferences', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionRegistry.listExtensionPromptReferenceRegistrations.mockReturnValueOnce([]);

    await expect(
      getExtensionHostClient().resolvePromptReferences({
        text: 'Use @note:k1',
        serverContextSnapshot: { runtimeScope: 'shared', stateRoot: '/tmp/neon-pilot-state', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({
      contextBlocks: [],
      references: [],
    });

    expect(extensionRegistry.listExtensionPromptReferenceRegistrations).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
  });

  it('routes extension file path resolution through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.findExtensionEntry.mockReturnValueOnce({ packageRoot: '/extensions/ext' });

    await expect(getExtensionHostClient().resolveFilePath({ extensionId: 'ext', relativePath: 'dist/frontend.js' })).resolves.toBe(
      '/extensions/ext/dist/frontend.js',
    );
    extensionRegistry.findExtensionEntry.mockReturnValueOnce({ packageRoot: '/extensions/ext' });
    await expect(getExtensionHostClient().resolveFilePath({ extensionId: 'ext', relativePath: '../escape.js' })).rejects.toThrow(
      'Extension file path escapes package root.',
    );
  });

  it('routes prompt reference resolution through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.listExtensionPromptReferenceRegistrations.mockReturnValueOnce([
      { extensionId: 'ext', id: 'resolver', handler: 'resolveReferences' },
    ]);
    extensionBackend.invokeExtensionAction.mockResolvedValueOnce({
      ok: true,
      result: {
        contextBlocks: ['From string', { content: 'From object' }, { content: ' ' }],
        references: [
          { kind: 'knowledgeFile', id: 'k1', path: '/knowledge/k1.md' },
          { kind: 1, id: 'bad' },
        ],
      },
    });

    await expect(getExtensionHostClient().resolvePromptReferences({ text: 'Use @note:k1' })).resolves.toEqual({
      contextBlocks: ['From string', 'From object'],
      references: [{ kind: 'knowledgeFile', id: 'k1', path: '/knowledge/k1.md' }],
    });

    expect(extensionRegistry.listExtensionPromptReferenceRegistrations).toHaveBeenCalled();
    expect(extensionBackend.invokeExtensionAction).toHaveBeenCalledWith('ext', 'resolveReferences', {
      text: 'Use @note:k1',
      mentionIds: expect.any(Array),
    });
  });

  it('routes extension state operations through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionStorage.listExtensionState.mockReturnValueOnce([{ key: 'tasks/one', value: { title: 'Ship' }, version: 1 }]);
    extensionStorage.readExtensionState.mockReturnValueOnce({ key: 'tasks/one', value: { title: 'Ship' }, version: 1 });
    extensionStorage.writeExtensionState.mockReturnValueOnce({ key: 'tasks/one', value: { title: 'Done' }, version: 2 });
    extensionStorage.deleteExtensionState.mockReturnValueOnce({ ok: true, deleted: true });

    await expect(getExtensionHostClient().stateOperation({ operation: 'list', extensionId: 'ext', prefix: 'tasks/' })).resolves.toEqual({
      operation: 'list',
      documents: [{ key: 'tasks/one', value: { title: 'Ship' }, version: 1 }],
    });
    await expect(getExtensionHostClient().stateOperation({ operation: 'read', extensionId: 'ext', key: 'tasks/one' })).resolves.toEqual({
      operation: 'read',
      document: { key: 'tasks/one', value: { title: 'Ship' }, version: 1 },
    });
    await expect(
      getExtensionHostClient().stateOperation({
        operation: 'write',
        extensionId: 'ext',
        key: 'tasks/one',
        value: { title: 'Done' },
        expectedVersion: 1,
      }),
    ).resolves.toEqual({
      operation: 'write',
      document: { key: 'tasks/one', value: { title: 'Done' }, version: 2 },
    });
    await expect(getExtensionHostClient().stateOperation({ operation: 'delete', extensionId: 'ext', key: 'tasks/one' })).resolves.toEqual({
      operation: 'delete',
      deleted: true,
    });

    expect(extensionStorage.listExtensionState).toHaveBeenCalledWith('ext', 'tasks/', undefined);
    expect(extensionStorage.readExtensionState).toHaveBeenCalledWith('ext', 'tasks/one', undefined);
    expect(extensionStorage.writeExtensionState).toHaveBeenCalledWith(
      'ext',
      'tasks/one',
      { title: 'Done' },
      { expectedVersion: 1 },
      undefined,
    );
    expect(extensionStorage.deleteExtensionState).toHaveBeenCalledWith('ext', 'tasks/one', undefined);
  });

  it('threads DesktopRootLayout from serverContextSnapshot to extension storage functions', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionStorage.listExtensionState.mockReturnValueOnce([{ key: 'k1', value: 'v1', version: 1 }]);
    extensionStorage.readExtensionState.mockReturnValueOnce({ key: 'k1', value: 'v1', version: 1 });
    extensionStorage.writeExtensionState.mockReturnValueOnce({ key: 'k1', value: 'v2', version: 2 });
    extensionStorage.deleteExtensionState.mockReturnValueOnce({ ok: true, deleted: true });

    await expect(
      getExtensionHostClient().stateOperation({
        operation: 'list',
        extensionId: 'ext',
        prefix: 'tasks/',
        serverContextSnapshot: { runtimeScope: 'shared', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({
      operation: 'list',
      documents: [{ key: 'k1', value: 'v1', version: 1 }],
    });
    expect(extensionStorage.listExtensionState).toHaveBeenCalledWith('ext', 'tasks/', layout);

    await expect(
      getExtensionHostClient().stateOperation({
        operation: 'read',
        extensionId: 'ext',
        key: 'k1',
        serverContextSnapshot: { runtimeScope: 'shared', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({
      operation: 'read',
      document: { key: 'k1', value: 'v1', version: 1 },
    });
    expect(extensionStorage.readExtensionState).toHaveBeenCalledWith('ext', 'k1', layout);

    await expect(
      getExtensionHostClient().stateOperation({
        operation: 'write',
        extensionId: 'ext',
        key: 'k1',
        value: 'v2',
        serverContextSnapshot: { runtimeScope: 'shared', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({
      operation: 'write',
      document: { key: 'k1', value: 'v2', version: 2 },
    });
    expect(extensionStorage.writeExtensionState).toHaveBeenCalledWith('ext', 'k1', 'v2', { expectedVersion: undefined }, layout);

    await expect(
      getExtensionHostClient().stateOperation({
        operation: 'delete',
        extensionId: 'ext',
        key: 'k1',
        serverContextSnapshot: { runtimeScope: 'shared', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({
      operation: 'delete',
      deleted: true,
    });
    expect(extensionStorage.deleteExtensionState).toHaveBeenCalledWith('ext', 'k1', layout);
  });

  it('routes registry maintenance through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());

    await expect(getExtensionHostClient().registryMaintenance({ operation: 'invalidateReadCaches' })).resolves.toBeUndefined();
    await expect(
      getExtensionHostClient().registryMaintenance({ operation: 'clearBuildError', extensionId: 'ext' }),
    ).resolves.toBeUndefined();
    await expect(
      getExtensionHostClient().registryMaintenance({ operation: 'setBuildError', extensionId: 'ext', error: 'Build failed' }),
    ).resolves.toBeUndefined();

    expect(extensionRegistry.invalidateExtensionRegistryReadCaches).toHaveBeenCalled();
    expect(extensionRegistry.clearBuildError).toHaveBeenCalledWith('ext');
    expect(extensionRegistry.setBuildError).toHaveBeenCalledWith('ext', 'Build failed');
  });

  it('routes startup guard lifecycle through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.beginExtensionStartupGuard.mockReturnValueOnce({ safeMode: true, disabledIds: ['ext'] });

    await expect(getExtensionHostClient().beginStartupGuard()).resolves.toEqual({ safeMode: true, disabledIds: ['ext'] });
    await expect(getExtensionHostClient().completeStartupGuard()).resolves.toBeUndefined();

    expect(extensionRegistry.beginExtensionStartupGuard).toHaveBeenCalled();
    expect(extensionRegistry.completeExtensionStartupGuard).toHaveBeenCalled();
  });

  it('threads stateRoot and DesktopRootLayout from serverContextSnapshot through beginStartupGuard', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    extensionRegistry.beginExtensionStartupGuard.mockReturnValueOnce({ safeMode: false, disabledIds: [] });

    await expect(
      getExtensionHostClient().beginStartupGuard({
        serverContextSnapshot: { runtimeScope: 'shared', stateRoot: '/tmp/neon-pilot-state', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({ safeMode: false, disabledIds: [] });

    expect(extensionRegistry.beginExtensionStartupGuard).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
  });

  it('threads stateRoot and DesktopRootLayout from serverContextSnapshot through completeStartupGuard', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });

    await expect(
      getExtensionHostClient().completeStartupGuard({
        serverContextSnapshot: { runtimeScope: 'shared', stateRoot: '/tmp/neon-pilot-state', desktopRootLayout: layout },
      }),
    ).resolves.toBeUndefined();

    expect(extensionRegistry.completeExtensionStartupGuard).toHaveBeenCalledWith('/tmp/neon-pilot-state', layout);
  });

  it('falls back to default stateRoot when serverContextSnapshot has no stateRoot in beginStartupGuard', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionRegistry.beginExtensionStartupGuard.mockReturnValueOnce({ safeMode: false, disabledIds: [] });

    await expect(
      getExtensionHostClient().beginStartupGuard({
        serverContextSnapshot: { runtimeScope: 'shared' },
      }),
    ).resolves.toEqual({ safeMode: false, disabledIds: [] });

    expect(extensionRegistry.beginExtensionStartupGuard).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  it('routes backend health checks through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.checkEnabledExtensionBackendHealth.mockResolvedValueOnce([{ extensionId: 'ext', ok: true }]);

    await expect(getExtensionHostClient().checkBackendHealth()).resolves.toEqual([{ extensionId: 'ext', ok: true }]);

    expect(extensionBackend.checkEnabledExtensionBackendHealth).toHaveBeenCalledWith();
  });

  it('routes extension backend routes through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.invokeExtensionRoute.mockResolvedValueOnce({ status: 201, body: { ok: true } });

    await expect(
      getExtensionHostClient().invokeRoute({
        extensionId: 'ext',
        method: 'POST',
        routePath: '/do-thing',
        request: { method: 'POST', path: '/do-thing', query: {}, params: {}, body: { x: 1 } },
        serverContext: { getRuntimeScope: () => 'shared' },
      }),
    ).resolves.toEqual({ status: 201, body: { ok: true } });

    expect(extensionBackend.invokeExtensionRoute).toHaveBeenCalledWith(
      'ext',
      'POST',
      '/do-thing',
      { method: 'POST', path: '/do-thing', query: {}, params: {}, body: { x: 1 } },
      { getRuntimeScope: expect.any(Function) },
    );
  });

  it('routes telemetry, self-test, and reload operations through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.listExtensionActionTelemetry.mockReturnValueOnce([{ extensionId: 'ext', actionId: 'run', ok: true }]);
    extensionBackend.runExtensionSelfTest.mockResolvedValueOnce({
      ok: true,
      extensionId: 'ext',
      checks: [{ name: 'backend import', ok: true }],
    });
    extensionBackend.reloadExtensionBackend.mockResolvedValueOnce({ ok: true, extensionId: 'ext', rebuilt: false });

    await expect(getExtensionHostClient().listActionTelemetry('ext')).resolves.toEqual([{ extensionId: 'ext', actionId: 'run', ok: true }]);
    await expect(getExtensionHostClient().runSelfTest({ extensionId: 'ext' })).resolves.toEqual({
      ok: true,
      extensionId: 'ext',
      checks: [{ name: 'backend import', ok: true }],
    });
    await expect(getExtensionHostClient().reloadBackend({ extensionId: 'ext' })).resolves.toEqual({
      ok: true,
      extensionId: 'ext',
      rebuilt: false,
    });

    expect(extensionBackend.listExtensionActionTelemetry).toHaveBeenCalledWith('ext');
    expect(extensionBackend.runExtensionSelfTest).toHaveBeenCalledWith('ext');
    expect(extensionBackend.reloadExtensionBackend).toHaveBeenCalledWith('ext', undefined);
  });

  it('threads serverContextSnapshot through to reloadExtensionBackend', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.reloadExtensionBackend.mockResolvedValueOnce({ ok: true, extensionId: 'ext', rebuilt: false });

    const layout = resolveDesktopRootLayout({ root: '/tmp/neon-pilot-layout' });
    await expect(
      getExtensionHostClient().reloadBackend({
        extensionId: 'ext',
        serverContextSnapshot: { runtimeScope: 'shared', stateRoot: '/tmp/neon-pilot-state', desktopRootLayout: layout },
      }),
    ).resolves.toEqual({
      ok: true,
      extensionId: 'ext',
      rebuilt: false,
    });

    expect(extensionBackend.reloadExtensionBackend).toHaveBeenCalledWith(
      'ext',
      expect.objectContaining({
        getRuntimeScope: expect.any(Function),
        getStateRoot: expect.any(Function),
        getDesktopRootLayout: expect.any(Function),
      }),
    );
  });

  it('routes startup actions through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.startExtensionStartupActions.mockResolvedValueOnce([{ extensionId: 'ext', ok: true }]);

    await expect(getExtensionHostClient().startStartupActions({ serverContext: { getRuntimeScope: () => 'shared' } })).resolves.toEqual([
      { extensionId: 'ext', ok: true },
    ]);

    expect(extensionBackend.startExtensionStartupActions).toHaveBeenCalledWith({ getRuntimeScope: expect.any(Function) });
  });

  it('routes protocol entrypoints through the extension host request envelope', async () => {
    setExtensionHostClient(createInProcessExtensionHostClient());
    extensionBackend.invokeExtensionProtocolEntrypoint.mockResolvedValueOnce(undefined);
    const signal = new AbortController().signal;
    const stdio = { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr };

    await expect(
      getExtensionHostClient().invokeProtocolEntrypoint({
        protocolId: 'acp',
        input: { args: ['--stdio'] },
        serverContext: { getRuntimeScope: () => 'shared' },
        stdio,
        signal,
      }),
    ).resolves.toBeUndefined();

    expect(extensionBackend.invokeExtensionProtocolEntrypoint).toHaveBeenCalledWith(
      'acp',
      { args: ['--stdio'] },
      {
        serverContext: { getRuntimeScope: expect.any(Function) },
        stdio,
        signal,
      },
    );
  });

  it('names requests for logs and future RPC diagnostics', () => {
    expect(extensionHostRequestName({ type: 'health' })).toBe('health');
    expect(extensionHostRequestName({ type: 'invokeAction', extensionId: 'ext', actionId: 'doThing', input: null })).toBe(
      'invokeAction:ext/doThing',
    );
    expect(
      extensionHostRequestName({
        type: 'invokeProtocolEntrypoint',
        protocolId: 'acp',
        input: null,
        stdio: { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr },
        signal: new AbortController().signal,
      }),
    ).toBe('invokeProtocolEntrypoint:acp');
    expect(extensionHostRequestName({ type: 'checkBackendHealth' })).toBe('checkBackendHealth');
    expect(extensionHostRequestName({ type: 'beginStartupGuard' })).toBe('beginStartupGuard');
    expect(extensionHostRequestName({ type: 'completeStartupGuard' })).toBe('completeStartupGuard');
    expect(extensionHostRequestName({ type: 'startStartupActions' })).toBe('startStartupActions');
    expect(
      extensionHostRequestName({
        type: 'invokeRoute',
        extensionId: 'ext',
        method: 'GET',
        routePath: '/status',
        request: { method: 'GET', path: '/status', query: {}, params: {} },
      }),
    ).toBe('invokeRoute:ext:GET:/status');
    expect(extensionHostRequestName({ type: 'listActionTelemetry', extensionId: 'ext' })).toBe('listActionTelemetry');
    expect(extensionHostRequestName({ type: 'listAuditEvents' })).toBe('listAuditEvents');
    expect(extensionHostRequestName({ type: 'runSelfTest', extensionId: 'ext' })).toBe('runSelfTest:ext');
    expect(extensionHostRequestName({ type: 'reloadBackend', extensionId: 'ext' })).toBe('reloadBackend:ext');
    expect(extensionHostRequestName({ type: 'setKeybinding', extensionId: 'ext', keybindingId: 'open' })).toBe('setKeybinding:ext/open');
    expect(extensionHostRequestName({ type: 'setEnabled', extensionId: 'ext', enabled: true })).toBe('setEnabled:ext:enable');
    expect(extensionHostRequestName({ type: 'publishEvent', source: 'settings', payload: null })).toBe('publishEvent:settings');
    expect(extensionHostRequestName({ type: 'installSubscriptions', extensionId: 'ext' })).toBe('installSubscriptions:ext');
    expect(extensionHostRequestName({ type: 'uninstallSubscriptions', extensionId: 'ext' })).toBe('uninstallSubscriptions:ext');
    expect(extensionHostRequestName({ type: 'listServices' })).toBe('listServices');
    expect(extensionHostRequestName({ type: 'startServices' })).toBe('startServices');
    expect(extensionHostRequestName({ type: 'stopServices', extensionId: 'ext' })).toBe('stopServices:ext');
    expect(extensionHostRequestName({ type: 'listPromptAssemblyContributions' })).toBe('listPromptAssemblyContributions');
    expect(extensionHostRequestName({ type: 'listStaticContributions' })).toBe('listStaticContributions');
    expect(extensionHostRequestName({ type: 'listEventSubscriptions' })).toBe('listEventSubscriptions');
    expect(extensionHostRequestName({ type: 'stateOperation', operation: 'list', extensionId: 'ext' })).toBe('stateOperation:list:ext');
    expect(extensionHostRequestName({ type: 'registryMaintenance', operation: 'invalidateReadCaches' })).toBe(
      'registryMaintenance:invalidateReadCaches',
    );
    expect(extensionHostRequestName({ type: 'readRegistryPresentation' })).toBe('readRegistryPresentation');
    expect(extensionHostRequestName({ type: 'resolveFilePath', extensionId: 'ext', relativePath: 'dist/frontend.js' })).toBe(
      'resolveFilePath:ext/dist/frontend.js',
    );
    expect(extensionHostRequestName({ type: 'resolveModelProfile', provider: 'openai', model: 'gpt-5' })).toBe(
      'resolveModelProfile:openai/gpt-5',
    );
    expect(extensionHostRequestName({ type: 'resolvePromptReferences', text: '@note:k1' })).toBe('resolvePromptReferences');
  });
});
