import { existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chdir } from 'node:process';

import { afterEach, describe, expect, it } from 'vitest';

import { listExtensionPackagePaths } from './extensionPackagePaths.js';

const originalResourcesPath = process.resourcesPath;
const originalCwd = process.cwd();

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
  });

  it('discovers packaged experimental extensions from Electron resources', () => {
    const tempRoot = join(tmpdir(), `pa-extension-paths-${process.pid}-${Date.now()}`);
    const experimentalRoot = join(tempRoot, 'experimental-extensions', 'extensions');
    const packageRoot = writeExtension(experimentalRoot, 'sample-experiment');

    Object.defineProperty(process, 'resourcesPath', {
      value: tempRoot,
      configurable: true,
    });

    try {
      expect(existsSync(packageRoot)).toBe(true);
      expect(listExtensionPackagePaths()).toEqual(
        expect.arrayContaining([expect.objectContaining({ packageRoot, source: 'experimental' })]),
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('prefers unpacked packaged extensions over asar-adjacent source paths', () => {
    const tempRoot = join(tmpdir(), `pa-extension-paths-${process.pid}-${Date.now()}`);
    const resourcesRoot = join(tempRoot, 'Resources');
    const unpackedRoot = join(resourcesRoot, 'experimental-extensions', 'extensions');
    const asarAppRoot = join(resourcesRoot, 'app.asar', 'server', 'dist', 'app');
    const asarRoot = join(asarAppRoot, 'experimental-extensions', 'extensions');
    const unpackedPackageRoot = writeExtension(unpackedRoot, 'system-images');
    const asarPackageRoot = writeExtension(asarRoot, 'system-images');

    Object.defineProperty(process, 'resourcesPath', {
      value: resourcesRoot,
      configurable: true,
    });

    try {
      mkdirSync(asarAppRoot, { recursive: true });
      chdir(asarAppRoot);
      const paths = listExtensionPackagePaths().filter((entry) => entry.packageRoot.endsWith('/system-images'));
      expect(paths[0]).toMatchObject({ packageRoot: unpackedPackageRoot, source: 'experimental' });
      expect(paths[1]).toMatchObject({ packageRoot: realpathSync(asarPackageRoot), source: 'experimental' });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
