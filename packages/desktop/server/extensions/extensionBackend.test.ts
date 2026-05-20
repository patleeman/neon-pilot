import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { invokeExtensionAction } from './extensionBackend.js';
import { resolveExtensionBackendLoadTarget, resolvePrebuiltSystemExtensionBackend } from './extensionBackendLoadTarget.js';
import { setExtensionEnabled } from './extensionRegistry.js';

const TEST_EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../extensions/system-auto-mode');

const ORIGINAL_STATE_ROOT = process.env.NEON_PILOT_STATE_ROOT;

afterEach(() => {
  if (ORIGINAL_STATE_ROOT === undefined) delete process.env.NEON_PILOT_STATE_ROOT;
  else process.env.NEON_PILOT_STATE_ROOT = ORIGINAL_STATE_ROOT;
});

describe('extension backend action invocation', () => {
  it('refuses to invoke actions from disabled extensions before loading backend code', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'disabled-action-ext');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'disabled-action-ext',
        name: 'Disabled Action Ext',
        backend: {
          entry: 'missing-backend.js',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    setExtensionEnabled('disabled-action-ext', false, stateRoot);

    await expect(invokeExtensionAction('disabled-action-ext', 'doThing', {})).resolves.toEqual({
      ok: false,
      error: 'Cannot invoke action "doThing": extension "disabled-action-ext" is disabled.',
    });
  });
});

describe('extension backend load targeting', () => {
  it('resolves prebuilt dist/backend.mjs for bundled system extensions', () => {
    const target = resolvePrebuiltSystemExtensionBackend({ source: 'system', packageRoot: TEST_EXTENSION_ROOT });

    expect(target).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });
    expect(target?.hash).toMatch(/^prebuilt:/);
  });

  it('loads built-output backend entries directly', () => {
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'dist/backend.mjs')).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });
  });

  it('resolves source manifest entries to built dist/backend.mjs artifacts', () => {
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'src/backend.ts')).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });

    expect(resolvePrebuiltSystemExtensionBackend({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT })).toBeNull();
  });
});
