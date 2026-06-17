import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const summaries = vi.fn(() => []);
const findExtensionEntry = vi.fn(() => undefined);
const setExtensionEnabled = vi.fn();
const importRuntimeExtensionBundle = vi.fn();
const deleteRuntimeExtension = vi.fn();

vi.mock('./extensionRegistry.js', () => ({
  listExtensionInstallSummaries: summaries,
  findExtensionEntry,
  setExtensionEnabled,
}));
vi.mock('./extensionLifecycle.js', () => ({
  importRuntimeExtensionBundle,
  deleteRuntimeExtension,
}));

describe('extension catalog', () => {
  const originalRepoRoot = process.env.NEON_PILOT_REPO_ROOT;
  afterEach(() => {
    vi.restoreAllMocks();
    summaries.mockReset().mockReturnValue([]);
    findExtensionEntry.mockReset().mockReturnValue(undefined);
    setExtensionEnabled.mockReset();
    importRuntimeExtensionBundle.mockReset();
    deleteRuntimeExtension.mockReset();
    vi.unstubAllGlobals();
    if (originalRepoRoot === undefined) delete process.env.NEON_PILOT_REPO_ROOT;
    else process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
  });

  it('lists first-party installable bundles for the published package tag', async () => {
    process.env.NEON_PILOT_REPO_ROOT = join(process.cwd());
    summaries.mockReturnValue([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.0.1' }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          packages: [
            { id: 'system-browser', tag: 'v0.10.2', artifact: 'system-browser.neon-extension.zip' },
            { id: 'system-suggested-context', tag: 'v0.10.2', artifact: 'system-suggested-context.neon-extension.zip' },
            { id: 'system-ds4', tag: 'v0.10.2', artifact: 'system-ds4.neon-extension.zip' },
            { id: 'system-auto-router', tag: 'v0.10.2', artifact: 'system-auto-router.neon-extension.zip' },
          ],
        }),
      })),
    );

    const { listInstallableExtensionCatalog, resolveInstalledAppVersion } = await import('./extensionCatalog.js');
    const version = resolveInstalledAppVersion();
    const catalog = await listInstallableExtensionCatalog();

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
          version: '0.1.0',
          installedVersion: '0.0.1',
          updateAvailable: true,
          bundleUrl: 'https://github.com/patleeman/neon-pilot-extensions/releases/download/v0.10.2/system-browser.neon-extension.zip',
        }),
        expect.objectContaining({
          id: 'system-suggested-context',
          installed: false,
          updateAvailable: false,
          bundleUrl:
            'https://github.com/patleeman/neon-pilot-extensions/releases/download/v0.10.2/system-suggested-context.neon-extension.zip',
        }),
        expect.objectContaining({
          id: 'system-ds4',
          installed: false,
          bundleUrl: 'https://github.com/patleeman/neon-pilot-extensions/releases/download/v0.10.2/system-ds4.neon-extension.zip',
        }),
        expect.objectContaining({
          id: 'system-auto-router',
          name: 'Auto Router',
          installed: false,
          bundleUrl: 'https://github.com/patleeman/neon-pilot-extensions/releases/download/v0.10.2/system-auto-router.neon-extension.zip',
        }),
      ]),
    );
  });

  it('discovers first-party packages from the release catalog that are not in the baked catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          packages: [{ id: 'system-new-thing', tag: 'v0.10.2', artifact: 'system-new-thing.neon-extension.zip' }],
        }),
      })),
    );

    const { listInstallableExtensionCatalog } = await import('./extensionCatalog.js');
    const catalog = await listInstallableExtensionCatalog();

    expect(catalog.sourceErrors).toEqual([]);
    expect(catalog.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system-new-thing',
          name: 'New Thing',
          description: 'Install New Thing from the Neon Pilot extension release catalog.',
          bundleUrl: 'https://github.com/patleeman/neon-pilot-extensions/releases/download/v0.10.2/system-new-thing.neon-extension.zip',
        }),
      ]),
    );
  });

  it('uses remote first-party release catalog version metadata for update detection', async () => {
    summaries.mockReturnValue([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.1.0' }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          packages: [{ id: 'system-browser', version: '0.2.0', tag: 'v0.10.2', artifact: 'system-browser.neon-extension.zip' }],
        }),
      })),
    );

    const { listInstallableExtensionCatalog } = await import('./extensionCatalog.js');
    const catalog = await listInstallableExtensionCatalog();

    expect(catalog.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system-browser',
          version: '0.2.0',
          availableVersion: '0.2.0',
          installedVersion: '0.1.0',
          updateAvailable: true,
          bundleUrl: 'https://github.com/patleeman/neon-pilot-extensions/releases/download/v0.10.2/system-browser.neon-extension.zip',
        }),
      ]),
    );
  });

  it('falls back quietly to the baked first-party catalog when the release catalog is not published', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
      })),
    );

    const { listInstallableExtensionCatalog } = await import('./extensionCatalog.js');
    const catalog = await listInstallableExtensionCatalog();

    expect(catalog.sourceErrors).toEqual([]);
    expect(catalog.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system-browser',
          unavailableReason: expect.stringContaining('release artifact is published'),
        }),
      ]),
    );
  });

  it('reports non-404 first-party release catalog fetch failures while using the baked catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
      })),
    );

    const { listInstallableExtensionCatalog } = await import('./extensionCatalog.js');
    const catalog = await listInstallableExtensionCatalog();

    expect(catalog.sourceErrors).toEqual([
      expect.objectContaining({
        sourceId: 'neon-pilot',
        message: 'Failed to fetch first-party extension release catalog: HTTP 500',
      }),
    ]);
    expect(catalog.extensions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'system-browser' })]));
  });

  it('refuses to install stale baked first-party catalog entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
      })),
    );

    const { installCatalogExtension } = await import('./extensionCatalog.js');
    await expect(installCatalogExtension({ id: 'system-browser' })).rejects.toThrow('is not installable');
  });

  it('installs stale baked first-party catalog entries from local packaged bundles', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'np-local-stale-bundles-'));
    const bundleDir = join(repoRoot, 'dist', 'installable-extensions');
    const bundlePath = join(bundleDir, 'system-dynamic-workflows.neon-extension.zip');
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(bundlePath, new Uint8Array([1, 2, 3, 4]));
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
      })),
    );
    importRuntimeExtensionBundle.mockReturnValue({
      ok: true,
      extension: { id: 'system-dynamic-workflows', enabled: true },
      packageRoot: '/tmp/ext',
    });
    summaries.mockReturnValue([{ id: 'system-dynamic-workflows', name: 'Dynamic Workflows', enabled: false, version: '0.1.0' }]);

    const { installCatalogExtension } = await import('./extensionCatalog.js');
    const result = await installCatalogExtension({ id: 'system-dynamic-workflows' });

    expect(importRuntimeExtensionBundle).toHaveBeenCalledWith({ zipPath: bundlePath }, undefined);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.extension).toMatchObject({ id: 'system-dynamic-workflows', enabled: false });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('merges enabled GitHub extension sources from settings into the catalog', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-extension-sources-'));
    writeFileSync(
      join(stateRoot, 'settings.json'),
      JSON.stringify({
        'extensions.sources': [{ id: 'example-source', type: 'github', owner: 'example', repo: 'neon-extensions', enabled: true }],
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: url.includes('/main/'),
        status: url.includes('/main/') ? 200 : 404,
        json: async () => ({
          packages: [{ id: 'example-search', name: 'Example Search', description: 'Search from a custom repo.', version: '0.2.0' }],
        }),
      })),
    );

    const { listInstallableExtensionCatalog } = await import('./extensionCatalog.js');
    const catalog = await listInstallableExtensionCatalog(stateRoot);

    expect(catalog.marketplaceSources).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'example-source', owner: 'example', repo: 'neon-extensions' })]),
    );
    expect(catalog.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'example-search',
          version: '0.2.0',
          marketplaceSourceId: 'example-source',
          bundleUrl: 'https://github.com/example/neon-extensions/releases/download/v0.2.0/example-search.neon-extension.zip',
        }),
      ]),
    );
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('keeps the first-party extension source canonical when settings include the same repo', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-extension-sources-'));
    writeFileSync(
      join(stateRoot, 'settings.json'),
      JSON.stringify({
        'extensions.sources': [
          { id: 'custom-first-party', type: 'github', owner: 'PatLeeMan', repo: 'neon-pilot-extensions', enabled: false },
          { id: 'example-source', type: 'github', owner: 'example', repo: 'neon-extensions', enabled: true },
        ],
      }),
    );

    const { readConfiguredExtensionCatalogSources } = await import('./extensionCatalog.js');
    const sources = readConfiguredExtensionCatalogSources(stateRoot);

    expect(sources).toEqual([
      expect.objectContaining({ id: 'neon-pilot', owner: 'patleeman', repo: 'neon-pilot-extensions', enabled: true }),
      expect.objectContaining({ id: 'example-source', owner: 'example', repo: 'neon-extensions', enabled: true }),
    ]);
    rmSync(stateRoot, { recursive: true, force: true });
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
      url: 'https://github.com/patleeman/neon-pilot-extensions/releases/download/v1.0.0/system-browser.neon-extension.zip',
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

  it('installs catalog extensions from repo-built bundles when available', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'np-local-bundles-'));
    const bundleDir = join(repoRoot, 'dist', 'installable-extensions');
    const bundlePath = join(bundleDir, 'system-alleycat.neon-extension.zip');
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(bundlePath, new Uint8Array([1, 2, 3, 4]));
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          packages: [{ id: 'system-alleycat', tag: 'v0.10.2', artifact: 'system-alleycat.neon-extension.zip' }],
        }),
      })),
    );
    importRuntimeExtensionBundle.mockReturnValue({
      ok: true,
      extension: { id: 'system-alleycat', enabled: true },
      packageRoot: '/tmp/ext',
    });
    summaries.mockReturnValue([{ id: 'system-alleycat', name: 'Alleycat', enabled: false, version: '0.1.0' }]);

    const { installCatalogExtension } = await import('./extensionCatalog.js');
    const result = await installCatalogExtension({ id: 'system-alleycat' });

    expect(importRuntimeExtensionBundle).toHaveBeenCalledWith({ zipPath: bundlePath }, undefined);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.extension).toMatchObject({ id: 'system-alleycat', enabled: false });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('refuses to update a missing installed extension before deleting anything', async () => {
    summaries.mockReturnValue([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ packages: [{ id: 'system-browser', tag: 'v0.10.2', artifact: 'system-browser.neon-extension.zip' }] }),
      })),
    );

    const { updateCatalogExtension } = await import('./extensionCatalog.js');
    await expect(updateCatalogExtension({ id: 'system-browser' })).rejects.toThrow('is not installed');
    expect(deleteRuntimeExtension).not.toHaveBeenCalled();
    expect(importRuntimeExtensionBundle).not.toHaveBeenCalled();
  });

  it('refuses to update packaged system extensions before deleting anything', async () => {
    summaries.mockReturnValue([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.0.1', packageType: 'system' }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ packages: [{ id: 'system-browser', tag: 'v0.10.2', artifact: 'system-browser.neon-extension.zip' }] }),
      })),
    );

    const { updateCatalogExtension } = await import('./extensionCatalog.js');
    await expect(updateCatalogExtension({ id: 'system-browser' })).rejects.toThrow('Packaged system extensions cannot be updated');
    expect(deleteRuntimeExtension).not.toHaveBeenCalled();
    expect(importRuntimeExtensionBundle).not.toHaveBeenCalled();
  });

  it('warns about stale compatibility without blocking catalog updates', async () => {
    summaries.mockReturnValue([
      { id: 'system-writing-studio', name: 'Writing Studio', enabled: true, version: '0.1.1', packageType: 'user' },
    ]);
    deleteRuntimeExtension.mockResolvedValue({ ok: true, extensionId: 'system-writing-studio', deleted: true });
    importRuntimeExtensionBundle.mockReturnValue({
      ok: true,
      extension: { id: 'system-writing-studio', enabled: false },
      packageRoot: '/tmp/ext',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) =>
        String(url).endsWith('/neon-extension-catalog.json')
          ? {
              ok: true,
              json: async () => ({
                packages: [
                  {
                    id: 'system-writing-studio',
                    tag: 'v0.10.2',
                    artifact: 'system-writing-studio.neon-extension.zip',
                    compatibility: { neonPilot: '>=0.10.0 <0.11.0' },
                  },
                ],
              }),
            }
          : {
              ok: true,
              headers: new Headers({ 'content-length': '4' }),
              arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
            },
      ),
    );

    const { listInstallableExtensionCatalog, updateCatalogExtension } = await import('./extensionCatalog.js');
    const catalog = await listInstallableExtensionCatalog();
    const catalogItem = catalog.extensions.find((item) => item.id === 'system-writing-studio');
    expect(catalogItem).toMatchObject({
      id: 'system-writing-studio',
      compatibilityWarning: expect.stringContaining('requires Neon Pilot >=0.10.0 <0.11.0'),
    });
    expect(catalogItem).not.toHaveProperty('unavailableReason');
    await expect(updateCatalogExtension({ id: 'system-writing-studio' })).resolves.toMatchObject({
      ok: true,
      updated: true,
    });
    expect(deleteRuntimeExtension).toHaveBeenCalledWith('system-writing-studio', undefined);
    expect(importRuntimeExtensionBundle).toHaveBeenCalled();
  });

  it('updates catalog extensions and preserves the enabled state', async () => {
    summaries
      .mockReturnValueOnce([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.0.1', packageType: 'user' }])
      .mockReturnValueOnce([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.0.1', packageType: 'user' }])
      .mockReturnValueOnce([{ id: 'system-browser', name: 'Browser', enabled: false, version: '0.1.0', packageType: 'user' }])
      .mockReturnValueOnce([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.1.0', packageType: 'user' }]);
    deleteRuntimeExtension.mockResolvedValue({ ok: true, extensionId: 'system-browser', deleted: true });
    importRuntimeExtensionBundle.mockReturnValue({
      ok: true,
      extension: { id: 'system-browser', enabled: false },
      packageRoot: '/tmp/ext',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) =>
        String(url).endsWith('/neon-extension-catalog.json')
          ? {
              ok: true,
              json: async () => ({
                packages: [{ id: 'system-browser', tag: 'v0.10.2', artifact: 'system-browser.neon-extension.zip' }],
              }),
            }
          : {
              ok: true,
              headers: new Headers({ 'content-length': '4' }),
              arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
            },
      ),
    );

    const { updateCatalogExtension } = await import('./extensionCatalog.js');
    const result = await updateCatalogExtension({ id: 'system-browser' });

    expect(deleteRuntimeExtension).toHaveBeenCalledWith('system-browser', undefined);
    expect(setExtensionEnabled).toHaveBeenLastCalledWith('system-browser', true, undefined);
    expect(result).toMatchObject({ ok: true, updated: true, extension: { id: 'system-browser', enabled: true, version: '0.1.0' } });
  });
});
