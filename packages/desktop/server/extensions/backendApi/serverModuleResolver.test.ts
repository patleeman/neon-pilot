import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  callServerModuleExport,
  normalizeServerExtensionModuleSpecifier,
  normalizeServerModuleSpecifier,
  resolveServerModuleSpecifierFrom,
} from './serverModuleResolver.js';

const originalCwd = process.cwd();
const originalRepoRoot = process.env.NEON_PILOT_REPO_ROOT;

describe('backendApi/serverModuleResolver', () => {
  const dir = join(tmpdir(), `server-module-resolver-${process.pid}`);

  beforeEach(() => {
    vi.resetModules();
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    delete process.env.NEON_PILOT_REPO_ROOT;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalRepoRoot === undefined) delete process.env.NEON_PILOT_REPO_ROOT;
    else process.env.NEON_PILOT_REPO_ROOT = originalRepoRoot;
    rmSync(dir, { recursive: true, force: true });
  });

  it('normalizes server and extension module specifiers', () => {
    expect(normalizeServerModuleSpecifier('../../conversations/liveSessions.js')).toBe('conversations/liveSessions.js');
    expect(normalizeServerModuleSpecifier('/shared/appEvents.js')).toBe('shared/appEvents.js');
    expect(normalizeServerExtensionModuleSpecifier('../extensionLifecycle.js')).toBe('extensions/extensionLifecycle.js');
    expect(normalizeServerExtensionModuleSpecifier('/extensionRegistry.js')).toBe('extensionRegistry.js');
  });

  it('resolves relative modules from repo dist roots before falling back to the raw specifier', () => {
    const repoRoot = join(dir, 'repo');
    const target = join(repoRoot, 'packages/desktop/server/dist/conversations/liveSessions.js');
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, 'export const marker = true;');
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;

    expect(
      resolveServerModuleSpecifierFrom({
        importMetaUrl: pathToFileURL(join(repoRoot, 'packages/desktop/server/extensions/backendApi/index.js')).href,
        relativeSpecifier: '../../conversations/liveSessions.js',
      }),
    ).toBe(pathToFileURL(target).href);
  });

  it('resolves known package entries from repo roots', () => {
    const repoRoot = join(dir, 'repo');
    const target = join(repoRoot, 'packages/desktop/server/dist/core/index.js');
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, 'export const marker = true;');
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;

    expect(
      resolveServerModuleSpecifierFrom({
        importMetaUrl: pathToFileURL(join(repoRoot, 'x.js')).href,
        relativeSpecifier: '@neon-pilot/core',
      }),
    ).toBe(pathToFileURL(target).href);
  });

  it('returns the raw specifier when no candidate exists', () => {
    process.chdir(dir);
    expect(
      resolveServerModuleSpecifierFrom({
        importMetaUrl: pathToFileURL(join(dir, 'source.js')).href,
        relativeSpecifier: '../../missing.js',
      }),
    ).toBe('../../missing.js');
    expect(
      resolveServerModuleSpecifierFrom({ importMetaUrl: pathToFileURL(join(dir, 'source.js')).href, relativeSpecifier: 'unknown-package' }),
    ).toBe('unknown-package');
  });

  it('calls resolved module exports and reports unavailable exports clearly', async () => {
    const modulePath = join(dir, 'module.mjs');
    writeFileSync(modulePath, 'export function greet(name) { return `hello ${name}`; }');

    await expect(callServerModuleExport(pathToFileURL(modulePath).href, 'greet', 'Patrick')).resolves.toBe('hello Patrick');
    await expect(callServerModuleExport(pathToFileURL(modulePath).href, 'missing')).rejects.toThrow(
      'Backend API export missing is unavailable.',
    );
  });
});
