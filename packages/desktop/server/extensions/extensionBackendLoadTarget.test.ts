import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isSourceExtensionBackendEntry,
  resolveExtensionBackendLoadTarget,
  resolvePrebuiltSystemExtensionBackend,
} from './extensionBackendLoadTarget.js';

describe('extensionBackendLoadTarget', () => {
  const packageRoot = join(tmpdir(), `extension-backend-load-target-${randomUUID()}`);

  beforeEach(() => {
    rmSync(packageRoot, { recursive: true, force: true });
    mkdirSync(join(packageRoot, 'dist'), { recursive: true });
  });

  afterEach(() => {
    rmSync(packageRoot, { recursive: true, force: true });
  });

  it('identifies source backend entries that should load the prebuilt bundle', () => {
    expect(isSourceExtensionBackendEntry('src/backend.ts')).toBe(true);
    expect(isSourceExtensionBackendEntry(' backend.tsx ')).toBe(true);
    expect(isSourceExtensionBackendEntry('backend.mts')).toBe(true);
    expect(isSourceExtensionBackendEntry('backend.cts')).toBe(true);
    expect(isSourceExtensionBackendEntry('dist/backend.mjs')).toBe(false);
  });

  it('resolves source backend entries to dist/backend.mjs when the prebuilt file exists', () => {
    const prebuilt = join(packageRoot, 'dist', 'backend.mjs');
    writeFileSync(prebuilt, 'export default {}', 'utf-8');

    const target = resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot }, ' src/backend.ts ');

    expect(target).toEqual({ path: prebuilt, hash: expect.stringMatching(/^prebuilt:\d+:/) });
  });

  it('resolves non-source backend entries relative to the package root', () => {
    const custom = join(packageRoot, 'build', 'custom.mjs');
    mkdirSync(join(packageRoot, 'build'), { recursive: true });
    writeFileSync(custom, 'export default {}', 'utf-8');

    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot }, 'build/custom.mjs')).toEqual({
      path: custom,
      hash: expect.stringMatching(/^prebuilt:\d+:/),
    });
  });

  it('returns null when package roots, entries, or files are missing', () => {
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime' }, 'src/backend.ts')).toBeNull();
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot }, '   ')).toBeNull();
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot }, 'src/backend.ts')).toBeNull();
  });

  it('only resolves prebuilt system extension backends for system entries', () => {
    const prebuilt = join(packageRoot, 'dist', 'backend.mjs');
    writeFileSync(prebuilt, 'export default {}', 'utf-8');

    expect(resolvePrebuiltSystemExtensionBackend({ source: 'runtime', packageRoot })).toBeNull();
    expect(resolvePrebuiltSystemExtensionBackend({ source: 'system' })).toBeNull();
    expect(resolvePrebuiltSystemExtensionBackend({ source: 'system', packageRoot })).toEqual({
      path: prebuilt,
      hash: expect.stringMatching(/^prebuilt:\d+:/),
    });
  });
});
