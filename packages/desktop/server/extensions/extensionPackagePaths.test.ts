import { existsSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chdir } from 'node:process';

import { afterEach, describe, expect, it } from 'vitest';

import { listExtensionPackagePaths } from './extensionPackagePaths.js';

const originalResourcesPath = process.resourcesPath;
const originalCwd = process.cwd();
const originalRepoRoot = process.env.NEON_PILOT_REPO_ROOT;

function writeExtension(root: string, id: string) {
  const packageRoot = join(root, id);
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(join(packageRoot, 'extension.json'), JSON.stringify({ schemaVersion: 2, id, name: id }, null, 2));
  return packageRoot;
}

describe('extension package paths', () => {
  afterEach(() => {
    chdir(originalCwd);
    Object.defineProperty(process, 'resourcesPath', {
      value: originalResourcesPath,
      configurable: true,
    });
    if (originalRepoRoot === undefined) {
      delete process.env.NEON_PILOT_REPO_ROOT;
    } else {
      process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
    }
  });

  it('does not auto-discover repo installable extensions from Electron resources', () => {
    const tempRoot = join(tmpdir(), `neon-pilot-extension-paths-${process.pid}-${Date.now()}`);
    const installableRoot = join(tempRoot, 'installable-extensions');
    const packageRoot = writeExtension(installableRoot, 'sample-installable');

    Object.defineProperty(process, 'resourcesPath', {
      value: tempRoot,
      configurable: true,
    });

    try {
      expect(existsSync(packageRoot)).toBe(true);
      expect(listExtensionPackagePaths()).not.toEqual(expect.arrayContaining([expect.objectContaining({ packageRoot })]));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('loads configured installable extension paths as external user extensions', () => {
    const tempRoot = join(tmpdir(), `neon-pilot-extension-paths-${process.pid}-${Date.now()}`);
    const extensionRoot = writeExtension(join(tempRoot, 'installable-extensions'), 'system-local-models');
    const runtimeRoot = join(tempRoot, 'runtime-extensions');

    try {
      const paths = listExtensionPackagePaths({ runtimeRoot: extensionRoot });
      expect(paths).toEqual(expect.arrayContaining([expect.objectContaining({ packageRoot: extensionRoot, source: 'external' })]));
      expect(paths).not.toEqual(expect.arrayContaining([expect.objectContaining({ packageRoot: runtimeRoot })]));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('prefers unpacked bundled extensions over asar-adjacent source paths', () => {
    const tempRoot = join(tmpdir(), `neon-pilot-extension-paths-${process.pid}-${Date.now()}`);
    const resourcesRoot = join(tempRoot, 'Resources');
    const unpackedRoot = join(resourcesRoot, 'extensions');
    const asarAppRoot = join(resourcesRoot, 'app.asar', 'server', 'dist', 'app');
    const asarRoot = join(asarAppRoot, 'extensions');
    const unpackedPackageRoot = writeExtension(unpackedRoot, 'system-files');
    const asarPackageRoot = writeExtension(asarRoot, 'system-files');

    Object.defineProperty(process, 'resourcesPath', {
      value: resourcesRoot,
      configurable: true,
    });
    delete process.env.NEON_PILOT_REPO_ROOT;

    try {
      mkdirSync(asarAppRoot, { recursive: true });
      chdir(asarAppRoot);
      const paths = listExtensionPackagePaths().filter((entry) => entry.packageRoot.endsWith('/system-files'));
      expect(paths[0]).toMatchObject({ packageRoot: unpackedPackageRoot, source: 'bundled' });
      expect(paths[1]).toMatchObject({ packageRoot: realpathSync(asarPackageRoot), source: 'bundled' });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('deduplicates package roots that resolve to the same real path', () => {
    const tempRoot = join(tmpdir(), `neon-pilot-extension-paths-${process.pid}-${Date.now()}`);
    const bundledRoot = join(tempRoot, 'extensions');
    const packageRoot = writeExtension(bundledRoot, 'system-files');
    const runtimeRoot = join(tempRoot, 'runtime-extensions');
    const linkedPackageRoot = join(runtimeRoot, 'system-files');

    Object.defineProperty(process, 'resourcesPath', {
      value: tempRoot,
      configurable: true,
    });
    delete process.env.NEON_PILOT_REPO_ROOT;

    try {
      mkdirSync(runtimeRoot, { recursive: true });
      symlinkSync(packageRoot, linkedPackageRoot, 'dir');
      chdir(tempRoot);

      const paths = listExtensionPackagePaths({ runtimeRoot }).filter(
        (entry) => realpathSync(entry.packageRoot) === realpathSync(packageRoot),
      );

      expect(paths).toHaveLength(1);
      expect(paths[0]).toMatchObject({ packageRoot: realpathSync(packageRoot), source: 'bundled' });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
