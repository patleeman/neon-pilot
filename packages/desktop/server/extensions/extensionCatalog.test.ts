import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const summaries = vi.fn(() => []);
const findExtensionEntry = vi.fn(() => undefined);
const importRuntimeExtensionBundle = vi.fn();

vi.mock('./extensionRegistry.js', () => ({
  listExtensionInstallSummaries: summaries,
  findExtensionEntry,
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
    importRuntimeExtensionBundle.mockReset();
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
    expect(catalog.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system-browser',
          installed: true,
          enabled: true,
          bundleUrl: `https://github.com/patleeman/neon-pilot/releases/download/v${version}/system-browser.neon-extension.zip`,
        }),
        expect.objectContaining({ id: 'system-speechmike', installed: false }),
      ]),
    );
  });

  it('rejects non-GitHub bundle URLs before downloading', async () => {
    const { installExtensionBundleFromUrl } = await import('./extensionCatalog.js');
    await expect(installExtensionBundleFromUrl({ url: 'https://example.com/system-browser.neon-extension.zip' })).rejects.toThrow(
      'Only github.com extension bundle URLs are supported',
    );
  });

  it('refuses to install a catalog item that is already installed', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { id: 'system-browser' } });
    const { installCatalogExtension } = await import('./extensionCatalog.js');
    await expect(installCatalogExtension({ id: 'system-browser' })).rejects.toThrow('already installed');
  });
});
