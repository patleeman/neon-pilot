import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findExtensionEntry = vi.fn();
const getRuntimeExtensionsRoot = vi.fn();
const invalidateExtensionRegistryReadCaches = vi.fn();
const listExtensionInstallSummaries = vi.fn();
const parseExtensionManifest = vi.fn((manifest) => manifest);
const readInvalidRuntimeExtensionEntries = vi.fn(() => []);
const removeExtensionFromRegistry = vi.fn();
const clearExtensionFailureRecords = vi.fn();
const stopExtensionServices = vi.fn();
const unregisterBashProcessWrapper = vi.fn();
const uninstallExtensionSubscriptions = vi.fn();

vi.mock('./extensionRegistry.js', () => ({
  clearExtensionFailureRecords,
  findExtensionEntry,
  getRuntimeExtensionsRoot,
  invalidateExtensionRegistryReadCaches,
  listExtensionInstallSummaries,
  parseExtensionManifest,
  readInvalidRuntimeExtensionEntries,
  removeExtensionFromRegistry,
}));
vi.mock('./extensionServices.js', () => ({
  stopExtensionServices,
}));
vi.mock('../conversations/processWrappers.js', () => ({
  unregisterBashProcessWrapper,
}));
vi.mock('./extensionSubscriptions.js', () => ({
  uninstallExtensionSubscriptions,
}));

const reloadExtensionBackend = vi.fn().mockResolvedValue({ ok: true, extensionId: 'test', rebuilt: false });
vi.mock('./extensionBackend.js', () => ({
  reloadExtensionBackend,
}));

type ExecFileSync = typeof import('node:child_process').execFileSync;
const execFileSync = vi.fn<Parameters<ExecFileSync>, ReturnType<ExecFileSync>>();
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFileSync };
});

const {
  buildRuntimeExtension,
  createRuntimeExtension,
  deleteRuntimeExtension,
  exportRuntimeExtension,
  inspectRuntimeExtensionBundle,
  importRuntimeExtensionBundle,
  snapshotRuntimeExtension,
  updateRuntimeExtension,
} = await import('./extensionLifecycle.js');

const safeBundleZipInfo = [
  '-rw-r--r--  3.0 unx      123 tx      100 defN 26-Jun-01 00:00 bundle/extension.json',
  '-rw-r--r--  3.0 unx      123 tx      100 defN 26-Jun-01 00:00 bundle/dist/backend.mjs',
  '-rw-r--r--  3.0 unx      123 tx      100 defN 26-Jun-01 00:00 bundle/dist/build-manifest.json',
].join('\n');

