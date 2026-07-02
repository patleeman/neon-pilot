import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bindInProcessDaemonClient,
  clearDaemonClientTransportOverride,
  createInProcessDaemonClient,
  getDaemonClientTransportOverride,
  setDaemonClientTransportOverride,
} from './in-process-client.js';

describe('in-process daemon client', () => {
  beforeEach(() => {
    clearDaemonClientTransportOverride();
  });

  function daemon() {
    return {
      isRunning: vi.fn(() => true),
      getStatus: vi.fn(() => ({ running: true })),
      requestStop: vi.fn(),
      listDurableRuns: vi.fn(() => ({ runs: [], summary: { total: 0 } })),
      getDurableRun: vi.fn((runId: string) => (runId === 'missing' ? null : { run: { runId } })),
      startScheduledTaskRun: vi.fn((taskId: string) => ({ accepted: true, runId: `run-${taskId}` })),
      startBackgroundRun: vi.fn((input) => ({ accepted: true, runId: 'background', input })),
      cancelBackgroundRun: vi.fn((runId: string) => ({ cancelled: true, runId })),
      rerunBackgroundRun: vi.fn((runId: string) => ({ accepted: true, runId: `rerun-${runId}` })),
      followUpBackgroundRun: vi.fn((runId: string, prompt?: string) => ({ accepted: true, runId: `follow-${runId}`, prompt })),
      syncWebLiveConversationRun: vi.fn((input) => ({ ok: true, input })),
      listRecoverableWebLiveConversationRuns: vi.fn(() => ({ runs: [] })),
      publishEvent: vi.fn(() => true),
    };
  }

  it('sets, gets, and clears explicit transport overrides', () => {
    const transport = { ping: vi.fn() } as never;
    setDaemonClientTransportOverride(transport);
    expect(getDaemonClientTransportOverride()).toBe(transport);
    clearDaemonClientTransportOverride();
    expect(getDaemonClientTransportOverride()).toBeUndefined();
  });

  it('binds an in-process daemon transport and only clears its own binding', () => {
    const d = daemon();
    const dispose = bindInProcessDaemonClient(d as never);
    const bound = getDaemonClientTransportOverride();
    expect(bound).toBeDefined();

    const replacement = { ping: vi.fn() } as never;
    setDaemonClientTransportOverride(replacement);
    dispose();
    expect(getDaemonClientTransportOverride()).toBe(replacement);

    const disposeReplacement = bindInProcessDaemonClient(d as never);
    expect(getDaemonClientTransportOverride()).not.toBe(replacement);
    disposeReplacement();
    expect(getDaemonClientTransportOverride()).toBeUndefined();
  });

  it('adapts daemon methods to the transport interface', async () => {
    const d = daemon();
    const transport = createInProcessDaemonClient(d as never);

    await expect(transport.ping()).resolves.toBe(true);
    await expect(transport.getStatus()).resolves.toEqual({ running: true });
    await expect(transport.listDurableRuns()).resolves.toEqual({ runs: [], summary: { total: 0 } });
    await expect(transport.getDurableRun('run-1')).resolves.toEqual({ run: { runId: 'run-1' } });
    await expect(transport.startScheduledTaskRun('task-1')).resolves.toEqual({ accepted: true, runId: 'run-task-1' });
    await expect(transport.startBackgroundRun({ taskSlug: 'task', cwd: '/repo' } as never)).resolves.toMatchObject({
      accepted: true,
      runId: 'background',
    });
    await expect(transport.cancelDurableRun('run-1')).resolves.toEqual({ cancelled: true, runId: 'run-1' });
    await expect(transport.rerunDurableRun('run-1')).resolves.toEqual({ accepted: true, runId: 'rerun-run-1' });
    await expect(transport.followUpDurableRun('run-1', 'continue')).resolves.toEqual({
      accepted: true,
      runId: 'follow-run-1',
      prompt: 'continue',
    });
    await expect(transport.syncWebLiveConversationRunState({ conversationId: 'conv-1' } as never)).resolves.toMatchObject({ ok: true });
    await expect(transport.listRecoverableWebLiveConversationRuns()).resolves.toEqual({ runs: [] });
    await expect(transport.emitEvent({ type: 'event' } as never)).resolves.toBe(true);
    await transport.stop();
    expect(d.requestStop).toHaveBeenCalledOnce();
  });

  it('throws a clear error for missing durable runs', async () => {
    const transport = createInProcessDaemonClient(daemon() as never);
    await expect(transport.getDurableRun('missing')).rejects.toThrow('Run not found: missing');
  });
});
