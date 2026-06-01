import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const summaries = vi.fn(() => []);
const findExtensionEntry = vi.fn(() => undefined);
const setExtensionEnabled = vi.fn();
const importRuntimeExtensionBundle = vi.fn();

vi.mock('./extensionRegistry.js', () => ({
  listExtensionInstallSummaries: summaries,
  findExtensionEntry,
  setExtensionEnabled,
}));
vi.mock('./extensionLifecycle.js', () => ({
  importRuntimeExtensionBundle,
}));

describe('extension catalog', () => {
  const originalRepoRoot = process.env.NEON_PILOT_REPO_ROOT;

  afterEach(() => {
    vi.restoreAllMocks();
    summaries.mockReset().mockReturnValue([]);
    findExtensionEntry.mockReset().mockReturnValue(undefined);
    setExtensionEnabled.mockReset();
    importRuntimeExtensionBundle.mockReset();
    vi.unstubAllGlobals();
    if (originalRepoRoot === undefined) delete process.env.NEON_PILOT_REPO_ROOT;
    else process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
  });

  it('lists first-party installable bundles for the installed version tag', async () => {
    process.env.NEON_PILOT_REPO_ROOT = join(process.cwd());
    summaries.mockReturnValue([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.1.0' }]);

    const { listInstallableExtensionCatalog, resolveInstalledAppVersion } = await import('./extensionCatalog.js');
    const version = resolveInstalledAppVersion();
    const catalog = listInstallableExtensionCatalog();

    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(catalog.tag).toBe(`v${version}`);
    expect(catalog.marketplaceSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'codex',
          ecosystem: 'codex',
          supportedPackageTypes: expect.arrayContaining(['skill', 'instruction-pack', 'agent']),
        }),
        expect.objectContaining({
          id: 'claude',
          ecosystem: 'claude',
          supportedPackageTypes: expect.arrayContaining(['skill', 'instruction-pack', 'agent']),
        }),
      ]),
    );
    expect(catalog.packages).toBe(catalog.extensions);
    expect(catalog.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system-browser',
          packageType: 'extension',
          ecosystem: 'neon-pilot',
          marketplaceSourceId: 'neon-pilot-release',
          installed: true,
          enabled: true,
          bundleUrl: `https://github.com/patleeman/neon-pilot/releases/download/v${version}/system-browser.neon-extension.zip`,
        }),
        expect.objectContaining({
          id: 'system-suggested-context',
          installed: false,
          bundleUrl: `https://github.com/patleeman/neon-pilot/releases/download/v${version}/system-suggested-context.neon-extension.zip`,
        }),
        expect.objectContaining({
          id: 'system-ds4',
          installed: false,
          bundleUrl: `https://github.com/patleeman/neon-pilot/releases/download/v${version}/system-ds4.neon-extension.zip`,
        }),
      ]),
    );
  });

  it('keeps the generated catalog in sync with installable extension manifests', async () => {
    const installableRoot = join(process.cwd(), 'installable-extensions');
    const manifestIds = existsSync(installableRoot)
      ? readdirSync(installableRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((name) => existsSync(join(installableRoot, name, 'extension.json')))
          .sort((left, right) => left.localeCompare(right))
      : [];

    const { listInstallableExtensionCatalog } = await import('./extensionCatalog.js');
    expect(listInstallableExtensionCatalog().extensions.map((extension) => extension.id)).toEqual(manifestIds);
  });

  it('rejects non-GitHub bundle URLs before downloading', async () => {
    const { installExtensionBundleFromUrl } = await import('./extensionCatalog.js');
    await expect(installExtensionBundleFromUrl({ url: 'https://example.com/system-browser.neon-extension.zip' })).rejects.toThrow(
      'Only github.com extension bundle URLs are supported',
    );
  });

  it('installs downloaded bundles disabled by default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-length': '4' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      })),
    );
    importRuntimeExtensionBundle.mockReturnValue({ ok: true, extension: { id: 'system-browser', enabled: true }, packageRoot: '/tmp/ext' });
    summaries.mockReturnValue([{ id: 'system-browser', name: 'Browser', enabled: false, version: '1.0.0' }]);

    const { installExtensionBundleFromUrl } = await import('./extensionCatalog.js');
    const result = await installExtensionBundleFromUrl({
      url: 'https://github.com/patleeman/neon-pilot/releases/download/v1.0.0/system-browser.neon-extension.zip',
      expectedId: 'system-browser',
    });

    expect(setExtensionEnabled).toHaveBeenCalledWith('system-browser', false, undefined);
    expect(result.extension).toMatchObject({ id: 'system-browser', enabled: false });
  });

  it('refuses to install a catalog item that is already installed', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { id: 'system-browser' } });
    const { installCatalogExtension } = await import('./extensionCatalog.js');
    await expect(installCatalogExtension({ id: 'system-browser' })).rejects.toThrow('already installed');
  });
});
