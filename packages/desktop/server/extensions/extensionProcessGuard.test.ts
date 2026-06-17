import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertExtensionBackendNativeImportsAllowed,
  ExtensionBackendNativeImportBlockedError,
  ExtensionProcessTerminationBlockedError,
  withExtensionProcessGuard,
} from './extensionProcessGuard.js';

describe('extensionProcessGuard', () => {
  it('allows normal async work and returns the callback result', async () => {
    await expect(withExtensionProcessGuard('ext', 'startup', async () => 'ok')).resolves.toBe('ok');
  });

  it('blocks process.exit inside guarded extension work', async () => {
    await expect(
      withExtensionProcessGuard('ext', 'startup', async () => {
        process.exit(1);
      }),
    ).rejects.toMatchObject({
      name: 'ExtensionProcessTerminationBlockedError',
      extensionId: 'ext',
      operation: 'startup',
      api: 'process.exit',
    });
  });

  it('blocks process.abort inside guarded extension work', async () => {
    await expect(
      withExtensionProcessGuard('ext', 'health check', async () => {
        process.abort();
      }),
    ).rejects.toBeInstanceOf(ExtensionProcessTerminationBlockedError);
  });

  it('blocks process.kill only when the extension targets the current process', async () => {
    await expect(
      withExtensionProcessGuard('ext', 'handler', async () => {
        process.kill(process.pid, 0);
      }),
    ).rejects.toMatchObject({ api: 'process.kill(process.pid)' });
  });

  it('blocks forbidden native imports in backend entry modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neon-pilot-extension-process-guard-'));
    const entryPath = join(root, 'backend.mjs');
    writeFileSync(entryPath, `import { execFile } from 'node:child_process';\nexport function ping() { return execFile; }\n`);

    await expect(assertExtensionBackendNativeImportsAllowed('ext', 'backend import', entryPath)).rejects.toMatchObject({
      name: 'ExtensionBackendNativeImportBlockedError',
      extensionId: 'ext',
      operation: 'backend import',
      specifier: 'node:child_process',
      path: entryPath,
    });
  });

  it('blocks forbidden native imports in relative transitive backend modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'neon-pilot-extension-process-guard-'));
    mkdirSync(join(root, 'lib'), { recursive: true });
    const entryPath = join(root, 'backend.mjs');
    const childPath = join(root, 'lib', 'child.mjs');
    writeFileSync(entryPath, `import './lib/child.mjs';\nexport function ping() { return true; }\n`);
    writeFileSync(childPath, `import { Worker } from 'node:worker_threads';\nexport const worker = Worker;\n`);

    await expect(assertExtensionBackendNativeImportsAllowed('ext', 'backend import', entryPath)).rejects.toBeInstanceOf(
      ExtensionBackendNativeImportBlockedError,
    );
  });
});
