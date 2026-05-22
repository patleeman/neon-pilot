import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const daemon = vi.hoisted(() => ({ callDaemonExport: vi.fn() }));

vi.mock('./daemonBridge.js', () => daemon);

describe('backendApi/runs', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses deferred resume delays across supported units', async () => {
    const { parseDeferredResumeDelayMs } = await import('./runs.js');

    expect(parseDeferredResumeDelayMs('now + 30 seconds')).toBe(30_000);
    expect(parseDeferredResumeDelayMs('10m')).toBe(600_000);
    expect(parseDeferredResumeDelayMs('2 hours')).toBe(7_200_000);
    expect(parseDeferredResumeDelayMs('3d')).toBe(259_200_000);
    expect(parseDeferredResumeDelayMs('0m')).toBeUndefined();
    expect(parseDeferredResumeDelayMs('tomorrow')).toBeUndefined();
  });

  it('treats daemon ping failures as unavailable and forwards simple run operations', async () => {
    const runs = await import('./runs.js');
    daemon.callDaemonExport.mockRejectedValueOnce(new Error('offline'));
    await expect(runs.pingDaemon()).resolves.toBe(false);

    daemon.callDaemonExport.mockResolvedValueOnce(true);
    await expect(runs.pingDaemon()).resolves.toBe(true);

    daemon.callDaemonExport.mockResolvedValueOnce({ runs: [], summary: { total: 0 } });
    await expect(runs.listDurableRuns()).resolves.toEqual({ runs: [], summary: { total: 0 } });
    expect(daemon.callDaemonExport).toHaveBeenLastCalledWith('listDurableRuns');

    daemon.callDaemonExport.mockResolvedValueOnce({ accepted: true, runId: 'run-1' });
    await expect(runs.startBackgroundRun({ taskSlug: 'task' })).resolves.toEqual({ accepted: true, runId: 'run-1' });
    expect(daemon.callDaemonExport).toHaveBeenLastCalledWith('startBackgroundRun', { taskSlug: 'task' });
  });

  it('returns undefined for missing runs but rethrows unrelated daemon errors', async () => {
    const { getDurableRun } = await import('./runs.js');

    daemon.callDaemonExport.mockRejectedValueOnce(new Error('Run not found: run-1'));
    await expect(getDurableRun('run-1')).resolves.toBeUndefined();

    daemon.callDaemonExport.mockRejectedValueOnce(new Error('daemon exploded'));
    await expect(getDurableRun('run-2')).rejects.toThrow('daemon exploded');
  });

  it('reads bounded run logs from the output log path', async () => {
    const dir = join(tmpdir(), `runs-api-test-${process.pid}`);
    const logPath = join(dir, 'output.log');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(logPath, ['one', 'two', 'three', 'four'].join('\n'));

    try {
      const { getDurableRunLog } = await import('./runs.js');
      daemon.callDaemonExport.mockResolvedValueOnce({ run: { paths: { outputLogPath: logPath } } });

      await expect(getDurableRunLog('run-1', 2)).resolves.toEqual({ path: logPath, log: 'three\nfour' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('normalizes scheduled task thread binding before ensuring threads', async () => {
    const { applyScheduledTaskThreadBinding } = await import('./runs.js');
    daemon.callDaemonExport.mockResolvedValueOnce({ id: 'task-1', threadMode: 'dedicated' });
    daemon.callDaemonExport.mockResolvedValueOnce({ id: 'task-1', threadConversationId: 'new-conv' });

    await expect(applyScheduledTaskThreadBinding('task-1', { threadMode: 'weird', dbPath: '/db.sqlite' })).resolves.toEqual({
      id: 'task-1',
      threadConversationId: 'new-conv',
    });

    expect(daemon.callDaemonExport).toHaveBeenNthCalledWith(1, 'setStoredAutomationThreadBinding', 'task-1', {
      dbPath: '/db.sqlite',
      mode: 'dedicated',
      conversationId: undefined,
      sessionFile: undefined,
    });
    expect(daemon.callDaemonExport).toHaveBeenNthCalledWith(2, 'ensureAutomationThread', 'task-1', { dbPath: '/db.sqlite' });

    daemon.callDaemonExport.mockClear();
    daemon.callDaemonExport.mockResolvedValueOnce({ id: 'task-1', threadMode: 'none' });
    await expect(applyScheduledTaskThreadBinding('task-1', { threadMode: 'none' })).resolves.toEqual({ id: 'task-1', threadMode: 'none' });
    expect(daemon.callDaemonExport).toHaveBeenCalledTimes(1);
  });
});
