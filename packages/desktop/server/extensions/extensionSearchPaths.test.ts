import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ADDITIONAL_EXTENSION_PATHS_SETTING, readConfiguredExtensionPaths, readEnvironmentExtensionPaths } from './extensionSearchPaths.js';

describe('extensionSearchPaths', () => {
  const stateRoot = join(tmpdir(), `extension-search-paths-${randomUUID()}`);
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEON_PILOT_EXTENSION_PATHS;
    rmSync(stateRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('returns no configured extension paths when settings are missing, malformed, or unreadable', () => {
    expect(readConfiguredExtensionPaths(stateRoot)).toEqual([]);

    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), '{bad json', 'utf-8');
    expect(readConfiguredExtensionPaths(stateRoot)).toEqual([]);

    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify(['not-a-record']), 'utf-8');
    expect(readConfiguredExtensionPaths(stateRoot)).toEqual([]);
  });

  it('reads configured extension paths from strings, arrays, commas, and newlines', () => {
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(
      join(stateRoot, 'settings.json'),
      JSON.stringify({
        [ADDITIONAL_EXTENSION_PATHS_SETTING]: [' /one, /two\n/three ', 42, '/four'],
      }),
      'utf-8',
    );

    expect(readConfiguredExtensionPaths(stateRoot)).toEqual(['/one', '/two', '/three', '/four']);
  });

  it('reads environment extension paths from colon, comma, and newline separated values', () => {
    process.env.NEON_PILOT_EXTENSION_PATHS = ' /one:/two, /three\n/four :: ';

    expect(readEnvironmentExtensionPaths()).toEqual(['/one', '/two', '/three', '/four']);
  });
});
