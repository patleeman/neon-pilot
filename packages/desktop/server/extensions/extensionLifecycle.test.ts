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

vi.mock('./extensionRegistry.js', () => ({
  findExtensionEntry,
  getRuntimeExtensionsRoot,
  invalidateExtensionRegistryReadCaches,
  listExtensionInstallSummaries,
  parseExtensionManifest,
  readInvalidRuntimeExtensionEntries,
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
  importRuntimeExtensionBundle,
  snapshotRuntimeExtension,
} = await import('./extensionLifecycle.js');

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
    parseExtensionManifest.mockClear();
    execFileSync.mockReset();
    execFileSync.mockImplementation((command, args) => {
      if (command === 'zipinfo') return 'bundle/extension.json\n' as ReturnType<ExecFileSync>;
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
      contributes: { views: [{ location: 'main', route: '/ext/my-extension' }], nav: [{ label: 'My Extension' }] },
    });
    expect(readFileSync(join(runtimeRoot, 'my-extension', 'src', 'frontend.tsx'), 'utf-8')).toContain('ExtensionPage');
    expect(readFileSync(join(runtimeRoot, 'my-extension', 'src', 'backend.ts'), 'utf-8')).toContain('export async function ping');
  });

  it('creates right rail and workbench detail templates', () => {
    createRuntimeExtension({ id: 'right-rail-ext', name: 'Right Rail', template: 'right-rail' }, stateRoot);
    createRuntimeExtension({ id: 'workbench-ext', name: 'Workbench', template: 'workbench-detail' }, stateRoot);

    expect(JSON.parse(readFileSync(join(runtimeRoot, 'right-rail-ext', 'extension.json'), 'utf-8')).contributes.views[0]).toMatchObject({
      location: 'rightRail',
      component: 'ExtensionPanel',
    });
    expect(JSON.parse(readFileSync(join(runtimeRoot, 'workbench-ext', 'extension.json'), 'utf-8')).contributes.views).toEqual(
      expect.arrayContaining([expect.objectContaining({ detailView: 'detail' }), expect.objectContaining({ location: 'workbench' })]),
    );
  });

  it('validates create input and prevents duplicate ids or directories', () => {
    expect(() => createRuntimeExtension({ id: 'Bad', name: 'Name' }, stateRoot)).toThrow('Extension id must be');
    expect(() => createRuntimeExtension({ id: 'ok-id', name: '   ' }, stateRoot)).toThrow('Extension name is required');
    expect(() => createRuntimeExtension({ id: 'ok-id', name: 'Name', template: 'bad' }, stateRoot)).toThrow('Extension template must be');
    findExtensionEntry.mockReturnValueOnce({});
    expect(() => createRuntimeExtension({ id: 'ok-id', name: 'Name' }, stateRoot)).toThrow('Extension id already exists');
    mkdirSync(join(runtimeRoot, 'ok-id'), { recursive: true });
    expect(() => createRuntimeExtension({ id: 'ok-id', name: 'Name' }, stateRoot)).toThrow('Extension directory already exists');
  });

  it('snapshots, exports, and rejects invalid build targets', async () => {
    const packageRoot = join(stateRoot, 'source-ext');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, 'extension.json'), '{}');
    findExtensionEntry.mockReturnValue({ packageRoot, manifest: { schemaVersion: 2 } });

    const snapshot = snapshotRuntimeExtension('ext', stateRoot);
    expect(snapshot.snapshotPath).toContain(join(stateRoot, 'extension-snapshots', 'ext'));
    expect(existsSync(join(snapshot.snapshotPath, 'extension.json'))).toBe(true);

    expect(exportRuntimeExtension('ext', stateRoot).exportPath).toContain(join(stateRoot, 'extension-exports', 'ext-'));
    expect(execFileSync).toHaveBeenCalledWith('zip', expect.arrayContaining(['-qry']), { cwd: stateRoot });
    await expect(buildRuntimeExtension('ext')).rejects.toThrow('no longer builds extensions at runtime');
  });

  it('imports safe extension bundles into the runtime extension root', () => {
    const zipPath = join(stateRoot, 'bundle.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');
    listExtensionInstallSummaries.mockReturnValue([{ id: 'imported-ext' }]);

    const imported = importRuntimeExtensionBundle({ zipPath }, stateRoot);

    expect(imported).toEqual({ ok: true, extension: { id: 'imported-ext' }, packageRoot: join(runtimeRoot, 'imported-ext') });
    expect(existsSync(join(runtimeRoot, 'imported-ext', 'extension.json'))).toBe(true);
  });

  it('rejects bundles that declare a backend without a built backend artifact', () => {
    const zipPath = join(stateRoot, 'source-only.neon-extension.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');
    execFileSync.mockImplementation((command, args) => {
      if (command === 'zipinfo') return 'bundle/extension.json\nbundle/src/backend.ts\n' as ReturnType<ExecFileSync>;
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

  it('rejects unsafe or missing extension bundles', () => {
    expect(() => importRuntimeExtensionBundle({}, stateRoot)).toThrow('zipPath is required');
    expect(() => importRuntimeExtensionBundle({ zipPath: join(stateRoot, 'missing.zip') }, stateRoot)).toThrow(
      'Extension bundle not found',
    );
    const zipPath = join(stateRoot, 'bad.zip');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(zipPath, 'zip');
    execFileSync.mockImplementationOnce(() => '../evil/extension.json\n' as ReturnType<ExecFileSync>);
    expect(() => importRuntimeExtensionBundle({ zipPath }, stateRoot)).toThrow('unsafe paths');
  });
});
