import {
  createReadyAttentionEvent,
  loadAttentionEventsState,
  resolveAttentionEventsStateFile,
  saveAttentionEventsState,
} from '@neon-pilot/core';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  daemonRoot: '',
  cancelDurableRun: vi.fn(),
  clearDurableRunsListCache: vi.fn(),
}));

vi.mock('../automation/durableRuns.js', () => ({
  cancelDurableRun: mocks.cancelDurableRun,
  clearDurableRunsListCache: mocks.clearDurableRunsListCache,
}));

vi.mock('../config.js', () => ({
  loadDaemonConfig: () => ({ ipc: { socketPath: '/tmp/neon-pilot-test.sock' } }),
}));

vi.mock('../paths.js', () => ({
  resolveDaemonPaths: () => ({ root: mocks.daemonRoot }),
}));

import {
  appendDurableRunEvent,
  createDurableRunManifest,
  createInitialDurableRunStatus,
  resolveDurableRunPaths,
  resolveDurableRunsRoot,
  saveDurableRunCheckpoint,
  saveDurableRunManifest,
  saveDurableRunStatus,
  scanDurableRun,
} from '../runs/store.js';
import { cleanupDeletedConversationRuntime } from './conversationRunCleanup.js';

const tempDirs: string[] = [];
const originalStateRoot = process.env.NEON_PILOT_STATE_ROOT;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function writeRun(input: {
  runsRoot: string;
  runId: string;
  conversationId: string;
  sessionFile: string;
  status?: 'running' | 'completed';
}) {
  const paths = resolveDurableRunPaths(input.runsRoot, input.runId);
  saveDurableRunManifest(
    paths.manifestPath,
    createDurableRunManifest({
      id: input.runId,
      kind: 'raw-shell',
      resumePolicy: 'manual',
      createdAt: '2026-06-27T12:00:00.000Z',
      spec: {
        target: { type: 'shell', command: 'echo hi', cwd: '/repo' },
        metadata: {
          callbackConversation: {
            conversationId: input.conversationId,
            sessionFile: input.sessionFile,
            profile: 'shared',
          },
        },
      },
      source: {
        type: 'tool',
        id: input.conversationId,
        filePath: input.sessionFile,
      },
    }),
  );
  saveDurableRunStatus(
    paths.statusPath,
    createInitialDurableRunStatus({
      runId: input.runId,
      status: input.status ?? 'completed',
      createdAt: '2026-06-27T12:00:00.000Z',
      updatedAt: '2026-06-27T12:01:00.000Z',
    }),
  );
  saveDurableRunCheckpoint(paths.checkpointPath, {
    version: 1,
    runId: input.runId,
    updatedAt: '2026-06-27T12:01:00.000Z',
    payload: {
      conversationId: input.conversationId,
      sessionFile: input.sessionFile,
    },
  });
  await appendDurableRunEvent(paths.eventsPath, {
    version: 1,
    runId: input.runId,
    timestamp: '2026-06-27T12:00:30.000Z',
    type: 'started',
  });
  mkdirSync(paths.root, { recursive: true });
  writeFileSync(paths.outputLogPath, 'hello\n');
}

describe('cleanupDeletedConversationRuntime', () => {
  beforeEach(() => {
    mocks.daemonRoot = createTempDir('conversation-runtime-cleanup-daemon-');
    process.env.NEON_PILOT_STATE_ROOT = createTempDir('conversation-runtime-cleanup-state-');
    mocks.cancelDurableRun.mockResolvedValue({ ok: true, runId: 'run-active' });
    mocks.clearDurableRunsListCache.mockReset();
  });

  afterEach(async () => {
    if (originalStateRoot === undefined) {
      delete process.env.NEON_PILOT_STATE_ROOT;
    } else {
      process.env.NEON_PILOT_STATE_ROOT = originalStateRoot;
    }
    vi.clearAllMocks();
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('cancels active owned runs and removes owned run storage and attention events', async () => {
    const runsRoot = resolveDurableRunsRoot(mocks.daemonRoot);
    const deletedSessionFile = '/sessions/deleted.jsonl';
    const keptSessionFile = '/sessions/kept.jsonl';
    await writeRun({ runsRoot, runId: 'run-terminal', conversationId: 'deleted-conv', sessionFile: deletedSessionFile });
    await writeRun({
      runsRoot,
      runId: 'run-active',
      conversationId: 'deleted-conv',
      sessionFile: deletedSessionFile,
      status: 'running',
    });
    await writeRun({ runsRoot, runId: 'run-kept', conversationId: 'kept-conv', sessionFile: keptSessionFile });

    const attentionPath = resolveAttentionEventsStateFile();
    const attentionState = loadAttentionEventsState(attentionPath);
    createReadyAttentionEvent(attentionState, {
      id: 'background-run-run-terminal',
      sessionFile: deletedSessionFile,
      prompt: 'done',
      dueAt: '2026-06-27T12:01:00.000Z',
      createdAt: '2026-06-27T12:00:00.000Z',
      readyAt: '2026-06-27T12:01:00.000Z',
      attempts: 0,
      conversationId: 'deleted-conv',
      source: { kind: 'background-run', id: 'run-terminal' },
    });
    createReadyAttentionEvent(attentionState, {
      id: 'background-run-run-kept',
      sessionFile: keptSessionFile,
      prompt: 'done',
      dueAt: '2026-06-27T12:01:00.000Z',
      createdAt: '2026-06-27T12:00:00.000Z',
      readyAt: '2026-06-27T12:01:00.000Z',
      attempts: 0,
      conversationId: 'kept-conv',
      source: { kind: 'background-run', id: 'run-kept' },
    });
    saveAttentionEventsState(attentionState, attentionPath);

    await expect(cleanupDeletedConversationRuntime([{ id: 'deleted-conv', sessionFile: deletedSessionFile }])).resolves.toEqual({
      deletedRunIds: ['run-active', 'run-terminal'],
      cancelledRunIds: ['run-active'],
      removedAttentionEventIds: ['background-run-run-terminal'],
      failedCancellationRunIds: [],
    });

    expect(mocks.cancelDurableRun).toHaveBeenCalledWith('run-active');
    expect(mocks.clearDurableRunsListCache).toHaveBeenCalledTimes(1);
    expect(scanDurableRun(runsRoot, 'run-terminal')).toBeUndefined();
    expect(scanDurableRun(runsRoot, 'run-active')).toBeUndefined();
    expect(scanDurableRun(runsRoot, 'run-kept')).toBeDefined();
    expect(existsSync(resolveDurableRunPaths(runsRoot, 'run-terminal').root)).toBe(false);
    expect(loadAttentionEventsState(attentionPath).events).toEqual(
      expect.objectContaining({
        'background-run-run-kept': expect.objectContaining({ conversationId: 'kept-conv' }),
      }),
    );
    expect(loadAttentionEventsState(attentionPath).events['background-run-run-terminal']).toBeUndefined();
  });
});
