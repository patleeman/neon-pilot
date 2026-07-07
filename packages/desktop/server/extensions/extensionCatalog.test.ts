import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

const summaries = vi.fn(() => []);
const findExtensionEntry = vi.fn(() => undefined);
const setExtensionEnabled = vi.fn();
const importRuntimeExtensionBundle = vi.fn();
const inspectRuntimeExtensionBundle = vi.fn();
const deleteRuntimeExtension = vi.fn();

vi.mock('./extensionRegistry.js', () => ({
  listExtensionInstallSummaries: summaries,
  findExtensionEntry,
  setExtensionEnabled,
}));
vi.mock('./extensionLifecycle.js', () => ({
  importRuntimeExtensionBundle,
  inspectRuntimeExtensionBundle,
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
    inspectRuntimeExtensionBundle.mockReset().mockReturnValue({ id: 'system-browser', name: 'Browser' });
    deleteRuntimeExtension.mockReset();
    vi.unstubAllGlobals();
    if (originalRepoRoot === undefined) delete process.env.NEON_PILOT_REPO_ROOT;
    else process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
  });

  it('lists first-party installable bundles for the published package tag', async () => {
    process.env.NEON_PILOT_REPO_ROOT = join(process.cwd());
    summaries.mockReturnValue([
      { id: 'system-browser', name: 'Browser', enabled: true, version: '0.1.0', packageType: 'system' },
      { id: 'system-suggested-context', name: 'Suggested Context', enabled: true, version: '0.0.1', packageType: 'user' },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          packages: [
            { id: 'system-browser', tag: 'v0.10.2', artifact: 'system-browser.neon-extension.zip' },
            {
              id: 'system-suggested-context',
              tag: 'v0.10.2',
              artifact: 'system-suggested-context.neon-extension.zip',
              permissions: ['conversations:read', 'browser:write'],
            },
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
          id: 'system-suggested-context',
          installed: true,
          enabled: true,
          installedVersion: '0.0.1',
          updateAvailable: true,
          permissions: ['conversations:read', 'browser:control'],
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
    expect(catalog.extensions.some((extension) => extension.id === 'system-browser')).toBe(false);
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

  it('keeps locally packaged installable bundles when the release catalog omits them', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'np-local-release-bundles-'));
    const bundleDir = join(repoRoot, 'dist', 'installable-extensions');
    const bundlePath = join(bundleDir, 'system-suggested-context.neon-extension.zip');
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(bundlePath, new Uint8Array([1, 2, 3, 4]));
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          packages: [{ id: 'system-browser', tag: 'v0.10.2', artifact: 'system-browser.neon-extension.zip' }],
        }),
      })),
    );
    inspectRuntimeExtensionBundle.mockReturnValue({ id: 'system-suggested-context', name: 'Suggested Context' });
    importRuntimeExtensionBundle.mockReturnValue({
      ok: true,
      extension: { id: 'system-suggested-context', enabled: false },
      packageRoot: '/tmp/ext',
    });

    const { installCatalogExtension, listInstallableExtensionCatalog } = await import('./extensionCatalog.js');
    const catalog = await listInstallableExtensionCatalog();
    expect(catalog.extensions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'system-suggested-context' })]));

    await expect(installCatalogExtension({ id: 'system-suggested-context' })).resolves.toMatchObject({
      extension: { id: 'system-suggested-context', enabled: false },
    });

    expect(importRuntimeExtensionBundle).toHaveBeenCalledWith({ zipPath: bundlePath }, undefined, undefined);
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('uses remote first-party release catalog version metadata for update detection', async () => {
    summaries.mockReturnValue([
      { id: 'system-suggested-context', name: 'Suggested Context', enabled: true, version: '0.1.0', packageType: 'user' },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          packages: [
            {
              id: 'system-suggested-context',
              version: '0.2.0',
              tag: 'v0.10.2',
              artifact: 'system-suggested-context.neon-extension.zip',
            },
          ],
        }),
      })),
    );

    const { listInstallableExtensionCatalog } = await import('./extensionCatalog.js');
    const catalog = await listInstallableExtensionCatalog();

    expect(catalog.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system-suggested-context',
          version: '0.2.0',
          availableVersion: '0.2.0',
          installedVersion: '0.1.0',
          updateAvailable: true,
          bundleUrl:
            'https://github.com/patleeman/neon-pilot-extensions/releases/download/v0.10.2/system-suggested-context.neon-extension.zip',
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
          id: 'system-agent-browser',
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
    expect(catalog.extensions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'system-agent-browser' })]));
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
    await expect(installCatalogExtension({ id: 'system-agent-browser' })).rejects.toThrow('is not installable');
  });

  it('installs stale baked first-party catalog entries from local packaged bundles', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'np-local-stale-bundles-'));
    const bundleDir = join(repoRoot, 'dist', 'installable-extensions');
    const bundlePath = join(bundleDir, 'system-suggested-context.neon-extension.zip');
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
      extension: { id: 'system-suggested-context', enabled: true },
      packageRoot: '/tmp/ext',
    });
    inspectRuntimeExtensionBundle.mockReturnValue({ id: 'system-suggested-context', name: 'Suggested Context' });
    summaries.mockReturnValue([{ id: 'system-suggested-context', name: 'Suggested Context', enabled: false, version: '0.1.0' }]);

    const { installCatalogExtension } = await import('./extensionCatalog.js');
    const result = await installCatalogExtension({ id: 'system-suggested-context' });

    expect(importRuntimeExtensionBundle).toHaveBeenCalledWith({ zipPath: bundlePath }, undefined, undefined);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.extension).toMatchObject({ id: 'system-suggested-context', enabled: false });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('rejects local catalog bundles with mismatched ids before importing', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'np-local-mismatched-bundles-'));
    const bundleDir = join(repoRoot, 'dist', 'installable-extensions');
    const bundlePath = join(bundleDir, 'system-suggested-context.neon-extension.zip');
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
    inspectRuntimeExtensionBundle.mockReturnValue({ id: 'wrong-extension', name: 'Wrong Extension' });

    const { installCatalogExtension } = await import('./extensionCatalog.js');
    await expect(installCatalogExtension({ id: 'system-suggested-context' })).rejects.toThrow(
      'Extension id wrong-extension did not match expected id system-suggested-context.',
    );

    expect(inspectRuntimeExtensionBundle).toHaveBeenCalledWith({ zipPath: bundlePath });
    expect(importRuntimeExtensionBundle).not.toHaveBeenCalled();
    expect(setExtensionEnabled).not.toHaveBeenCalled();
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
          packages: [
            {
              id: 'example-search',
              name: 'Example Search',
              description: 'Search from a custom repo.',
              version: '0.2.0',
              permissions: ['network:read', 'shell:exec', 'unknown:permission'],
            },
          ],
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
          permissions: ['network:read', 'shell:execute'],
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

    expect(setExtensionEnabled).toHaveBeenCalledWith('system-browser', false, undefined, undefined);
    expect(result.extension).toMatchObject({ id: 'system-browser', enabled: false });
  });

  it('refuses to install a catalog item that is already installed', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { id: 'system-agent-browser' } });
    const { installCatalogExtension } = await import('./extensionCatalog.js');
    await expect(installCatalogExtension({ id: 'system-agent-browser' })).rejects.toThrow('already installed');
  });

  it('installs fresh remote catalog extensions from URL instead of stale repo-built bundles', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'np-local-bundles-'));
    const bundleDir = join(repoRoot, 'dist', 'installable-extensions');
    const bundlePath = join(bundleDir, 'system-alleycat.neon-extension.zip');
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(bundlePath, new Uint8Array([1, 2, 3, 4]));
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) =>
        String(url).endsWith('/neon-extension-catalog.json')
          ? {
              ok: true,
              json: async () => ({
                packages: [{ id: 'system-alleycat', tag: 'v0.10.2', artifact: 'system-alleycat.neon-extension.zip' }],
              }),
            }
          : {
              ok: true,
              headers: new Headers({ 'content-length': '4' }),
              arrayBuffer: async () => new Uint8Array([5, 6, 7, 8]).buffer,
            },
      ),
    );
    importRuntimeExtensionBundle.mockReturnValue({
      ok: true,
      extension: { id: 'system-alleycat', enabled: true },
      packageRoot: '/tmp/ext',
    });
    inspectRuntimeExtensionBundle.mockReturnValue({ id: 'system-alleycat', name: 'Alleycat' });
    summaries.mockReturnValue([{ id: 'system-alleycat', name: 'Alleycat', enabled: false, version: '0.1.0' }]);

    const { installCatalogExtension } = await import('./extensionCatalog.js');
    const result = await installCatalogExtension({ id: 'system-alleycat' });

    expect(importRuntimeExtensionBundle).toHaveBeenCalledTimes(1);
    expect(importRuntimeExtensionBundle).not.toHaveBeenCalledWith({ zipPath: bundlePath }, undefined);
    expect(fetch).toHaveBeenCalledTimes(2);
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

  it('refuses catalog updates with mismatched bundle ids before deleting the installed extension', async () => {
    summaries.mockReturnValue([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.0.1', packageType: 'user' }]);
    inspectRuntimeExtensionBundle.mockReturnValue({ id: 'wrong-extension', name: 'Wrong Extension' });
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
    await expect(updateCatalogExtension({ id: 'system-browser' })).rejects.toThrow(
      'Downloaded extension id wrong-extension did not match expected id system-browser.',
    );

    expect(deleteRuntimeExtension).not.toHaveBeenCalled();
    expect(importRuntimeExtensionBundle).not.toHaveBeenCalled();
    expect(setExtensionEnabled).not.toHaveBeenCalled();
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
    inspectRuntimeExtensionBundle.mockReturnValue({ id: 'system-writing-studio', name: 'Writing Studio' });
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
    expect(deleteRuntimeExtension).toHaveBeenCalledWith('system-writing-studio', undefined, undefined);
    expect(importRuntimeExtensionBundle).toHaveBeenCalled();
  });

  it('updates catalog extensions and preserves the enabled state', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'np-local-update-bundles-'));
    const bundleDir = join(repoRoot, 'dist', 'installable-extensions');
    const bundlePath = join(bundleDir, 'system-browser.neon-extension.zip');
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(bundlePath, new Uint8Array([1, 2, 3, 4]));
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;
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
    inspectRuntimeExtensionBundle.mockReturnValue({ id: 'system-browser', name: 'Browser' });
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

    expect(deleteRuntimeExtension).toHaveBeenCalledWith('system-browser', undefined, undefined);
    expect(importRuntimeExtensionBundle).not.toHaveBeenCalledWith({ zipPath: bundlePath }, undefined, undefined);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(setExtensionEnabled).toHaveBeenLastCalledWith('system-browser', true, undefined, undefined);
    expect(result).toMatchObject({ ok: true, updated: true, extension: { id: 'system-browser', enabled: true, version: '0.1.0' } });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('reads catalog sources from layout.systemConfig/settings.json when a layout is provided', async () => {
    const layoutRoot = mkdtempSync(join(tmpdir(), 'np-layout-sources-'));
    const layout = resolveDesktopRootLayout({ root: layoutRoot });
    mkdirSync(layout.systemConfig, { recursive: true });
    writeFileSync(
      join(layout.systemConfig, 'settings.json'),
      JSON.stringify({
        'extensions.sources': [{ id: 'layout-source', owner: 'layout-owner', repo: 'layout-extensions', enabled: true }],
      }),
    );

    const { readConfiguredExtensionCatalogSources } = await import('./extensionCatalog.js');
    const sources = readConfiguredExtensionCatalogSources(undefined, layout);

    expect(sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'layout-source', owner: 'layout-owner', repo: 'layout-extensions' })]),
    );
    rmSync(layoutRoot, { recursive: true, force: true });
  });

  it('falls back to stateRoot/settings.json when layout is not provided for source reads', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-legacy-sources-'));
    writeFileSync(
      join(stateRoot, 'settings.json'),
      JSON.stringify({
        'extensions.sources': [{ id: 'legacy-source', owner: 'legacy', repo: 'extensions', enabled: true }],
      }),
    );

    const { readConfiguredExtensionCatalogSources } = await import('./extensionCatalog.js');
    const sources = readConfiguredExtensionCatalogSources(stateRoot);

    expect(sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'legacy-source', owner: 'legacy', repo: 'extensions' })]),
    );
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('threads layout to registry calls during installExtensionBundleFromUrl', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-length': '4' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      })),
    );
    importRuntimeExtensionBundle.mockReturnValue({
      ok: true,
      extension: { id: 'system-browser', enabled: true },
      packageRoot: '/tmp/ext',
    });
    summaries.mockReturnValue([{ id: 'system-browser', name: 'Browser', enabled: false, version: '1.0.0' }]);

    const layoutRoot = mkdtempSync(join(tmpdir(), 'np-threading-'));
    const layout = resolveDesktopRootLayout({ root: layoutRoot });

    const { installExtensionBundleFromUrl } = await import('./extensionCatalog.js');

    await installExtensionBundleFromUrl(
      {
        url: 'https://github.com/patleeman/neon-pilot-extensions/releases/download/v1.0.0/system-browser.neon-extension.zip',
        expectedId: 'system-browser',
      },
      undefined,
      layout,
    );

    expect(importRuntimeExtensionBundle).toHaveBeenCalledWith(
      { zipPath: expect.stringContaining('system-browser.neon-extension.zip') },
      undefined,
      layout,
    );
    expect(setExtensionEnabled).toHaveBeenCalledWith('system-browser', false, undefined, layout);
    expect(summaries).toHaveBeenCalledWith(undefined, layout);
    rmSync(layoutRoot, { recursive: true, force: true });
  });

  it('threads layout to registry calls during updateCatalogExtension', async () => {
    summaries.mockReturnValue([{ id: 'system-browser', name: 'Browser', enabled: true, version: '0.0.1', packageType: 'user' }]);
    deleteRuntimeExtension.mockResolvedValue({ ok: true, extensionId: 'system-browser', deleted: true });
    importRuntimeExtensionBundle.mockReturnValue({
      ok: true,
      extension: { id: 'system-browser', enabled: false },
      packageRoot: '/tmp/ext',
    });
    inspectRuntimeExtensionBundle.mockReturnValue({ id: 'system-browser', name: 'Browser' });
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

    const layoutRoot = mkdtempSync(join(tmpdir(), 'np-update-threading-'));
    const layout = resolveDesktopRootLayout({ root: layoutRoot });

    const { updateCatalogExtension } = await import('./extensionCatalog.js');

    await updateCatalogExtension({ id: 'system-browser' }, undefined, layout);

    expect(deleteRuntimeExtension).toHaveBeenCalledWith('system-browser', undefined, layout);
    expect(importRuntimeExtensionBundle).toHaveBeenCalledWith(
      { zipPath: expect.stringContaining('system-browser.neon-extension.zip') },
      undefined,
      layout,
    );
    expect(setExtensionEnabled).toHaveBeenCalledWith('system-browser', true, undefined, layout);
    rmSync(layoutRoot, { recursive: true, force: true });
  });
});
