import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getRuntimeSettingsFilePath,
  getRuntimeSettingsFilePathFromLayout,
  persistSettingsWrite,
  resolveLocalRuntimeSettingsFilePath,
} from './settingsPersistence.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createTempDir(prefix = 'neon-pilot-web-settings-persist-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('resolveLocalRuntimeSettingsFilePath', () => {
  it('uses <local>/agent/settings.json when the nested agent dir exists', () => {
    const localDir = createTempDir();
    mkdirSync(join(localDir, 'agent'), { recursive: true });

    expect(resolveLocalRuntimeSettingsFilePath(localDir)).toBe(join(localDir, 'agent', 'settings.json'));
  });

  it('falls back to <local>/settings.json when local dir exists without nested agent dir', () => {
    const localDir = createTempDir();

    expect(resolveLocalRuntimeSettingsFilePath(localDir)).toBe(join(localDir, 'settings.json'));
  });

  it('throws when local path exists but is not a directory', () => {
    const localDir = createTempDir();
    const file = join(localDir, 'local-file');
    writeFileSync(file, '{}\n');

    expect(() => resolveLocalRuntimeSettingsFilePath(file)).toThrow(`Local runtime config path is not a directory: ${file}`);
  });
});

describe('getRuntimeSettingsFilePath', () => {
  it('resolves settings from the explicit state root', () => {
    expect(getRuntimeSettingsFilePath('/state-root')).toBe(join('/state-root', 'neon-pilot-runtime', 'settings.json'));
  });
});

describe('getRuntimeSettingsFilePathFromLayout', () => {
  it('resolves settings from the desktop root layout systemRuntime', () => {
    const layout = resolveDesktopRootLayout({ root: '/test-root' });

    expect(getRuntimeSettingsFilePathFromLayout(layout)).toBe(join('/test-root/system/runtime', 'settings.json'));
  });

  it('uses the systemRuntime field from the provided DesktopRootLayout', () => {
    const layout = {
      ...resolveDesktopRootLayout({ root: '/custom' }),
      systemRuntime: '/custom/alternate/runtime',
    };

    expect(getRuntimeSettingsFilePathFromLayout(layout)).toBe('/custom/alternate/runtime/settings.json');
  });
});

describe('persistSettingsWrite', () => {
  it('writes to local settings before runtime settings and returns runtime result', () => {
    const writes: string[] = [];

    const result = persistSettingsWrite(
      (settingsFile) => {
        writes.push(settingsFile);
        return settingsFile;
      },
      {
        localSettingsFile: '/tmp/local-settings.json',
        runtimeSettingsFile: '/tmp/runtime-settings.json',
      },
    );

    expect(writes).toEqual(['/tmp/local-settings.json', '/tmp/runtime-settings.json']);
    expect(result).toBe('/tmp/runtime-settings.json');
  });

  it('does not attempt runtime write when local write fails', () => {
    const writes: string[] = [];

    expect(() =>
      persistSettingsWrite(
        (settingsFile) => {
          writes.push(settingsFile);
          if (settingsFile.includes('local')) {
            throw new Error('local write failed');
          }
          return settingsFile;
        },
        {
          localSettingsFile: '/tmp/local-settings.json',
          runtimeSettingsFile: '/tmp/runtime-settings.json',
        },
      ),
    ).toThrow('local write failed');

    expect(writes).toEqual(['/tmp/local-settings.json']);
  });
});
