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
  reloadExtensionBackend: vi.fn(),
  runExtensionSelfTest: vi.fn(),
  snapshotRuntimeExtension: vi.fn(),
  updateCatalogExtension: vi.fn(),
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
    extensions: { setEnabled: vi.fn() },
  } as unknown as ExtensionBackendContext;
}

describe('system-extension-manager backend', () => {
  let mod: typeof import('./backend.js');

  beforeEach(async () => {
    vi.resetModules();
    for (const mock of Object.values(extensionBackendApi)) mock.mockReset();
    extensionBackendApi.runExtensionSelfTest.mockResolvedValue({ ok: true, checks: [] });
    extensionBackendApi.invalidateExtensionRegistryReadCaches.mockResolvedValue(undefined);
    mod = await import('./backend.js');
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
});
