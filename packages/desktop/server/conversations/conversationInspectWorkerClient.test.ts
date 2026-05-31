import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chdir } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveConversationInspectWorkerUrlFrom } from './conversationInspectWorkerClient.js';

const previousRepoRoot = process.env.NEON_PILOT_REPO_ROOT;
const originalCwd = process.cwd();
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'pa-conversation-inspect-worker-'));
  tempRoots.push(root);
  return root;
}

function touch(path: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, '');
}

afterEach(() => {
  vi.unstubAllGlobals();
  chdir(originalCwd);

  if (previousRepoRoot === undefined) {
    delete process.env.NEON_PILOT_REPO_ROOT;
  } else {
    process.env.NEON_PILOT_REPO_ROOT = previousRepoRoot;
  }

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('resolveConversationInspectWorkerUrlFrom', () => {
  it('uses the relative worker next to the server bundle outside extension cache', () => {
    const root = makeTempRoot();
    const clientPath = join(root, 'server/dist/app/localApi.js');
    const relativeWorkerPath = join(root, 'server/dist/conversations/conversationInspectWorker.js');
    touch(clientPath);
    touch(relativeWorkerPath);

    const workerUrl = resolveConversationInspectWorkerUrlFrom(pathToFileURL(clientPath).href);

    expect(workerUrl.href).toBe(pathToFileURL(relativeWorkerPath).href);
  });

  it('skips the transpiled tsc worker and uses the bundled repo worker', () => {
    const root = makeTempRoot();
    const repoRoot = makeTempRoot();
    const clientPath = join(root, 'packages/desktop/dist/server/conversations/conversationInspectWorkerClient.js');
    const tscWorkerPath = join(root, 'packages/desktop/dist/server/conversations/conversationInspectWorker.js');
    const bundledWorkerPath = join(repoRoot, 'packages/desktop/server/dist/conversations/conversationInspectWorker.js');
    touch(clientPath);
    touch(tscWorkerPath);
    touch(bundledWorkerPath);
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;

    const workerUrl = resolveConversationInspectWorkerUrlFrom(pathToFileURL(clientPath).href);

    expect(workerUrl.href).toBe(pathToFileURL(bundledWorkerPath).href);
  });

  it('skips the extension-cache sibling worker and uses the bundled repo worker', () => {
    const cacheRoot = makeTempRoot();
    const repoRoot = makeTempRoot();
    const clientPath = join(cacheRoot, 'extension-cache/conversations/backend.mjs');
    const cachedWorkerPath = join(cacheRoot, 'extension-cache/conversations/conversationInspectWorker.js');
    const bundledWorkerPath = join(repoRoot, 'packages/desktop/server/dist/conversations/conversationInspectWorker.js');
    touch(clientPath);
    touch(cachedWorkerPath);
    touch(bundledWorkerPath);
    process.env.NEON_PILOT_REPO_ROOT = repoRoot;

    const workerUrl = resolveConversationInspectWorkerUrlFrom(pathToFileURL(clientPath).href);

    expect(workerUrl.href).toBe(pathToFileURL(bundledWorkerPath).href);
  });

  it('uses the bundled worker path in packaged extension builds', () => {
    const resourcesRoot = makeTempRoot();
    const clientPath = join(resourcesRoot, 'extensions/system-conversation-tools/dist/backend.mjs');
    const bundledWorkerPath = join(resourcesRoot, 'server/dist/conversations/conversationInspectWorker.js');
    touch(clientPath);
    touch(bundledWorkerPath);
    chdir(resourcesRoot);

    const workerUrl = resolveConversationInspectWorkerUrlFrom(pathToFileURL(clientPath).href);

    expect(realpathSync(fileURLToPath(workerUrl))).toBe(realpathSync(bundledWorkerPath));
  });
});
