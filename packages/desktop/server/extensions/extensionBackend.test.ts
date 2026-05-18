import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { invokeExtensionAction } from './extensionBackend.js';
import {
  isPrebuiltOnlyExtensionRuntime,
  resolveExtensionBackendLoadTarget,
  resolvePrebuiltSystemExtensionBackend,
  shouldPreferPrebuiltSystemExtensionBackend,
} from './extensionBackendLoadTarget.js';
import { setExtensionEnabled } from './extensionRegistry.js';

const TEST_EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../extensions/system-auto-mode');

const ORIGINAL_STATE_ROOT = process.env.PERSONAL_AGENT_STATE_ROOT;

afterEach(() => {
  if (ORIGINAL_STATE_ROOT === undefined) delete process.env.PERSONAL_AGENT_STATE_ROOT;
  else process.env.PERSONAL_AGENT_STATE_ROOT = ORIGINAL_STATE_ROOT;
});

describe('extension backend action invocation', () => {
  it('refuses to invoke actions from disabled extensions before loading backend code', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.PERSONAL_AGENT_STATE_ROOT = stateRoot;
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
  it('prefers prebuilt system backends unless extension authoring mode is explicit', () => {
    expect(shouldPreferPrebuiltSystemExtensionBackend({ resourcesPath: undefined, env: {} })).toBe(true);
    expect(isPrebuiltOnlyExtensionRuntime({ resourcesPath: undefined, env: {} })).toBe(false);
    expect(
      shouldPreferPrebuiltSystemExtensionBackend({
        resourcesPath: '/Applications/Personal Agent.app/Contents/Resources',
        env: { PERSONAL_AGENT_DESKTOP_DEV_BUNDLE: '1' },
      }),
    ).toBe(true);
    expect(
      shouldPreferPrebuiltSystemExtensionBackend({
        resourcesPath: '/Applications/Personal Agent.app/Contents/Resources',
        env: { PERSONAL_AGENT_EXTENSION_AUTHORING: '1' },
      }),
    ).toBe(false);
    expect(
      isPrebuiltOnlyExtensionRuntime({
        resourcesPath: '/Applications/Personal Agent.app/Contents/Resources',
        env: {},
      }),
    ).toBe(true);
  });

  it('resolves prebuilt dist/backend.mjs for packaged bundled system extensions', () => {
    const target = resolvePrebuiltSystemExtensionBackend(
      { source: 'system', packageRoot: TEST_EXTENSION_ROOT },
      {
        resourcesPath: '/Applications/Personal Agent.app/Contents/Resources',
        env: {},
      },
    );

    expect(target).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });
    expect(target?.hash).toMatch(/^prebuilt:/);
  });

  it('loads built-output backend entries directly in dev and packaged runtimes', () => {
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'dist/backend.mjs')).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });

    expect(
      resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'dist/backend.mjs', {
        resourcesPath: '/Applications/Personal Agent.app/Contents/Resources',
        env: {},
      }),
    ).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });
  });

  it('does not bypass source rebuilds for source-backed runtime extensions or extension authoring mode', () => {
    expect(
      resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'src/backend.ts', {
        resourcesPath: '/Applications/Personal Agent.app/Contents/Resources',
        env: {},
      }),
    ).toBeNull();

    expect(
      resolvePrebuiltSystemExtensionBackend(
        { source: 'runtime', packageRoot: TEST_EXTENSION_ROOT },
        {
          resourcesPath: '/Applications/Personal Agent.app/Contents/Resources',
          env: {},
        },
      ),
    ).toBeNull();

    expect(
      resolvePrebuiltSystemExtensionBackend(
        { source: 'system', packageRoot: TEST_EXTENSION_ROOT },
        {
          resourcesPath: '/Applications/Personal Agent.app/Contents/Resources',
          env: { PERSONAL_AGENT_EXTENSION_AUTHORING: '1' },
        },
      ),
    ).toBeNull();
  });
});
