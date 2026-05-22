import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearDurableRunsListCache } from '../automation/durableRuns.js';
import type { DaemonConfig } from '../config.js';
import { NeonPilotDaemon } from '../daemon/server.js';
import { getExecution, listConversationExecutions } from './executionService.js';

const tempDirs: string[] = [];
const originalSocketPath = process.env.NEON_PILOT_DAEMON_SOCKET_PATH;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTestConfig(socketPath: string): DaemonConfig {
  return {
    logLevel: 'error',
    queue: { maxDepth: 100 },
    ipc: { socketPath },
    modules: {
      maintenance: { enabled: false, cleanupIntervalMinutes: 60 },
      tasks: {
        enabled: false,
        taskDir: join(createTempDir('pa-executions-e2e-tasks-'), 'definitions'),
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
    },
  };
}

async function waitFor<T>(producer: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let latest = await producer();

  while (!predicate(latest)) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for condition. Latest value: ${JSON.stringify(latest)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    latest = await producer();
  }

  return latest;
}

afterEach(async () => {
  if (originalSocketPath === undefined) {
    delete process.env.NEON_PILOT_DAEMON_SOCKET_PATH;
  } else {
    process.env.NEON_PILOT_DAEMON_SOCKET_PATH = originalSocketPath;
  }
  clearDurableRunsListCache();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('conversation execution truth e2e', () => {
  it('reports a real short-lived background command as active only while it is running', async () => {
    const conversationId = 'conv-active-truth';
    const cwd = createTempDir('pa-executions-e2e-cwd-');
    const socketPath = join(createTempDir('pa-executions-e2e-daemon-'), 'daemon.sock');
    process.env.NEON_PILOT_DAEMON_SOCKET_PATH = socketPath;
    const daemon = new NeonPilotDaemon({ config: createTestConfig(socketPath), stopRequestBehavior: 'reject' });

    const started = await daemon.startBackgroundRun({
      taskSlug: 'active-truth-smoke',
      cwd,
      shellCommand: `${process.execPath} -e "setTimeout(() => {}, 250)"`,
      source: { type: 'tool', id: conversationId },
      manifestMetadata: { title: 'Active truth smoke' },
    });

    expect(started.accepted).toBe(true);
    clearDurableRunsListCache();

    const active = await listConversationExecutions(conversationId, { active: true, visibility: 'primary' });
    expect(active.primary.map((execution) => execution.id)).toContain(started.runId);
    expect(active.primary.find((execution) => execution.id === started.runId)).toMatchObject({
      kind: 'background-command',
      status: 'running',
      title: 'Active truth smoke',
    });

    await waitFor(
      async () => {
        clearDurableRunsListCache();
        return listConversationExecutions(conversationId, { active: true, visibility: 'primary' });
      },
      (result) => result.primary.every((execution) => execution.id !== started.runId),
    );

    clearDurableRunsListCache();
    const detail = await getExecution(started.runId);
    expect(detail?.execution).toMatchObject({
      id: started.runId,
      kind: 'background-command',
      status: 'completed',
      conversationId,
      capabilities: expect.objectContaining({ canRerun: true, canCancel: false }),
    });
  });
});
