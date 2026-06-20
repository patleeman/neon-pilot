import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { startBackgroundRunMock, startScheduledTaskRunMock, invalidateAppTopicsMock } = vi.hoisted(() => ({
  startBackgroundRunMock: vi.fn(),
  startScheduledTaskRunMock: vi.fn(),
  invalidateAppTopicsMock: vi.fn(),
}));

vi.mock('../daemon/client.js', () => ({
  startBackgroundRun: startBackgroundRunMock,
  startScheduledTaskRun: startScheduledTaskRunMock,
}));

vi.mock('../shared/appEvents.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
}));

import type { EventBusDispatchInput } from './eventBus.js';
import { closeEventBusDbs, createEventBusSubscription, listEventBusEvents } from './eventBus.js';
import { delayEvent, dispatchEventBusReaction, emitEvent, processDueEvents } from './eventBusHost.js';

const tempDirs: string[] = [];

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-event-bus-host-'));
  tempDirs.push(dir);
  return join(dir, 'event-bus.sqlite');
}

function dispatchInput(action: EventBusDispatchInput['subscription']['action']): EventBusDispatchInput {
  return {
    event: {
      id: 'evt_1',
      type: 'demo.order.created',
      source: 'script:checkout',
      payload: { orderId: 'ord_1', cwd: '/payload-cwd' },
      metadata: { cwd: '/metadata-cwd' },
      occurredAt: '2026-06-19T10:00:00.000Z',
      recordedAt: '2026-06-19T10:00:00.000Z',
      recorded: true,
      reactions: [],
    },
    subscription: {
      id: 'sub_1',
      name: 'Handler',
      pattern: 'demo.order.created',
      enabled: true,
      action,
      createdAt: '2026-06-19T09:00:00.000Z',
      updatedAt: '2026-06-19T09:00:00.000Z',
    },
  };
}

describe('event bus host dispatcher', () => {
  beforeEach(() => {
    startBackgroundRunMock.mockReset();
    startScheduledTaskRunMock.mockReset();
    invalidateAppTopicsMock.mockReset();
    startBackgroundRunMock.mockResolvedValue({ accepted: true, runId: 'run-bg-1' });
    startScheduledTaskRunMock.mockResolvedValue({ accepted: true, runId: 'run-task-1' });
  });

  afterEach(() => {
    closeEventBusDbs();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('dispatches run_task subscriptions through scheduled task runs', async () => {
    const result = await dispatchEventBusReaction(dispatchInput({ type: 'run_task', taskId: 'score-order' }));

    expect(startScheduledTaskRunMock).toHaveBeenCalledWith('score-order');
    expect(result).toEqual({ status: 'completed', output: { accepted: true, runId: 'run-task-1' } });
  });

  it('dispatches script subscriptions as event-sourced background runs', async () => {
    const result = await dispatchEventBusReaction(dispatchInput({ type: 'run_script', command: 'node score.js' }));

    expect(startBackgroundRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskSlug: 'event-script-evt_1',
        cwd: '/metadata-cwd',
        shellCommand: 'node score.js',
        source: { type: 'event-bus', id: 'evt_1' },
        manifestMetadata: { eventType: 'demo.order.created', subscriptionId: 'sub_1' },
      }),
    );
    expect(result).toEqual({ status: 'completed', output: { accepted: true, runId: 'run-bg-1' } });
  });

  it('dispatches agent and thread subscriptions with event context prompts', async () => {
    await dispatchEventBusReaction(dispatchInput({ type: 'start_agent', prompt: 'Investigate order', model: 'gpt-test' }));
    await dispatchEventBusReaction(dispatchInput({ type: 'start_thread', prompt: 'Continue order work', cwd: '/action-cwd' }));

    expect(startBackgroundRunMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        taskSlug: 'event-agent-evt_1',
        cwd: '/metadata-cwd',
        agent: expect.objectContaining({
          model: 'gpt-test',
          noSession: true,
          prompt: expect.stringContaining('"type": "demo.order.created"'),
        }),
      }),
    );
    expect(startBackgroundRunMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        taskSlug: 'event-thread-evt_1',
        cwd: '/action-cwd',
        agent: expect.objectContaining({
          prompt: expect.stringContaining('"orderId": "ord_1"'),
        }),
      }),
    );
  });

  it('dispatches publish_event subscriptions into the same event stream', async () => {
    const dbPath = tempDbPath();
    await createEventBusSubscription({
      dbPath,
      subscription: {
        id: 'sub-approved',
        name: 'Approve order',
        pattern: 'demo.order.created',
        action: { type: 'publish_event', eventType: 'demo.order.approved', payload: { approved: true } },
      },
    });

    const emitted = await emitEvent({
      dbPath,
      action: 'emit',
      type: 'demo.order.created',
      source: 'script:checkout',
      payload: { orderId: 'ord_1' },
    });

    expect(emitted).toMatchObject({
      event: expect.objectContaining({ type: 'demo.order.created' }),
      reactions: [expect.objectContaining({ subscriptionId: 'sub-approved', status: 'completed' })],
    });
    expect(
      listEventBusEvents({ dbPath })
        .map((event) => event.type)
        .sort(),
    ).toEqual(['demo.order.approved', 'demo.order.created']);
  });

  it('processes due delayed events and dispatches their subscriptions', async () => {
    const dbPath = tempDbPath();
    await createEventBusSubscription({
      dbPath,
      subscription: {
        id: 'sub-reminder-script',
        name: 'Reminder script',
        pattern: 'resume.due',
        action: { type: 'run_script', command: 'node wake.js', cwd: '/repo' },
      },
    });
    await delayEvent({
      dbPath,
      action: 'delay',
      type: 'resume.due',
      source: 'agent:planner',
      dueAt: '2026-06-19T10:00:00.000Z',
      payload: { conversationId: 'conv_1' },
    });

    const processed = await processDueEvents({ dbPath, action: 'process_due', now: '2026-06-19T10:00:01.000Z' });

    expect(processed).toMatchObject({
      processed: 1,
      emitted: [expect.objectContaining({ type: 'resume.due' })],
      failed: [],
    });
    expect(startBackgroundRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskSlug: expect.stringMatching(/^event-script-evt_/),
        cwd: '/repo',
        shellCommand: 'node wake.js',
      }),
    );
    expect(listEventBusEvents({ dbPath })[0]?.reactions).toEqual([
      expect.objectContaining({ subscriptionId: 'sub-reminder-script', status: 'completed' }),
    ]);
  });
});
