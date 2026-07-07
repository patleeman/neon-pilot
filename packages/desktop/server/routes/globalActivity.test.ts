import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listConversationSessionsSnapshotMock, listExecutionsMock, logErrorMock } = vi.hoisted(() => ({
  listConversationSessionsSnapshotMock: vi.fn(),
  listExecutionsMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock('../conversations/conversationService.js', () => ({
  listConversationSessionsSnapshot: listConversationSessionsSnapshotMock,
}));

vi.mock('../executions/executionService.js', () => ({
  listExecutions: listExecutionsMock,
}));

vi.mock('../middleware/index.js', () => ({
  logError: logErrorMock,
}));

import { ACTIVITY_COLLECTION, ACTIVITY_OWNER } from '../activity/activityEntries.js';
import { getDocumentsStore, resetDocumentsStoreSingleton } from '../documents/store.js';
import { registerGlobalActivityRoutes } from './globalActivity.js';

describe('registerGlobalActivityRoutes', () => {
  let tempRoots: string[] = [];

  beforeEach(() => {
    listConversationSessionsSnapshotMock.mockReset();
    listExecutionsMock.mockReset();
    logErrorMock.mockReset();
  });

  afterEach(() => {
    resetDocumentsStoreSingleton();
    for (const root of tempRoots) {
      rmSync(root, { recursive: true, force: true });
    }
    tempRoots = [];
  });

  function createHarness() {
    const handlers: Record<string, (req: unknown, res: unknown) => Promise<void> | void> = {};
    const router = {
      get: vi.fn((path: string, next: (req: unknown, res: unknown) => Promise<void> | void) => {
        handlers[`GET ${path}`] = next;
      }),
    };

    registerGlobalActivityRoutes(router as never);

    return {
      activityHandler: handlers['GET /api/activity']!,
    };
  }

  function createHarnessWithDocuments() {
    const stateRoot = mkdtempSync(join(tmpdir(), 'global-activity-docs-test-'));
    tempRoots.push(stateRoot);
    const desktopRootLayout = resolveDesktopRootLayout({ root: join(stateRoot, 'desktop-root') });
    const handlers: Record<string, (req: unknown, res: unknown) => Promise<void> | void> = {};
    const router = {
      get: vi.fn((path: string, next: (req: unknown, res: unknown) => Promise<void> | void) => {
        handlers[`GET ${path}`] = next;
      }),
    };

    registerGlobalActivityRoutes(router as never, {
      getStateRoot: () => stateRoot,
      getDesktopRootLayout: () => desktopRootLayout,
    });

    return {
      activityHandler: handlers['GET /api/activity']!,
      store: getDocumentsStore(stateRoot, desktopRootLayout),
    };
  }

  function createJsonResponse() {
    const status = vi.fn().mockReturnThis();
    return {
      status,
      json: vi.fn(),
      // Express Response also has these; include them so spies pass through
      setHeader: vi.fn(),
      type: vi.fn(),
      send: vi.fn(),
    };
  }

  function session(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      file: `/sessions/${id}.jsonl`,
      timestamp: '2026-06-19T12:00:00.000Z',
      cwd: '/repo',
      cwdSlug: 'repo',
      model: 'model',
      title: `Conversation ${id}`,
      messageCount: 1,
      ...overrides,
    };
  }

  function execution(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      kind: 'background-command',
      title: `Execution ${id}`,
      status: 'completed',
      visibility: 'primary',
      capabilities: { canCancel: false, canRerun: true, canFollowUp: false, hasLog: true, hasResult: false },
      ...overrides,
    };
  }

  function findItem(call: { items: Array<{ id: string }> }, id: string) {
    return call.items.find((item) => item.id === id);
  }

  it('returns an empty activity feed when there is no data', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([]);
    listExecutionsMock.mockResolvedValue({ executions: [] });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    expect(res.json).toHaveBeenCalledWith({ items: [], total: 0 });
  });

  it('returns conversations and executions merged in recency order', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([
      session('conv-1', { timestamp: '2026-06-19T11:00:00.000Z', lastActivityAt: '2026-06-19T14:00:00.000Z' }),
      session('conv-2', { timestamp: '2026-06-19T10:00:00.000Z', lastActivityAt: '2026-06-19T13:00:00.000Z' }),
    ]);
    listExecutionsMock.mockResolvedValue({
      executions: [
        execution('run-1', {
          conversationId: 'conv-1',
          status: 'running',
          updatedAt: '2026-06-19T15:00:00.000Z',
        }),
        execution('run-2', {
          conversationId: 'conv-2',
          status: 'completed',
          updatedAt: '2026-06-19T12:00:00.000Z',
        }),
      ],
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 4,
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'execution:run-1', kind: 'execution', status: 'running', conversationId: 'conv-1' }),
          expect.objectContaining({ id: 'execution:run-2', kind: 'execution', status: 'completed', conversationId: 'conv-2' }),
          expect.objectContaining({ id: 'conversation:conv-1', kind: 'conversation', title: 'Conversation conv-1' }),
          expect.objectContaining({ id: 'conversation:conv-2', kind: 'conversation', title: 'Conversation conv-2' }),
        ]),
      }),
    );

    // Verify ordering: most recent updatedAt first
    const call = res.json.mock.calls[0][0] as { items: Array<{ id: string }> };
    expect(call.items[0].id).toBe('execution:run-1');
    expect(call.items[1].id).toBe('conversation:conv-1');
    expect(call.items[2].id).toBe('conversation:conv-2');
    expect(call.items[3].id).toBe('execution:run-2');
  });

  it('limits the number of returned items', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([session('conv-1'), session('conv-2')]);
    listExecutionsMock.mockResolvedValue({ executions: [] });

    const res = createJsonResponse();
    await activityHandler({ query: { limit: '1' } }, res);

    const call = res.json.mock.calls[0][0] as { items: unknown[]; total: number };
    expect(call.items).toHaveLength(1);
    expect(call.total).toBe(2);
  });

  it('filters by kind when specified', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([session('conv-1')]);
    listExecutionsMock.mockResolvedValue({
      executions: [execution('run-1', { conversationId: 'conv-1' })],
    });

    const res = createJsonResponse();
    await activityHandler({ query: { kind: 'execution' } }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<{ kind: string }> };
    expect(call.items).toHaveLength(1);
    expect(call.items[0].kind).toBe('execution');
  });

  it('includes documents-backed activity entries when a route context is available', async () => {
    const { activityHandler, store } = createHarnessWithDocuments();
    listConversationSessionsSnapshotMock.mockReturnValue([]);
    listExecutionsMock.mockResolvedValue({ executions: [] });
    store.putDocument(ACTIVITY_OWNER, ACTIVITY_COLLECTION, 'entry-1', {
      type: 'milestone',
      title: 'Installed app',
      subtitle: 'system-documents',
      source: 'App Manager',
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<Record<string, unknown>>; total: number };
    expect(call.total).toBe(1);
    expect(call.items[0]).toEqual(
      expect.objectContaining({
        id: 'entry:entry-1',
        kind: 'entry',
        title: 'Installed app',
        subtitle: 'system-documents',
        source: 'App Manager',
        entryType: 'milestone',
      }),
    );
  });

  it('filters by active status', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([session('conv-1')]);
    listExecutionsMock.mockResolvedValue({
      executions: [
        execution('run-1', { status: 'running', continuation: { updatedAt: '2026-06-19T15:00:00.000Z' } }),
        execution('run-2', { status: 'completed', updatedAt: '2026-06-19T14:00:00.000Z' }),
      ],
    });

    const activeRes = createJsonResponse();
    await activityHandler({ query: { active: 'true' } }, activeRes);

    const activeCall = activeRes.json.mock.calls[0][0] as { items: Array<{ kind: string; status: string }> };
    // Only running execution should be included
    expect(activeCall.items.every((item) => item.status === 'running' || item.status === 'queued')).toBe(true);

    const inactiveRes = createJsonResponse();
    await activityHandler({ query: { active: 'false' } }, inactiveRes);

    const inactiveCall = inactiveRes.json.mock.calls[0][0] as { items: Array<{ status: string }> };
    expect(inactiveCall.items.every((item) => item.status !== 'running' && item.status !== 'queued')).toBe(true);
  });

  it('maps execution status correctly', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([]);
    listExecutionsMock.mockResolvedValue({
      executions: [
        execution('run-q', { status: 'queued' }),
        execution('run-w', { status: 'waiting' }),
        execution('run-r', { status: 'running' }),
        execution('run-re', { status: 'recovering' }),
        execution('run-d', { status: 'completed' }),
        execution('run-f', { status: 'failed' }),
        execution('run-c', { status: 'cancelled' }),
        execution('run-i', { status: 'interrupted' }),
        execution('run-u', { status: 'unknown-status' }),
      ],
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<{ id: string; status: string }> };
    const byId = Object.fromEntries(call.items.map((item) => [item.id, item.status]));
    expect(byId['execution:run-q']).toBe('queued');
    expect(byId['execution:run-w']).toBe('queued');
    expect(byId['execution:run-r']).toBe('running');
    expect(byId['execution:run-re']).toBe('running');
    expect(byId['execution:run-d']).toBe('completed');
    expect(byId['execution:run-f']).toBe('failed');
    expect(byId['execution:run-c']).toBe('cancelled');
    expect(byId['execution:run-i']).toBe('cancelled');
    expect(byId['execution:run-u']).toBe('unknown');
  });

  it('enriches execution rows with worker/app-centric fields', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([session('conv-1', { title: 'My Awesome Chat' })]);
    listExecutionsMock.mockResolvedValue({
      executions: [
        execution('run-1', {
          kind: 'subagent',
          status: 'running',
          conversationId: 'conv-1',
          command: 'npm run build',
          cwd: '/repo',
          updatedAt: '2026-06-19T15:00:00.000Z',
        }),
        execution('run-2', {
          kind: 'background-command',
          status: 'completed',
          command: 'ls -la',
          cwd: '/repo/sub',
        }),
      ],
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<Record<string, unknown>> };
    const subagent = findItem(call as never, 'execution:run-1') as Record<string, unknown>;
    const command = findItem(call as never, 'execution:run-2') as Record<string, unknown>;

    expect(subagent).toEqual(
      expect.objectContaining({
        id: 'execution:run-1',
        kind: 'execution',
        status: 'running',
        active: true,
        source: 'Subagent',
        executionKind: 'subagent',
        visibility: 'primary',
        command: 'npm run build',
        cwd: '/repo',
        conversationId: 'conv-1',
        conversationTitle: 'My Awesome Chat',
      }),
    );
    expect(command).toEqual(
      expect.objectContaining({
        id: 'execution:run-2',
        kind: 'execution',
        status: 'completed',
        active: false,
        source: 'Background command',
        executionKind: 'background-command',
        command: 'ls -la',
        cwd: '/repo/sub',
      }),
    );
  });

  it('marks conversation rows with source and active grouping', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([
      session('conv-1', { isLive: true, timestamp: '2026-06-19T11:00:00.000Z', lastActivityAt: '2026-06-19T14:00:00.000Z' }),
      session('conv-2', { timestamp: '2026-06-19T10:00:00.000Z', lastActivityAt: '2026-06-19T13:00:00.000Z' }),
    ]);
    listExecutionsMock.mockResolvedValue({ executions: [] });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<Record<string, unknown>> };
    const live = findItem(call as never, 'conversation:conv-1') as Record<string, unknown>;
    const done = findItem(call as never, 'conversation:conv-2') as Record<string, unknown>;

    expect(live).toEqual(
      expect.objectContaining({
        id: 'conversation:conv-1',
        kind: 'conversation',
        status: 'running',
        active: true,
        source: 'Conversation',
        conversationId: 'conv-1',
      }),
    );
    expect(done).toEqual(
      expect.objectContaining({
        id: 'conversation:conv-2',
        kind: 'conversation',
        status: 'completed',
        active: false,
        source: 'Conversation',
      }),
    );
  });

  it('maps execution kinds to user-facing source labels', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([]);
    listExecutionsMock.mockResolvedValue({
      executions: [
        execution('a', { kind: 'background-command' }),
        execution('b', { kind: 'subagent' }),
        execution('c', { kind: 'scheduled-task' }),
        execution('d', { kind: 'deferred-resume' }),
        execution('e', { kind: 'conversation' }),
        execution('f', { kind: 'unknown' }),
      ],
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<{ id: string; source?: string }> };
    const byId = Object.fromEntries(call.items.map((item) => [item.id, item.source]));
    expect(byId['execution:a']).toBe('Background command');
    expect(byId['execution:b']).toBe('Subagent');
    expect(byId['execution:c']).toBe('Scheduled task');
    expect(byId['execution:d']).toBe('Deferred resume');
    expect(byId['execution:e']).toBe('Conversation run');
    expect(byId['execution:f']).toBe('Worker');
  });

  it('surfaces active rows before done rows when sorting', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([
      session('conv-old', { timestamp: '2026-06-19T09:00:00.000Z', lastActivityAt: '2026-06-19T09:00:00.000Z' }),
    ]);
    listExecutionsMock.mockResolvedValue({
      executions: [
        execution('run-done', { status: 'completed', updatedAt: '2026-06-19T16:00:00.000Z' }),
        execution('run-active', { status: 'running', updatedAt: '2026-06-19T08:00:00.000Z' }),
      ],
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<{ id: string }> };
    // The active run is older than the done run, but active rows float to the top.
    expect(call.items[0].id).toBe('execution:run-active');
    expect(call.items[1].id).toBe('execution:run-done');
    expect(call.items[2].id).toBe('conversation:conv-old');
  });

  it('propagates workerName and workerRole from execution records', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([]);
    listExecutionsMock.mockResolvedValue({
      executions: [
        execution('run-1', {
          kind: 'subagent',
          status: 'running',
          workerName: 'code-review-bot',
          workerRole: 'worker',
          updatedAt: '2026-06-19T15:00:00.000Z',
        }),
        execution('run-2', {
          kind: 'background-command',
          status: 'completed',
          updatedAt: '2026-06-19T14:00:00.000Z',
        }),
      ],
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<Record<string, unknown>> };
    const withWorker = call.items.find((i) => i.id === 'execution:run-1') as Record<string, unknown>;
    const withoutWorker = call.items.find((i) => i.id === 'execution:run-2') as Record<string, unknown>;

    expect(withWorker.workerName).toBe('code-review-bot');
    expect(withWorker.workerRole).toBe('worker');
    expect(withoutWorker.workerName).toBeUndefined();
    expect(withoutWorker.workerRole).toBeUndefined();
  });

  it('uses conversationTitle from session metadata', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([session('conv-1', { title: 'My Awesome Chat' })]);
    listExecutionsMock.mockResolvedValue({
      executions: [execution('run-1', { conversationId: 'conv-1' })],
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    const call = res.json.mock.calls[0][0] as { items: Array<{ id: string; conversationTitle?: string }> };
    const runItem = call.items.find((item) => item.id === 'execution:run-1');
    expect(runItem?.conversationTitle).toBe('My Awesome Chat');
  });

  it('handles limit query edge cases', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([]);
    listExecutionsMock.mockResolvedValue({ executions: [] });

    // Non-numeric limit falls back to default 50.
    const res1 = createJsonResponse();
    await activityHandler({ query: { limit: 'abc' } }, res1);
    expect(res1.json).toHaveBeenCalledWith({ items: [], total: 0 });

    // Negative limit falls back to default 50.
    const res2 = createJsonResponse();
    await activityHandler({ query: { limit: '-5' } }, res2);
    expect(res2.json).toHaveBeenCalledWith({ items: [], total: 0 });

    // Zero limit falls back to default 50.
    const res3 = createJsonResponse();
    await activityHandler({ query: { limit: '0' } }, res3);
    expect(res3.json).toHaveBeenCalledWith({ items: [], total: 0 });

    // A limit over the max is clamped to 200.
    listExecutionsMock.mockResolvedValue({
      executions: Array.from({ length: 300 }, (_, i) => execution(`run-${i}`)),
    });
    const res4 = createJsonResponse();
    await activityHandler({ query: { limit: '999' } }, res4);
    const call4 = res4.json.mock.calls[0][0] as { items: unknown[]; total: number };
    expect(call4.items).toHaveLength(200);
  });

  it('propagates errors as 500 responses', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockImplementation(() => {
      throw new Error('db failure');
    });

    const res = createJsonResponse();
    await activityHandler({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('db failure') });
    expect(logErrorMock).toHaveBeenCalledWith('request handler error', expect.any(Object));
  });

  it('handles malformed kind and active query parameters gracefully', async () => {
    const { activityHandler } = createHarness();
    listConversationSessionsSnapshotMock.mockReturnValue([]);
    listExecutionsMock.mockResolvedValue({ executions: [] });

    const res = createJsonResponse();
    await activityHandler({ query: { kind: 'bogus-kind', active: 'maybe' } }, res);
    // Malformed filters are ignored (treated as 'all' / undefined), so results are returned
    expect(res.json).toHaveBeenCalledWith({ items: [], total: 0 });
  });
});
