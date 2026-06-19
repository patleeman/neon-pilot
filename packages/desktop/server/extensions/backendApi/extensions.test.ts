import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolverMocks = vi.hoisted(() => ({
  importServerExtensionModule: vi.fn(),
  importServerModule: vi.fn(),
  installPackageSource: vi.fn(),
}));

vi.mock('./serverModuleResolver.js', () => ({
  importServerExtensionModule: resolverMocks.importServerExtensionModule,
  importServerModule: resolverMocks.importServerModule,
}));

describe('backendApi/extensions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resolverMocks.installPackageSource.mockReturnValue({
      installed: true,
      alreadyPresent: false,
      source: '/packages/codex-review',
      target: 'local',
      settingsPath: '/profile/settings.json',
    });
    resolverMocks.importServerModule.mockResolvedValue({
      installPackageSource: resolverMocks.installPackageSource,
    });
  });

  it('routes runtime extension lifecycle operations to extensionLifecycle', async () => {
    const api = await import('./extensions.js');
    const lifecycle = {
      buildRuntimeExtension: vi.fn().mockResolvedValue({ ok: true, action: 'build' }),
      createRuntimeExtension: vi.fn().mockResolvedValue({ id: 'runtime-extension' }),
      snapshotRuntimeExtension: vi.fn().mockResolvedValue({ files: [] }),
    };
    resolverMocks.importServerExtensionModule.mockResolvedValue(lifecycle);

    await expect(api.buildRuntimeExtension('ext-1')).resolves.toEqual({ ok: true, action: 'build' });
    await expect(api.createRuntimeExtension({ id: 'ext-1' } as never)).resolves.toEqual({ id: 'runtime-extension' });
    await expect(api.snapshotRuntimeExtension('ext-1')).resolves.toEqual({ files: [] });

    expect(resolverMocks.importServerExtensionModule).toHaveBeenCalledWith('../extensionLifecycle.js');
    expect(lifecycle.buildRuntimeExtension).toHaveBeenCalledWith('ext-1');
    expect(lifecycle.createRuntimeExtension).toHaveBeenCalledWith({ id: 'ext-1' });
    expect(lifecycle.snapshotRuntimeExtension).toHaveBeenCalledWith('ext-1');
  });

  it('routes backend reloads, package validation, and install summaries to owning modules', async () => {
    const api = await import('./extensions.js');
    const backend = {
      reloadExtensionBackend: vi.fn().mockResolvedValue({ reloaded: true }),
      runExtensionSelfTest: vi.fn().mockResolvedValue({ ok: true, extensionId: 'ext-1', checks: [] }),
    };
    const doctor = { validateExtensionPackage: vi.fn().mockResolvedValue({ valid: true }) };
    const registry = {
      invalidateExtensionRegistryReadCaches: vi.fn(),
      listExtensionInstallSummaries: vi.fn().mockResolvedValue([{ id: 'ext-1' }]),
    };
    resolverMocks.importServerExtensionModule.mockImplementation(async (specifier: string) => {
      if (specifier === '../extensionBackend.js') return backend;
      if (specifier === '../extensionDoctor.js') return doctor;
      if (specifier === '../extensionRegistry.js') return registry;
      throw new Error(`unexpected specifier ${specifier}`);
    });

    await expect(api.reloadExtensionBackend('ext-1')).resolves.toEqual({ reloaded: true });
    await expect(api.runExtensionSelfTest('ext-1')).resolves.toEqual({ ok: true, extensionId: 'ext-1', checks: [] });
    await expect(api.invalidateExtensionRegistryReadCaches()).resolves.toEqual({ ok: true });
    await expect(api.validateExtensionPackage({ packagePath: '/tmp/ext' } as never)).resolves.toEqual({ valid: true });
    await expect(api.listExtensionInstallSummaries()).resolves.toEqual([{ id: 'ext-1' }]);

    expect(backend.reloadExtensionBackend).toHaveBeenCalledWith('ext-1');
    expect(backend.runExtensionSelfTest).toHaveBeenCalledWith('ext-1');
    expect(registry.invalidateExtensionRegistryReadCaches).toHaveBeenCalledWith();
    expect(doctor.validateExtensionPackage).toHaveBeenCalledWith({ packagePath: '/tmp/ext' });
    expect(registry.listExtensionInstallSummaries).toHaveBeenCalledWith();
  });

  it('routes catalog lifecycle operations to the extension catalog module', async () => {
    const api = await import('./extensions.js');
    const catalog = {
      listInstallableExtensionCatalog: vi.fn().mockResolvedValue({ ok: true, extensions: [] }),
      installCatalogExtension: vi.fn().mockResolvedValue({ ok: true, extension: { id: 'system-browser' } }),
      updateCatalogExtension: vi.fn().mockResolvedValue({ ok: true, updated: true, extension: { id: 'system-browser' } }),
      installExtensionBundleFromUrl: vi.fn().mockResolvedValue({ ok: true, extension: { id: 'system-browser' } }),
    };
    resolverMocks.importServerExtensionModule.mockResolvedValue(catalog);

    await expect(api.listInstallableExtensionCatalog()).resolves.toEqual({ ok: true, extensions: [] });
    await expect(api.installCatalogExtension({ id: 'system-browser' })).resolves.toEqual({
      ok: true,
      extension: { id: 'system-browser' },
    });
    await expect(api.updateCatalogExtension({ id: 'system-browser' })).resolves.toEqual({
      ok: true,
      updated: true,
      extension: { id: 'system-browser' },
    });
    await expect(
      api.installExtensionBundleFromUrl({
        url: 'https://github.com/patleeman/neon-pilot-extensions/releases/download/v1/system-browser.neon-extension.zip',
      }),
    ).resolves.toEqual({ ok: true, extension: { id: 'system-browser' } });

    expect(resolverMocks.importServerExtensionModule).toHaveBeenCalledWith('../extensionCatalog.js');
    expect(catalog.installCatalogExtension).toHaveBeenCalledWith({ id: 'system-browser' });
    expect(catalog.updateCatalogExtension).toHaveBeenCalledWith({ id: 'system-browser' });
  });

  it('installs marketplace behavior package sources through core', async () => {
    const { installMarketplacePackageSource } = await import('./extensions.js');

    await expect(
      installMarketplacePackageSource({
        source: ' ./codex-review ',
        sourceBaseDir: '/packages',
      }),
    ).resolves.toEqual({
      installed: true,
      alreadyPresent: false,
      source: '/packages/codex-review',
      target: 'local',
      settingsPath: '/profile/settings.json',
    });

    expect(resolverMocks.importServerModule).toHaveBeenCalledWith('@neon-pilot/core');
    expect(resolverMocks.installPackageSource).toHaveBeenCalledWith({
      source: './codex-review',
      sourceBaseDir: '/packages',
      target: 'local',
    });
  });

  it('rejects unknown package install targets', async () => {
    const { installMarketplacePackageSource } = await import('./extensions.js');

    await expect(installMarketplacePackageSource({ source: '/packages/review', target: 'workspace' })).rejects.toThrow(
      'marketplace package target must be local',
    );
  });

  it('installs marketplace packages as managed extension wrappers', async () => {
    const { installMarketplacePackageAsExtension } = await import('./extensions.js');
    const sourceRoot = mkdtempSync(join(tmpdir(), 'np-marketplace-source-'));
    const runtimeDir = mkdtempSync(join(tmpdir(), 'np-marketplace-runtime-'));
    mkdirSync(join(sourceRoot, 'skills', 'review-code'), { recursive: true });
    writeFileSync(join(sourceRoot, 'skills', 'review-code', 'SKILL.md'), '---\nname: review-code\n---\n');
    resolverMocks.installPackageSource.mockReturnValueOnce({
      installed: true,
      alreadyPresent: false,
      source: sourceRoot,
      target: 'local',
      settingsPath: '/profile/settings.json',
    });

    const result = await installMarketplacePackageAsExtension({
      ecosystem: 'codex',
      packageType: 'skill',
      source: sourceRoot,
      runtimeDir,
    });

    expect(result).toMatchObject({
      installed: true,
      alreadyPresent: false,
      source: sourceRoot,
      target: 'local',
      extension: { skillCount: 1, copiedSource: true },
    });
    expect(result.extension.id).toContain('imported-codex-skill');
    expect(existsSync(join(result.extension.packageRoot, 'extension.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(result.extension.packageRoot, 'extension.json'), 'utf-8'))).toMatchObject({
      importedPackage: { ecosystem: 'codex', packageType: 'skill', source: sourceRoot, copiedSource: true },
      contributes: { skills: [{ id: 'review-code', path: 'package/skills/review-code/SKILL.md' }] },
    });
    expect(resolverMocks.installPackageSource).toHaveBeenCalledWith({
      source: sourceRoot,
      sourceBaseDir: undefined,
      target: 'local',
    });
  });

  it('records remote marketplace packages as managed extension wrappers without copied skills', async () => {
    const { installMarketplacePackageAsExtension } = await import('./extensions.js');
    const runtimeDir = mkdtempSync(join(tmpdir(), 'np-marketplace-runtime-remote-'));
    resolverMocks.installPackageSource.mockReturnValueOnce({
      installed: true,
      alreadyPresent: false,
      source: 'https://example.com/package.git',
      target: 'local',
      settingsPath: '/profile/settings.json',
    });

    const result = await installMarketplacePackageAsExtension({
      ecosystem: 'claude',
      packageType: 'instruction-pack',
      source: 'https://example.com/package.git',
      runtimeDir,
    });

    expect(result).toMatchObject({
      extension: { skillCount: 0, copiedSource: false },
    });
    const manifest = JSON.parse(readFileSync(join(result.extension.packageRoot, 'extension.json'), 'utf-8')) as {
      importedPackage?: { source: string; copiedSource: boolean };
      contributes?: { skills?: unknown[] };
    };
    expect(manifest.importedPackage).toMatchObject({ source: 'https://example.com/package.git', copiedSource: false });
    expect(manifest.contributes?.skills).toBeUndefined();
  });

  it('rejects symlinks when wrapping local marketplace packages as extensions', async () => {
    const { installMarketplacePackageAsExtension } = await import('./extensions.js');
    const sourceRoot = mkdtempSync(join(tmpdir(), 'np-marketplace-source-symlink-'));
    const runtimeDir = mkdtempSync(join(tmpdir(), 'np-marketplace-runtime-'));
    const targetRoot = mkdtempSync(join(tmpdir(), 'np-marketplace-target-'));
    symlinkSync(targetRoot, join(sourceRoot, 'linked-target'));
    resolverMocks.installPackageSource.mockReturnValueOnce({
      installed: true,
      alreadyPresent: false,
      source: sourceRoot,
      target: 'local',
      settingsPath: '/profile/settings.json',
    });

    await expect(
      installMarketplacePackageAsExtension({
        ecosystem: 'codex',
        packageType: 'skill',
        source: sourceRoot,
        runtimeDir,
      }),
    ).rejects.toThrow('Imported package source cannot contain symlinks');
  });

  it('writes additional extension search paths to profile and state-root settings files', async () => {
    const { writeAdditionalExtensionSearchPaths } = await import('./extensions.js');
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-ext-search-paths-'));
    const runtimeDir = join(stateRoot, 'neon-pilot-runtime');
    const runtimeSettingsFilePath = join(runtimeDir, 'settings.json');

    await expect(
      writeAdditionalExtensionSearchPaths({
        runtimeDir,
        runtimeSettingsFilePath,
        paths: ['/extensions/one', '/extensions/two'],
      }),
    ).resolves.toEqual({ ok: true });

    expect(JSON.parse(readFileSync(runtimeSettingsFilePath, 'utf-8'))).toEqual({
      'extensions.additionalPaths': '/extensions/one\n/extensions/two',
    });
    expect(JSON.parse(readFileSync(join(runtimeDir, 'settings.json'), 'utf-8'))).toEqual({
      'extensions.additionalPaths': '/extensions/one\n/extensions/two',
    });
    expect(JSON.parse(readFileSync(join(stateRoot, 'settings.json'), 'utf-8'))).toEqual({
      'extensions.additionalPaths': '/extensions/one\n/extensions/two',
    });
  });

  it('writes extension catalog sources to profile and state-root settings files', async () => {
    const { writeExtensionCatalogSources } = await import('./extensions.js');
    const stateRoot = mkdtempSync(join(tmpdir(), 'np-ext-sources-'));
    const runtimeDir = join(stateRoot, 'neon-pilot-runtime');
    const runtimeSettingsFilePath = join(runtimeDir, 'settings.json');
    const sources = [{ id: 'example', type: 'github', owner: 'example', repo: 'extensions', enabled: true }];

    await expect(
      writeExtensionCatalogSources({
        runtimeDir,
        runtimeSettingsFilePath,
        sources,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(JSON.parse(readFileSync(runtimeSettingsFilePath, 'utf-8'))).toMatchObject({ 'extensions.sources': sources });
    expect(JSON.parse(readFileSync(join(runtimeDir, 'settings.json'), 'utf-8'))).toMatchObject({ 'extensions.sources': sources });
    expect(JSON.parse(readFileSync(join(stateRoot, 'settings.json'), 'utf-8'))).toMatchObject({ 'extensions.sources': sources });
  });

  it('refuses to derive extension settings from a root-level runtime directory', async () => {
    const { writeAdditionalExtensionSearchPaths } = await import('./extensions.js');

    await expect(
      writeAdditionalExtensionSearchPaths({
        runtimeDir: '/neon-pilot-runtime',
        runtimeSettingsFilePath: '/neon-pilot-runtime/settings.json',
        paths: ['/extensions/one'],
      }),
    ).rejects.toThrow('Refusing to resolve extension settings from root runtime directory');
  });
});
