import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chdir } from 'node:process';

import { afterEach, describe, expect, it } from 'vitest';

import { listExtensionPackagePaths } from './extensionPackagePaths.js';

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

  it('prefers bundled extensions under the desktop resource root', () => {
    const tempRoot = join(tmpdir(), `neon-pilot-extension-paths-${process.pid}-${Date.now()}`);
    const resourcesRoot = join(tempRoot, 'Resources');
    const packageRoot = writeExtension(join(resourcesRoot, 'extensions'), 'system-files');

    try {
      chdir(resourcesRoot);
      const paths = listExtensionPackagePaths().filter((entry) => entry.packageRoot.endsWith('/system-files'));
      expect(paths[0]).toMatchObject({ packageRoot: realpathSync(packageRoot), source: 'bundled' });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
