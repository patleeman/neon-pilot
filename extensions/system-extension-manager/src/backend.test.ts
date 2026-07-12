import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const extensionBackendApi = vi.hoisted(() => ({
  createRuntimeExtension: vi.fn(),
  deleteRuntimeExtension: vi.fn(),
  installCatalogExtension: vi.fn(),
  installExtensionBundleFromUrl: vi.fn(),
  invalidateExtensionRegistryReadCaches: vi.fn(),
  listExtensionInstallSummaries: vi.fn(),
  listInstallableExtensionCatalog: vi.fn(),
  readExtensionCatalogSources: vi.fn(),
  readRuntimeExtensionSource: vi.fn(),
  reloadExtensionBackend: vi.fn(),
  runExtensionSelfTest: vi.fn(),
  snapshotRuntimeExtension: vi.fn(),
  updateCatalogExtension: vi.fn(),
  updateRuntimeExtension: vi.fn(),
  validateExtensionPackage: vi.fn(),
  writeAdditionalExtensionSearchPaths: vi.fn(),
  writeExtensionCatalogSources: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/extensions', () => extensionBackendApi);
vi.mock('@neon-pilot/extensions/host-view-components', () => ({ HOST_VIEW_COMPONENT_DEFINITIONS: [] }));

function createBackendContext(): ExtensionBackendContext {
  return {
    runtimeDir: '/runtime',
    runtimeSettingsFilePath: '/runtime/settings.json',
    runtime: { getDesktopRootLayout: vi.fn(() => ({ root: '/desktop-root' })), invalidateExtensionRegistry: vi.fn() },
    ui: { invalidate: vi.fn() },
    extensions: { setEnabled: vi.fn(), setPermissionGranted: vi.fn() },
  } as unknown as ExtensionBackendContext;
}

describe('system-extension-manager backend', () => {
  let mod: typeof import('./backend.js');

  beforeEach(async () => {
    vi.resetModules();
    for (const mock of Object.values(extensionBackendApi)) mock.mockReset();
    extensionBackendApi.createRuntimeExtension.mockReturnValue({
      ok: true,
      extensionId: 'created-app',
      packageRoot: '/runtime/extensions/created-app',
    });
    extensionBackendApi.runExtensionSelfTest.mockResolvedValue({ ok: true, checks: [] });
    extensionBackendApi.invalidateExtensionRegistryReadCaches.mockResolvedValue(undefined);
    mod = await import('./backend.js');
  });

  it('passes direct create action appearance metadata to runtime extension creation', async () => {
    const ctx = createBackendContext();
    const result = await mod.createExtension(
      {
        id: 'styled-app',
        name: 'Styled App',
        description: 'A styled app.',
        template: 'route-shell',
        appearance: {
          accent: 'drawing',
          aliases: ['whiteboard', 'sketchpad'],
          singleton: false,
          window: { defaultWidth: 800, defaultHeight: 600 },
        },
      },
      ctx,
    );

    expect(result).toMatchObject({ ok: true, extensionId: 'created-app' });
    expect(extensionBackendApi.createRuntimeExtension).toHaveBeenCalledWith(
      {
        id: 'styled-app',
        name: 'Styled App',
        description: 'A styled app.',
        template: 'route-shell',
        appearance: {
          accent: 'drawing',
          aliases: ['whiteboard', 'sketchpad'],
          singleton: false,
          window: { defaultWidth: 800, defaultHeight: 600 },
        },
      },
      { desktopRootLayout: { root: '/desktop-root' } },
    );
    expect(ctx.runtime.invalidateExtensionRegistry).toHaveBeenCalledOnce();
    expect(ctx.ui.invalidate).toHaveBeenCalledWith('extensions');
  });

  it('normalizes CLI create appearance flags for app registry metadata', async () => {
    await mod.manageExtension(
      {
        cli: {
          command: 'extensions create',
          args: ['kanban-board'],
          flags: {
            name: 'Kanban Board',
            description: 'Personal project board',
            template: 'main-page',
            accent: 'apps',
            aliases: 'kanban, projects',
            singleton: 'false',
            'window-width': '960',
            windowHeight: '720',
          },
        },
      },
      createBackendContext(),
    );

    expect(extensionBackendApi.createRuntimeExtension).toHaveBeenCalledWith(
      {
        id: 'kanban-board',
        name: 'Kanban Board',
        description: 'Personal project board',
        template: 'main-page',
        appearance: {
          accent: 'apps',
          aliases: ['kanban', 'projects'],
          singleton: false,
          window: { defaultWidth: 960, defaultHeight: 720 },
        },
      },
      { desktopRootLayout: { root: '/desktop-root' } },
    );
  });

  it('uses app-package copy for smoke check results while preserving extension ids', async () => {
    extensionBackendApi.runExtensionSelfTest.mockResolvedValueOnce({ ok: true, checks: [{ id: 'manifest', ok: true }] });

    await expect(mod.smokeExtension({ extensionId: 'system-browser' }, createBackendContext())).resolves.toEqual({
      ok: true,
      extensionId: 'system-browser',
      checks: [{ id: 'manifest', ok: true }],
      text: 'App package system-browser smoke checks passed.',
    });

    extensionBackendApi.runExtensionSelfTest.mockResolvedValueOnce({ ok: false, checks: [{ id: 'manifest', ok: false }] });

    await expect(mod.smokeExtension({ extensionId: 'broken-app' }, createBackendContext())).resolves.toMatchObject({
      ok: false,
      extensionId: 'broken-app',
      text: 'App package broken-app smoke checks failed.',
    });
  });

  it('uses app-package copy for enablement and reload results', async () => {
    const ctx = createBackendContext();

    await expect(mod.manageExtension({ action: 'enable', extensionId: 'system-browser' }, ctx)).resolves.toEqual({
      ok: true,
      extensionId: 'system-browser',
      enabled: true,
      text: 'Enabled app package system-browser.',
    });
    expect(ctx.extensions?.setEnabled).toHaveBeenCalledWith('system-browser', true);

    await expect(mod.manageExtension({ action: 'disable', extensionId: 'system-browser' }, ctx)).resolves.toEqual({
      ok: true,
      extensionId: 'system-browser',
      enabled: false,
      text: 'Disabled app package system-browser.',
    });
    expect(ctx.extensions?.setEnabled).toHaveBeenCalledWith('system-browser', false);

    await expect(mod.reloadExtensions({}, ctx)).resolves.toEqual({
      ok: true,
      reloaded: true,
      message: 'App package registry caches were invalidated; reopen app pages if needed.',
    });
  });

  it('toggles a declared extension permission through the manageExtension action', async () => {
    const ctx = createBackendContext();

    const result = await mod.manageExtension(
      { action: 'togglePermission', extensionId: 'system-browser', permission: 'agent:run', granted: false },
      ctx,
    );

    expect(result).toEqual({
      ok: true,
      extensionId: 'system-browser',
      permission: 'agent:run',
      granted: false,
      text: 'Revoked permission agent:run for app package system-browser.',
    });
    expect(ctx.extensions?.setPermissionGranted).toHaveBeenCalledWith('system-browser', 'agent:run', false);
  });

  it('grants a previously-revoked permission through the manageExtension action', async () => {
    const ctx = createBackendContext();

    const result = await mod.manageExtension(
      { action: 'togglePermission', extensionId: 'system-browser', permission: 'agent:run', granted: true },
      ctx,
    );

    expect(result).toEqual({
      ok: true,
      extensionId: 'system-browser',
      permission: 'agent:run',
      granted: true,
      text: 'Granted permission agent:run for app package system-browser.',
    });
    expect(ctx.extensions?.setPermissionGranted).toHaveBeenCalledWith('system-browser', 'agent:run', true);
  });

  it('throws when togglePermission is called without a permission string', async () => {
    const ctx = createBackendContext();

    await expect(mod.manageExtension({ action: 'togglePermission', extensionId: 'system-browser', granted: true }, ctx)).rejects.toThrow(
      'permission is required.',
    );
    expect(ctx.extensions?.setPermissionGranted).not.toHaveBeenCalled();
  });

  it('forwards async errors from setPermissionGranted', async () => {
    const ctx = createBackendContext();
    vi.mocked(ctx.extensions!.setPermissionGranted).mockRejectedValue(
      new Error('Cannot revoke permission agent:run from system-settings: this extension is required.'),
    );

    await expect(
      mod.manageExtension({ action: 'togglePermission', extensionId: 'system-settings', permission: 'agent:run', granted: false }, ctx),
    ).rejects.toThrow('Cannot revoke permission agent:run from system-settings: this extension is required.');
    expect(ctx.extensions?.setPermissionGranted).toHaveBeenCalledWith('system-settings', 'agent:run', false);
  });

  it('forwards name and description through the update action to updateRuntimeExtension', async () => {
    extensionBackendApi.updateRuntimeExtension.mockResolvedValue({
      ok: true,
      extension: { id: 'my-app', name: 'Updated App' },
      packageRoot: '/runtime/extensions/my-app',
    });

    const result = await mod.manageExtension(
      { action: 'update', extensionId: 'my-app', name: 'Updated App', description: 'A new description' },
      createBackendContext(),
    );

    expect(result).toMatchObject({ ok: true, extension: { id: 'my-app', name: 'Updated App' } });
    expect(extensionBackendApi.updateRuntimeExtension).toHaveBeenCalledWith(
      'my-app',
      {
        name: 'Updated App',
        description: 'A new description',
        appearance: undefined,
        source: undefined,
      },
      { desktopRootLayout: { root: '/desktop-root' } },
    );
  });

  it('rejects readSource manageExtension action without extension id', async () => {
    await expect(mod.manageExtension({ action: 'readSource' }, createBackendContext())).rejects.toThrow('extension id is required.');
    expect(extensionBackendApi.readRuntimeExtensionSource).not.toHaveBeenCalled();
  });

  it('reads source through the manageExtension readSource action', async () => {
    extensionBackendApi.readRuntimeExtensionSource.mockResolvedValue({
      extensionId: 'my-app',
      manifest: { id: 'my-app', name: 'My App', packageType: 'user' },
      source: { frontend: '// frontend code', backend: '// backend code' },
    });

    const result = await mod.manageExtension({ action: 'readSource', extensionId: 'my-app' }, createBackendContext());

    expect(result).toMatchObject({
      ok: true,
      extensionId: 'my-app',
      manifest: { id: 'my-app' },
      source: { frontend: '// frontend code', backend: '// backend code' },
    });
    expect(extensionBackendApi.readRuntimeExtensionSource).toHaveBeenCalledWith('my-app', { desktopRootLayout: { root: '/desktop-root' } });
  });

  it('reads source through the direct readExtensionSource handler', async () => {
    extensionBackendApi.readRuntimeExtensionSource.mockResolvedValue({
      extensionId: 'direct-app',
      manifest: { id: 'direct-app', name: 'Direct' },
      source: { frontend: '// a' },
    });

    const result = await mod.readExtensionSource({ extensionId: 'direct-app' }, createBackendContext());

    expect(result).toMatchObject({
      ok: true,
      extensionId: 'direct-app',
      manifest: { id: 'direct-app' },
      source: { frontend: '// a' },
    });
    expect(extensionBackendApi.readRuntimeExtensionSource).toHaveBeenCalledWith('direct-app', {
      desktopRootLayout: { root: '/desktop-root' },
    });
  });

  it('forwards source code changes through the update action', async () => {
    extensionBackendApi.updateRuntimeExtension.mockResolvedValue({
      ok: true,
      extension: { id: 'my-app' },
      packageRoot: '/runtime/extensions/my-app',
    });

    const result = await mod.updateExtension(
      {
        extensionId: 'my-app',
        source: { frontend: '// new frontend', backend: '// new backend' },
      },
      createBackendContext(),
    );

    expect(result).toMatchObject({ ok: true });
    expect(extensionBackendApi.updateRuntimeExtension).toHaveBeenCalledWith(
      'my-app',
      expect.objectContaining({
        source: { frontend: '// new frontend', backend: '// new backend' },
      }),
      { desktopRootLayout: { root: '/desktop-root' } },
    );
  });
});