describe('extensionLifecycle', () => {
  const stateRoot = join(tmpdir(), `extension-lifecycle-${randomUUID()}`);
  const runtimeRoot = join(stateRoot, 'extensions');

  beforeEach(() => {
    rmSync(stateRoot, { recursive: true, force: true });
    findExtensionEntry.mockReset().mockReturnValue(null);
    getRuntimeExtensionsRoot.mockReset().mockReturnValue(runtimeRoot);
    invalidateExtensionRegistryReadCaches.mockReset();
    listExtensionInstallSummaries.mockReset().mockReturnValue([{ id: 'my-extension', name: 'My Extension' }]);
    readInvalidRuntimeExtensionEntries.mockReset().mockReturnValue([]);
    removeExtensionFromRegistry.mockReset();
    clearExtensionFailureRecords.mockReset();
    stopExtensionServices.mockReset().mockResolvedValue(undefined);
    unregisterBashProcessWrapper.mockReset();
    uninstallExtensionSubscriptions.mockReset();
    parseExtensionManifest.mockClear();
    execFileSync.mockReset();
    execFileSync.mockImplementation((command, args) => {
      if (String(args?.[0] ?? '').includes('extension-build.mjs')) {
        return Buffer.from('Build succeeded');
      }
      if (command === 'zipinfo') return safeBundleZipInfo as ReturnType<ExecFileSync>;
      if (command === 'unzip') {
        const extractRoot = String(args?.[3]);
        mkdirSync(join(extractRoot, 'bundle', 'dist'), { recursive: true });
        writeFileSync(
          join(extractRoot, 'bundle', 'extension.json'),
          JSON.stringify({
            id: 'imported-ext',
            name: 'Imported',
            backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
          }),
        );
        writeFileSync(join(extractRoot, 'bundle', 'dist', 'backend.mjs'), 'export async function ping() {}');
        writeFileSync(join(extractRoot, 'bundle', 'dist', 'build-manifest.json'), '{}');
        return Buffer.from('');
      }
      return Buffer.from('');
    });
  });

  afterEach(() => {
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('creates a main-page runtime extension scaffold with normalized manifest and starter files', () => {
    const result = createRuntimeExtension({ id: ' my-extension ', name: ' My Extension ', description: ' Desc ' }, stateRoot);

    expect(result).toEqual({
      ok: true,
      extension: { id: 'my-extension', name: 'My Extension' },
      packageRoot: join(runtimeRoot, 'my-extension'),
    });
    const manifest = JSON.parse(readFileSync(join(runtimeRoot, 'my-extension', 'extension.json'), 'utf-8'));
    expect(manifest).toMatchObject({
      id: 'my-extension',
      name: 'My Extension',
      description: 'Desc',
      packageType: 'user',
      backend: { actions: [{ id: 'ping', worker: { enabled: true } }] },
      contributes: { views: [{ location: 'main', route: '/ext/my-extension' }], nav: [{ label: 'My Extension' }] },
    });
    const frontend = readFileSync(join(runtimeRoot, 'my-extension', 'src', 'frontend.tsx'), 'utf-8');
    expect(frontend).toContain('ExtensionPage');
    expect(frontend).toContain('AppPageLayout');
    expect(frontend).toContain('AppPageIntro');
    expect(frontend).not.toContain('text-[34px]');
    expect(readFileSync(join(runtimeRoot, 'my-extension', 'src', 'backend.ts'), 'utf-8')).toContain('export async function ping');
  });

  it('creates rightRail and workbench detail templates', () => {
    createRuntimeExtension({ id: 'right-rail-ext', name: 'Right Rail', template: 'right-rail' }, stateRoot);
    createRuntimeExtension({ id: 'workbench-ext', name: 'Workbench', template: 'workbench-detail' }, stateRoot);

    expect(JSON.parse(readFileSync(join(runtimeRoot, 'right-rail-ext', 'extension.json'), 'utf-8')).contributes.views[0]).toMatchObject({
      location: 'rightRail',
      component: 'ExtensionPanel',
    });
    const rightSidebarFrontend = readFileSync(join(runtimeRoot, 'right-rail-ext', 'src', 'frontend.tsx'), 'utf-8');
    expect(rightSidebarFrontend).toContain(
      "import { ContextRail, ContextRailBody, ContextRailHeader, ContextRailSection, ToolbarButton } from '@neon-pilot/extensions/ui';",
    );
    expect(rightSidebarFrontend).toContain('Right sidebar');
    expect(rightSidebarFrontend).not.toContain('Right rail');
    expect(rightSidebarFrontend).not.toContain('<button');
    expect(JSON.parse(readFileSync(join(runtimeRoot, 'workbench-ext', 'extension.json'), 'utf-8')).contributes.views).toEqual(
      expect.arrayContaining([expect.objectContaining({ detailView: 'detail' }), expect.objectContaining({ location: 'workbench' })]),
    );
    const workbenchFrontend = readFileSync(join(runtimeRoot, 'workbench-ext', 'src', 'frontend.tsx'), 'utf-8');
    expect(workbenchFrontend).toContain(
      "import { ContextRail, ContextRailBody, ContextRailHeader, ContextRailSection, ToolbarButton } from '@neon-pilot/extensions/ui';",
    );
    expect(workbenchFrontend).toContain('Right sidebar');
    expect(workbenchFrontend).not.toContain('Right rail');
    expect(workbenchFrontend).not.toContain('<button');
  });

  it('creates a route-owned right sidebar starter template', () => {
    createRuntimeExtension({ id: 'route-context-ext', name: 'Route Context', template: 'route-right-sidebar' }, stateRoot);

    const manifest = JSON.parse(readFileSync(join(runtimeRoot, 'route-context-ext', 'extension.json'), 'utf-8'));
    expect(manifest.contributes.nav[0]).toMatchObject({
      route: '/ext/route-context-ext',
      rightSidebarView: 'context',
    });
    expect(manifest.contributes.views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'page', location: 'main', route: '/ext/route-context-ext', component: 'ExtensionPage' }),
        expect.objectContaining({ id: 'context', location: 'rightRail', placement: 'primary', component: 'ExtensionContextRail' }),
      ]),
    );

    const frontend = readFileSync(join(runtimeRoot, 'route-context-ext', 'src', 'frontend.tsx'), 'utf-8');
    expect(frontend).toContain("import { useEffect, useState } from 'react';");
    expect(frontend).toContain('pa.selection.set');
    expect(frontend).toContain('pa.selection.subscribe');
    expect(frontend).toContain('Use this right sidebar');
    expect(frontend).not.toContain('Right rail');
    expect(frontend).not.toContain('<button');
  });

  it('creates a route-owned contextual left sidebar starter template', () => {
    createRuntimeExtension({ id: 'route-sidebar-ext', name: 'Route Sidebar', template: 'route-sidebar' }, stateRoot);

    const manifest = JSON.parse(readFileSync(join(runtimeRoot, 'route-sidebar-ext', 'extension.json'), 'utf-8'));
    expect(manifest.contributes.nav[0]).toMatchObject({
      route: '/ext/route-sidebar-ext',
      sidebarView: 'sidebar',
    });
    expect(manifest.contributes.views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'page', location: 'main', route: '/ext/route-sidebar-ext', component: 'ExtensionPage' }),
        expect.objectContaining({ id: 'sidebar', location: 'sidebar', component: 'ExtensionSidebar' }),
      ]),
    );

    const frontend = readFileSync(join(runtimeRoot, 'route-sidebar-ext', 'src', 'frontend.tsx'), 'utf-8');
    expect(frontend).toContain("import { useEffect, useState } from 'react';");
    expect(frontend).toContain(
      "import { AppPageIntro, AppPageLayout, SidebarList, SidebarSection, ToolbarButton } from '@neon-pilot/extensions/ui';",
    );
    expect(frontend).toContain('<SidebarSection title="Navigate">');
    expect(frontend).toContain('pa.selection.set');
    expect(frontend).toContain('pa.selection.subscribe');
    expect(frontend).toContain('route-owned left sidebar');
    expect(frontend).not.toContain('Threads');
    expect(frontend).not.toContain('<aside');
    expect(frontend).not.toContain('<button');
  });

  it('creates a full route shell starter template', () => {
    createRuntimeExtension({ id: 'route-shell-ext', name: 'Route Shell', template: 'route-shell' }, stateRoot);

    const manifest = JSON.parse(readFileSync(join(runtimeRoot, 'route-shell-ext', 'extension.json'), 'utf-8'));
    expect(manifest.contributes.nav[0]).toMatchObject({
      route: '/ext/route-shell-ext',
      sidebarView: 'sidebar',
      rightSidebarView: 'context',
    });
    expect(manifest.contributes.views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'page', location: 'main', route: '/ext/route-shell-ext', component: 'ExtensionPage' }),
        expect.objectContaining({ id: 'sidebar', location: 'sidebar', component: 'ExtensionSidebar' }),
        expect.objectContaining({ id: 'context', location: 'rightRail', placement: 'primary', component: 'ExtensionContextRail' }),
      ]),
    );

    const frontend = readFileSync(join(runtimeRoot, 'route-shell-ext', 'src', 'frontend.tsx'), 'utf-8');
    expect(frontend).toContain("import { useEffect, useState } from 'react';");
    expect(frontend).toContain(
      "import { AppPageIntro, AppPageLayout, ContextRail, ContextRailBody, ContextRailHeader, ContextRailSection, SidebarList, SidebarSection, ToolbarButton } from '@neon-pilot/extensions/ui';",
    );
    expect(frontend).toContain('<SidebarSection title="Navigate">');
    expect(frontend).toContain('pa.selection.set');
    expect(frontend).toContain('pa.selection.subscribe');
    expect(frontend).toContain('route-owned left sidebar');
    expect(frontend).toContain('Use this right sidebar');
    expect(frontend).not.toContain('Threads');
    expect(frontend).not.toContain('Right rail');
    expect(frontend).not.toContain('<aside');
    expect(frontend).not.toContain('<button');
  });

  it('generates manifest with appearance metadata when caller provides it', () => {
    const result = createRuntimeExtension(
      {
        id: 'styled-app',
        name: 'Styled App',
        appearance: {
          accent: 'drawing',
          aliases: ['whiteboard', 'sketchpad'],
          singleton: false,
          window: { defaultWidth: 800, defaultHeight: 600 },
        },
      },
      stateRoot,
    );

    expect(result.ok).toBe(true);
    const manifest = JSON.parse(readFileSync(join(result.packageRoot, 'extension.json'), 'utf-8'));
    expect(manifest.contributes.appearance).toEqual({
      accent: 'drawing',
      aliases: ['whiteboard', 'sketchpad'],
      singleton: false,
      window: { defaultWidth: 800, defaultHeight: 600 },
    });
  });

  it('includes appearance with only accent when other fields are omitted', () => {
    const result = createRuntimeExtension(
      {
        id: 'accent-only',
        name: 'Accent Only',
        appearance: { accent: 'telemetry' },
      },
      stateRoot,
    );

    const manifest = JSON.parse(readFileSync(join(result.packageRoot, 'extension.json'), 'utf-8'));
    expect(manifest.contributes.appearance).toEqual({ accent: 'telemetry' });
  });

  it('omits appearance from manifest when input does not provide it', () => {
    const result = createRuntimeExtension({ id: 'plain-ext', name: 'Plain' }, stateRoot);

    const manifest = JSON.parse(readFileSync(join(result.packageRoot, 'extension.json'), 'utf-8'));
    expect(manifest.contributes.appearance).toBeUndefined();
  });

  it('rejects array-shaped runtime appearance metadata', () => {
    expect(() => createRuntimeExtension({ id: 'array-appearance', name: 'Array Appearance', appearance: [] as never }, stateRoot)).toThrow(
      'Extension appearance must be an object.',
    );
    expect(() =>
      createRuntimeExtension({ id: 'array-window', name: 'Array Window', appearance: { window: [] } as never }, stateRoot),
    ).toThrow('Extension appearance window must be an object.');
  });

  it('validates create input and prevents duplicate ids or directories', () => {
    expect(() => createRuntimeExtension({ id: 'Bad', name: 'Name' }, stateRoot)).toThrow('Extension id must be');
    expect(() => createRuntimeExtension({ id: 'ok-id', name: '   ' }, stateRoot)).toThrow('Extension name is required');
    expect(() => createRuntimeExtension({ id: 'ok-id', name: 'Name', template: 'bad' }, stateRoot)).toThrow(
      'Extension template must be main-page, route-sidebar, route-right-sidebar, route-shell, right-rail, or workbench-detail.',
    );
    findExtensionEntry.mockReturnValueOnce({});
    expect(() => createRuntimeExtension({ id: 'ok-id', name: 'Name' }, stateRoot)).toThrow('Extension id already exists');
    mkdirSync(join(runtimeRoot, 'ok-id'), { recursive: true });
    expect(() => createRuntimeExtension({ id: 'ok-id', name: 'Name' }, stateRoot)).toThrow('Extension directory already exists');
  });

  it('updates runtime extension name, description, appearance, and source files in place', async () => {
    const packageRoot = join(runtimeRoot, 'my-extension');
    mkdirSync(join(packageRoot, 'src'), { recursive: true });
    writeFileSync(
      join(packageRoot, 'extension.json'),
      JSON.stringify({
        id: 'my-extension',
        name: 'Original Name',
        description: 'Original description',
        packageType: 'user',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
        contributes: { views: [{ location: 'main', route: '/ext/my-extension' }] },
      }),
    );
    writeFileSync(join(packageRoot, 'src', 'frontend.tsx'), '// original frontend');
    writeFileSync(join(packageRoot, 'src', 'backend.ts'), '// original backend');
    findExtensionEntry.mockReturnValue({ manifest: { schemaVersion: 2, id: 'my-extension' }, packageRoot, source: 'runtime' });
    listExtensionInstallSummaries.mockReturnValue([{ id: 'my-extension', name: 'Updated Name' }]);

    const result = await updateRuntimeExtension(
      'my-extension',
      {
        name: 'Updated Name',
        description: 'Updated description',
        appearance: { accent: 'drawing' },
        source: {
          frontend: '// updated frontend',
          backend: '// updated backend',
        },
      },
      stateRoot,
    );

    expect(result).toEqual({
      ok: true,
      extension: { id: 'my-extension', name: 'Updated Name' },
      packageRoot,
      built: true,
    });

    const manifest = JSON.parse(readFileSync(join(packageRoot, 'extension.json'), 'utf-8'));
    expect(manifest.name).toBe('Updated Name');
    expect(manifest.description).toBe('Updated description');
    expect(manifest.contributes.appearance).toEqual({ accent: 'drawing' });
    expect(manifest.backend.entry).toBe('dist/backend.mjs');
    expect(readFileSync(join(packageRoot, 'src', 'frontend.tsx'), 'utf-8')).toBe('// updated frontend');
    expect(readFileSync(join(packageRoot, 'src', 'backend.ts'), 'utf-8')).toBe('// updated backend');
    expect(invalidateExtensionRegistryReadCaches).toHaveBeenCalledWith(stateRoot, undefined);
    expect(execFileSync).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([expect.stringMatching(/extension-build\.mjs$/)]),
      expect.any(Object),
    );
    expect(reloadExtensionBackend).toHaveBeenCalledWith('my-extension');
  });

  it('updates only provided fields on a runtime extension', async () => {
    const packageRoot = join(runtimeRoot, 'partial-update');
    mkdirSync(join(packageRoot, 'src'), { recursive: true });
    writeFileSync(
      join(packageRoot, 'extension.json'),
      JSON.stringify({
        id: 'partial-update',
        name: 'Partial',
        description: 'Will keep this',
        packageType: 'user',
        backend: { entry: 'dist/backend.mjs' },
        contributes: {},
      }),
    );
    writeFileSync(join(packageRoot, 'src', 'backend.ts'), '// keep this backend');
    findExtensionEntry.mockReturnValue({ manifest: { schemaVersion: 2, id: 'partial-update' }, packageRoot, source: 'runtime' });
    listExtensionInstallSummaries.mockReturnValue([{ id: 'partial-update', name: 'Partial Updated' }]);

    const result = await updateRuntimeExtension(
      'partial-update',
      { name: 'Partial Updated', source: { frontend: '// new frontend' } },
      stateRoot,
    );

    expect(result.ok).toBe(true);
    expect(result.built).toBe(true);
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'extension.json'), 'utf-8'));
    expect(manifest.name).toBe('Partial Updated');
    expect(manifest.description).toBe('Will keep this');
    expect(existsSync(join(packageRoot, 'src', 'frontend.tsx'))).toBe(true);
    expect(readFileSync(join(packageRoot, 'src', 'frontend.tsx'), 'utf-8')).toBe('// new frontend');
    expect(readFileSync(join(packageRoot, 'src', 'backend.ts'), 'utf-8')).toBe('// keep this backend');
    expect(reloadExtensionBackend).toHaveBeenCalledWith('partial-update');
  });

  it('validates source values before writing manifest changes', async () => {
    const packageRoot = join(runtimeRoot, 'invalid-source');
    mkdirSync(join(packageRoot, 'src'), { recursive: true });
    const originalManifest = JSON.stringify({
      id: 'invalid-source',
      name: 'Original',
      packageType: 'user',
      contributes: {},
    });
    writeFileSync(join(packageRoot, 'extension.json'), originalManifest);
    findExtensionEntry.mockReturnValue({ manifest: { id: 'invalid-source' }, packageRoot, source: 'runtime' });

    await expect(updateRuntimeExtension('invalid-source', { name: 'Changed', source: { frontend: 123 } }, stateRoot)).rejects.toThrow(
      'Extension frontend source must be a string.',
    );

    expect(readFileSync(join(packageRoot, 'extension.json'), 'utf-8')).toBe(originalManifest);
    expect(invalidateExtensionRegistryReadCaches).not.toHaveBeenCalled();
  });

  it('rejects update for non-existent, system, or rootless extensions', async () => {
    findExtensionEntry.mockReturnValue(null);
    await expect(updateRuntimeExtension('missing-ext', {}, stateRoot)).rejects.toThrow('Extension not found');

    findExtensionEntry.mockReturnValue({ manifest: { id: 'system-ext' }, packageRoot: '/some/root', source: 'system' });
    await expect(updateRuntimeExtension('system-ext', { name: 'X' }, stateRoot)).rejects.toThrow(
      'System extensions cannot be updated through the runtime lifecycle.',
    );

    findExtensionEntry.mockReturnValue({ manifest: { id: 'no-root' }, source: 'runtime' });
    await expect(updateRuntimeExtension('no-root', { name: 'X' }, stateRoot)).rejects.toThrow('Extension package root is unavailable');
  });

  it('removes appearance from manifest when update sets it to undefined', async () => {
    const packageRoot = join(runtimeRoot, 'remove-appearance');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(
      join(packageRoot, 'extension.json'),
      JSON.stringify({
        id: 'remove-appearance',
        name: 'Remove Appearance',
        packageType: 'user',
        contributes: { appearance: { accent: 'chat' } },
      }),
    );
    findExtensionEntry.mockReturnValue({ manifest: { schemaVersion: 2, id: 'remove-appearance' }, packageRoot, source: 'runtime' });
    listExtensionInstallSummaries.mockReturnValue([{ id: 'remove-appearance', name: 'Remove Appearance' }]);

    // Setting appearance with no valid accent should remove it from the manifest; no source change so no build
    const result = await updateRuntimeExtension('remove-appearance', { appearance: {} }, stateRoot);
    expect(result.ok).toBe(true);
    expect(result.built).toBeUndefined();
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'extension.json'), 'utf-8'));
    expect(manifest.contributes.appearance).toBeUndefined();
  });

  it('snapshots and exports runtime extensions', async () => {
    const packageRoot = join(stateRoot, 'source-ext');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, 'extension.json'), '{}');
    findExtensionEntry.mockReturnValue({ packageRoot, manifest: { schemaVersion: 2 } });

    const snapshot = snapshotRuntimeExtension('ext', stateRoot);
    expect(snapshot.snapshotPath).toContain(join(stateRoot, 'extension-snapshots', 'ext'));
    expect(existsSync(join(snapshot.snapshotPath, 'extension.json'))).toBe(true);

    expect(exportRuntimeExtension('ext', stateRoot).exportPath).toContain(join(stateRoot, 'extension-exports', 'ext-'));
    expect(execFileSync).toHaveBeenCalledWith('zip', expect.arrayContaining(['-qry']), { cwd: stateRoot });
  });

  it('builds a valid runtime extension', async () => {
    const packageRoot = join(stateRoot, 'buildable-ext');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, 'extension.json'), JSON.stringify({ id: 'buildable-ext', schemaVersion: 2 }));
    findExtensionEntry.mockReturnValue({ packageRoot, manifest: { schemaVersion: 2 } });

    const result = await buildRuntimeExtension('buildable-ext', stateRoot);
    expect(result).toEqual({ ok: true, extensionId: 'buildable-ext', built: true });
    expect(execFileSync).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([expect.stringMatching(/extension-build\.mjs$/), packageRoot]),
      expect.objectContaining({ cwd: expect.any(String), stdio: 'pipe' }),
    );
  });

  it('rejects build for missing extension', async () => {
    await expect(buildRuntimeExtension('nonexistent', stateRoot)).rejects.toThrow('Extension not found');
  });

  it('rejects build for extension without package root', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { schemaVersion: 2 } });
    await expect(buildRuntimeExtension('noroot', stateRoot)).rejects.toThrow('Extension package root is unavailable');
  });

  it('rejects build for extension with old schema version', async () => {
    const packageRoot = join(stateRoot, 'old-ext');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, 'extension.json'), JSON.stringify({ id: 'old-ext', schemaVersion: 1 }));
    findExtensionEntry.mockReturnValue({ packageRoot, manifest: { schemaVersion: 1 } });
    await expect(buildRuntimeExtension('old-ext', stateRoot)).rejects.toThrow(
      'Only native extension manifest schemaVersion 2 can be built',
    );
  });

  describe('autoBuild behavior in updateRuntimeExtension', () => {
    function setupExtension(id: string): string {
      const packageRoot = join(runtimeRoot, id);
      mkdirSync(join(packageRoot, 'src'), { recursive: true });
      writeFileSync(
        join(packageRoot, 'extension.json'),
        JSON.stringify({
          id,
          schemaVersion: 2,
          name: 'Test Extension',
          packageType: 'user',
          backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
          contributes: {},
        }),
      );
      writeFileSync(join(packageRoot, 'src', 'frontend.tsx'), '// original');
      writeFileSync(join(packageRoot, 'src', 'backend.ts'), '// original');
      findExtensionEntry.mockReturnValue({ manifest: { schemaVersion: 2, id }, packageRoot, source: 'runtime' });
      listExtensionInstallSummaries.mockReturnValue([{ id, name: 'Test Extension' }]);
      return packageRoot;
    }

    beforeEach(() => {
      reloadExtensionBackend.mockClear();
    });

    it('builds and reloads when source files change with autoBuild defaulting to true', async () => {
      setupExtension('auto-build-default');

      const result = await updateRuntimeExtension('auto-build-default', { source: { frontend: '// changed' } }, stateRoot);

      expect(result.built).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringMatching(/extension-build\.mjs$/)]),
        expect.any(Object),
      );
      expect(reloadExtensionBackend).toHaveBeenCalledWith('auto-build-default');
    });

    it('skips build when autoBuild is explicitly false', async () => {
      setupExtension('auto-build-false');

      const result = await updateRuntimeExtension('auto-build-false', { source: { frontend: '// changed' }, autoBuild: false }, stateRoot);

      expect(result.built).toBeUndefined();
      expect(execFileSync).not.toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringMatching(/extension-build\.mjs$/)]),
        expect.any(Object),
      );
      expect(reloadExtensionBackend).not.toHaveBeenCalled();
    });

    it('skips build for manifest-only updates (no source changes)', async () => {
      setupExtension('manifest-only');

      const result = await updateRuntimeExtension('manifest-only', { name: 'Renamed', description: 'New description' }, stateRoot);

      expect(result.built).toBeUndefined();
      expect(execFileSync).not.toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringMatching(/extension-build\.mjs$/)]),
        expect.any(Object),
      );
      expect(reloadExtensionBackend).not.toHaveBeenCalled();
    });

    it('builds and reloads when both frontend and backend source change', async () => {
      setupExtension('both-source-change');

      const result = await updateRuntimeExtension(
        'both-source-change',
        { source: { frontend: '// new frontend', backend: '// new backend' } },
        stateRoot,
      );

      expect(result.built).toBe(true);
      expect(execFileSync).toHaveBeenCalled();
      expect(reloadExtensionBackend).toHaveBeenCalledWith('both-source-change');
    });

    it('throws build error when buildRuntimeExtension fails', async () => {
      setupExtension('build-fails');
      execFileSync.mockImplementationOnce(() => {
        throw new Error('esbuild build failed');
      });

      await expect(updateRuntimeExtension('build-fails', { source: { frontend: '// broken' } }, stateRoot)).rejects.toThrow(
        'esbuild build failed',
      );

      expect(reloadExtensionBackend).not.toHaveBeenCalled();
    });
  });

  it('imports safe extension bundles into the runtime extension root', () => {
    const zipPath = join(stateRoot, 'bundle.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');
    listExtensionInstallSummaries.mockReturnValue([{ id: 'imported-ext' }]);

    const imported = importRuntimeExtensionBundle({ zipPath }, stateRoot);

    expect(imported).toEqual({ ok: true, extension: { id: 'imported-ext' }, packageRoot: join(runtimeRoot, 'imported-ext') });
    expect(findExtensionEntry).toHaveBeenCalledWith('imported-ext', stateRoot, undefined);
    expect(existsSync(join(runtimeRoot, 'imported-ext', 'extension.json'))).toBe(true);
  });

  it('inspects safe extension bundles without copying them into the runtime extension root', () => {
    const zipPath = join(stateRoot, 'bundle.neon-extension.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');

    expect(inspectRuntimeExtensionBundle({ zipPath })).toMatchObject({ id: 'imported-ext', name: 'Imported' });
    expect(existsSync(join(runtimeRoot, 'imported-ext'))).toBe(false);
    expect(invalidateExtensionRegistryReadCaches).not.toHaveBeenCalled();
  });

  it('rejects imported bundles whose id already exists in the target state root', () => {
    const zipPath = join(stateRoot, 'duplicate.neon-extension.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');
    findExtensionEntry.mockImplementation((id, root) => (id === 'imported-ext' && root === stateRoot ? { manifest: { id } } : null));

    expect(() => importRuntimeExtensionBundle({ zipPath }, stateRoot)).toThrow('Extension id already exists.');
    expect(findExtensionEntry).toHaveBeenCalledWith('imported-ext', stateRoot, undefined);
    expect(existsSync(join(runtimeRoot, 'imported-ext'))).toBe(false);
  });

  it('imports extension bundles with stale compatibility metadata', () => {
    const zipPath = join(stateRoot, 'incompatible.neon-extension.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');
    execFileSync.mockImplementation((command, args) => {
      if (command === 'zipinfo') return safeBundleZipInfo as ReturnType<ExecFileSync>;
      if (command === 'unzip') {
        const extractRoot = String(args?.[3]);
        mkdirSync(join(extractRoot, 'bundle', 'dist'), { recursive: true });
        writeFileSync(
          join(extractRoot, 'bundle', 'extension.json'),
          JSON.stringify({
            id: 'old-extension',
            name: 'Old Extension',
            compatibility: { neonPilot: '>=0.10.0 <0.11.0' },
            backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
          }),
        );
        writeFileSync(join(extractRoot, 'bundle', 'dist', 'backend.mjs'), 'export async function ping() {}');
        writeFileSync(join(extractRoot, 'bundle', 'dist', 'build-manifest.json'), '{}');
        return Buffer.from('');
      }
      return Buffer.from('');
    });
    listExtensionInstallSummaries.mockReturnValue([{ id: 'old-extension', name: 'Old Extension' }]);

    expect(importRuntimeExtensionBundle({ zipPath }, stateRoot)).toMatchObject({
      ok: true,
      extension: { id: 'old-extension' },
    });
    expect(existsSync(join(runtimeRoot, 'old-extension'))).toBe(true);
  });

  it('rejects bundles that declare a backend without a built backend artifact', () => {
    const zipPath = join(stateRoot, 'source-only.neon-extension.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');
    execFileSync.mockImplementation((command, args) => {
      if (command === 'zipinfo')
        return [
          '-rw-r--r--  3.0 unx      123 tx      100 defN 26-Jun-01 00:00 bundle/extension.json',
          '-rw-r--r--  3.0 unx      123 tx      100 defN 26-Jun-01 00:00 bundle/src/backend.ts',
        ].join('\n') as ReturnType<ExecFileSync>;
      if (command === 'unzip') {
        const extractRoot = String(args?.[3]);
        mkdirSync(join(extractRoot, 'bundle', 'src'), { recursive: true });
        writeFileSync(
          join(extractRoot, 'bundle', 'extension.json'),
          JSON.stringify({
            id: 'source-only-ext',
            name: 'Source Only',
            backend: { entry: 'dist/backend.mjs', actions: [{ id: 'ping', handler: 'ping' }] },
          }),
        );
        writeFileSync(join(extractRoot, 'bundle', 'src', 'backend.ts'), 'export async function ping() {}');
        return Buffer.from('');
      }
      return Buffer.from('');
    });

    expect(() => importRuntimeExtensionBundle({ zipPath }, stateRoot)).toThrow(
      'Extension bundle is missing build manifest: dist/build-manifest.json',
    );
    expect(existsSync(join(runtimeRoot, 'source-only-ext'))).toBe(false);
  });

  it('blocks deleting bundled packaged system extensions', async () => {
    const packageRoot = join(stateRoot, 'bundled', 'system-extension');
    mkdirSync(packageRoot, { recursive: true });
    findExtensionEntry.mockReturnValue({
      manifest: { id: 'system-extension', name: 'System Extension', packageType: 'system' },
      packageRoot,
    });

    await expect(deleteRuntimeExtension('system-extension', stateRoot)).rejects.toThrow('Packaged system extensions cannot be deleted.');
    expect(removeExtensionFromRegistry).not.toHaveBeenCalled();
  });

  it('deletes runtime-installed extensions even when their manifest packageType is system', async () => {
    const packageRoot = join(runtimeRoot, 'system-hermes-agent');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(
      join(packageRoot, 'extension.json'),
      JSON.stringify({ id: 'system-hermes-agent', name: 'Hermes Agent', packageType: 'system' }),
    );
    findExtensionEntry.mockReturnValue({
      manifest: { id: 'system-hermes-agent', name: 'Hermes Agent', packageType: 'system' },
      packageRoot,
    });

    await expect(deleteRuntimeExtension('system-hermes-agent', stateRoot)).resolves.toEqual({
      ok: true,
      extensionId: 'system-hermes-agent',
      deleted: true,
    });
    expect(existsSync(packageRoot)).toBe(false);
    expect(stopExtensionServices).toHaveBeenCalledWith('system-hermes-agent');
    expect(unregisterBashProcessWrapper).toHaveBeenCalledWith('system-hermes-agent');
    expect(uninstallExtensionSubscriptions).toHaveBeenCalledWith('system-hermes-agent');
    expect(removeExtensionFromRegistry).toHaveBeenCalledWith('system-hermes-agent', stateRoot, undefined);
  });

  it('continues deleting runtime extensions when cleanup steps fail', async () => {
    const packageRoot = join(runtimeRoot, 'cleanup-fails');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, 'extension.json'), JSON.stringify({ id: 'cleanup-fails', name: 'Cleanup Fails' }));
    findExtensionEntry.mockReturnValue({
      manifest: { id: 'cleanup-fails', name: 'Cleanup Fails', packageType: 'user' },
      packageRoot,
    });
    stopExtensionServices.mockRejectedValue(new Error('service stop failed'));
    unregisterBashProcessWrapper.mockImplementation(() => {
      throw new Error('wrapper cleanup failed');
    });
    uninstallExtensionSubscriptions.mockImplementation(() => {
      throw new Error('subscription cleanup failed');
    });
    removeExtensionFromRegistry.mockImplementation(() => {
      throw new Error('registry cleanup failed');
    });

    await expect(deleteRuntimeExtension('cleanup-fails', stateRoot)).resolves.toMatchObject({
      ok: true,
      extensionId: 'cleanup-fails',
      deleted: true,
      warnings: [
        { operation: 'stop extension services', message: 'service stop failed' },
        { operation: 'unregister process wrappers', message: 'wrapper cleanup failed' },
        { operation: 'delete extension subscriptions', message: 'subscription cleanup failed' },
        { operation: 'remove extension registry state', message: 'registry cleanup failed' },
      ],
    });
    expect(existsSync(packageRoot)).toBe(false);
    expect(clearExtensionFailureRecords).toHaveBeenCalledWith('cleanup-fails', stateRoot, undefined);
    expect(invalidateExtensionRegistryReadCaches).toHaveBeenCalledWith(stateRoot, undefined);
  });

  it('clears stale registry state instead of throwing when package root is unavailable', async () => {
    findExtensionEntry.mockReturnValue({
      manifest: { id: 'missing-root', name: 'Missing Root', packageType: 'user' },
    });

    await expect(deleteRuntimeExtension('missing-root', stateRoot)).resolves.toMatchObject({
      ok: true,
      extensionId: 'missing-root',
      deleted: false,
      warnings: [{ operation: 'delete extension package', message: 'Extension package root is unavailable.' }],
    });
    expect(removeExtensionFromRegistry).toHaveBeenCalledWith('missing-root', stateRoot, undefined);
    expect(clearExtensionFailureRecords).toHaveBeenCalledWith('missing-root', stateRoot, undefined);
  });

  it('deletes invalid runtime extension packages by id', async () => {
    const packageRoot = join(runtimeRoot, 'bad-extension');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, 'extension.json'), '{bad json');
    readInvalidRuntimeExtensionEntries.mockReturnValue([
      {
        id: 'bad-extension',
        name: 'Bad Extension',
        packageType: 'user',
        packageRoot,
        source: 'runtime',
        errors: ['invalid'],
      },
    ]);

    await expect(deleteRuntimeExtension('bad-extension', stateRoot)).resolves.toEqual({
      ok: true,
      extensionId: 'bad-extension',
      deleted: true,
    });
    expect(existsSync(packageRoot)).toBe(false);
  });

  it('clears stale registry state when deleting a missing runtime extension by id', async () => {
    await expect(deleteRuntimeExtension('missing-extension', stateRoot)).resolves.toEqual({
      ok: true,
      extensionId: 'missing-extension',
      deleted: false,
    });
    expect(removeExtensionFromRegistry).toHaveBeenCalledWith('missing-extension', stateRoot, undefined);
    expect(clearExtensionFailureRecords).toHaveBeenCalledWith('missing-extension', stateRoot, undefined);
  });

  it('rejects unsafe or missing extension bundles', () => {
    expect(() => importRuntimeExtensionBundle({}, stateRoot)).toThrow('zipPath is required');
    expect(() => importRuntimeExtensionBundle({ zipPath: join(stateRoot, 'missing.zip') }, stateRoot)).toThrow(
      'Extension bundle not found',
    );
    const zipPath = join(stateRoot, 'bad.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');
    execFileSync.mockImplementationOnce(
      () => '-rw-r--r--  3.0 unx      123 tx      100 defN 26-Jun-01 00:00 ../evil/extension.json\n' as ReturnType<ExecFileSync>,
    );
    expect(() => importRuntimeExtensionBundle({ zipPath }, stateRoot)).toThrow('unsafe paths');
  });
});
