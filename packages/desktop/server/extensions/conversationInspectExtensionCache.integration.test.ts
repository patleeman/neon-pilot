import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { invokeExtensionAction, reloadExtensionBackend } from './extensionBackend.js';

const previousRepoRoot = process.env.NEON_PILOT_REPO_ROOT;
const previousStateRoot = process.env.NEON_PILOT_STATE_ROOT;
const tempRoots: string[] = [];

function makeTempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeWorker(path: string, source: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, source);
}

function restoreEnv(name: 'NEON_PILOT_REPO_ROOT' | 'NEON_PILOT_STATE_ROOT', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restoreEnv('NEON_PILOT_REPO_ROOT', previousRepoRoot);
  restoreEnv('NEON_PILOT_STATE_ROOT', previousStateRoot);

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('conversation inspect extension cache integration', () => {
  it('loads the cached extension backend but spawns the bundled repo worker, not an extension-cache sibling', async () => {
    const stateRoot = makeTempRoot('pa-conversation-inspect-cache-state-');
    const workerRepoRoot = makeTempRoot('pa-conversation-inspect-worker-repo-');
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    process.env.NEON_PILOT_REPO_ROOT = process.cwd();

    const reload = await reloadExtensionBackend('system-conversation-tools');
    expect(reload.ok).toBe(true);
    await reloadExtensionBackend('system-conversation-tools');

    const brokenCachedWorkerPath = join(stateRoot, 'extension-cache/conversations/conversationInspectWorker.js');
    writeWorker(
      brokenCachedWorkerPath,
      `import { parentPort } from 'node:worker_threads'; parentPort?.postMessage({ id: 1, ok: false, error: 'used cached worker' });`,
    );

    const bundledWorkerPath = join(workerRepoRoot, 'packages/desktop/server/dist/conversations/conversationInspectWorker.js');
    writeWorker(
      bundledWorkerPath,
      `import { parentPort } from 'node:worker_threads'; parentPort?.on('message', (request) => parentPort.postMessage({ id: request.id, ok: true, action: request.action, result: { source: 'repo-worker' }, text: 'repo worker text' }));`,
    );
    process.env.NEON_PILOT_REPO_ROOT = workerRepoRoot;

    const action = await invokeExtensionAction(
      'system-conversation-tools',
      'conversationTool',
      {
        action: 'inspect',
        inspectAction: 'list',
        scope: 'live',
      },
      { getRuntimeScope: () => 'assistant' } as never,
      { sessionId: 'current-conversation' } as never,
    );
    expect(action).toMatchObject({ ok: true });
    const result = action.ok ? (action.result as { content?: Array<{ text?: string }> }) : { content: [] };

    expect(result.content?.[0]?.text).not.toBe('used cached worker');
    expect(result.content?.[0]?.text).toContain('No conversations matched');
  }, 30000);
});
