// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AutomationsPage, shouldOpenNewAutomationFromSearch } from '../../../../../../extensions/system-automations/src/frontend';
import type { NativeExtensionClient } from '../nativePaClient';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  for (const root of mountedRoots) {
    act(() => root.unmount());
  }
  mountedRoots.length = 0;
});

function createPa(
  overrides: Partial<NativeExtensionClient['automations']> = {},
  uiOverrides: Partial<NativeExtensionClient['ui']> = {},
): NativeExtensionClient {
  const eventBusList = {
    events: [
      {
        id: 'evt-daily-check',
        type: 'schedule.due',
        source: 'scheduler',
        payload: { taskId: 'daily-check' },
        metadata: { taskId: 'daily-check' },
        occurredAt: '2026-05-08T00:00:00.000Z',
        recordedAt: '2026-05-08T00:00:00.000Z',
        reactions: [
          {
            id: 'reaction-daily-check',
            subscriptionId: 'sub-daily-check',
            subscriptionName: 'Daily check',
            actionType: 'run_task',
            status: 'completed',
            output: { taskId: 'daily-check' },
          },
        ],
      },
    ],
  };
  return {
    extension: {
      invoke: vi.fn(async (_actionId: string, input?: unknown) => {
        const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
        if (action === 'list') return { details: eventBusList };
        if (action === 'list_subscriptions') {
          return {
            details: {
              subscriptions: [
                {
                  id: 'sub-daily-check',
                  name: 'Daily check',
                  pattern: 'schedule.due',
                  enabled: true,
                  action: { type: 'run_task', taskId: 'daily-check' },
                },
              ],
            },
          };
        }
        if (action === 'replay') return { event: { id: 'evt-replay' }, reactions: [] };
        return {};
      }),
      getManifest: vi.fn(),
      listSurfaces: vi.fn(),
    },
    executions: { start: vi.fn(), get: vi.fn(), list: vi.fn(), readLog: vi.fn(), cancel: vi.fn() },
    storage: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    commands: { execute: vi.fn(async () => true), list: vi.fn(async () => []), setContext: vi.fn() },
    ui: {
      toast: vi.fn(),
      notify: vi.fn(),
      confirm: vi.fn(async () => true),
      subscribeInvalidations: vi.fn(() => ({ unsubscribe: vi.fn() })),
      ...uiOverrides,
    },
    automations: {
      list: vi.fn(async () => [
        {
          id: 'daily-check',
          title: 'Daily check',
          scheduleType: 'cron',
          targetType: 'background-agent',
          running: false,
          enabled: true,
          cron: '0 9 * * 1-5',
          prompt: 'Check the repo',
        },
      ]),
      readSchedulerHealth: vi.fn(async () => ({
        status: 'healthy',
        lastEvaluatedAt: '2026-05-08T00:00:00.000Z',
        staleAfterSeconds: 60,
        checkedAt: '2026-05-08T00:00:01.000Z',
      })),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      run: vi.fn(),
      readLog: vi.fn(),
      ...overrides,
    },
  } as unknown as NativeExtensionClient;
}

async function renderPage(pa = createPa(), context: { search?: string } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<AutomationsPage pa={pa} context={context} />);
  });
  await act(async () => {
    await Promise.resolve();
  });

  return { container, pa };
}

function mockEventBusList(pa: NativeExtensionClient, taskId: string, subscriptionName = taskId, actionType = 'run_task') {
  vi.mocked(pa.extension.invoke).mockImplementation(async (_actionId: string, input?: unknown) => {
    const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
    if (action === 'list') {
      return {
        details: {
          events: [
            {
              id: `evt-${taskId}`,
              type: 'schedule.due',
              source: 'scheduler',
              payload: { taskId },
              metadata: { taskId },
              occurredAt: '2026-05-08T00:00:00.000Z',
              reactions: [
                {
                  id: `reaction-${taskId}`,
                  subscriptionId: `sub-${taskId}`,
                  subscriptionName,
                  actionType,
                  status: 'completed',
                },
              ],
            },
          ],
        },
      };
    }
    if (action === 'replay') return { event: { id: 'evt-replay' }, reactions: [] };
    return {};
  });
}

describe('AutomationsPage', () => {
  it('opens the creation editor from the command-backed route query', async () => {
    expect(shouldOpenNewAutomationFromSearch('?action=new')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?new=1')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?filter=current')).toBe(false);

    const { container } = await renderPage(createPa(), { search: '?action=new' });

    expect(container.textContent).toContain('New scheduled publisher');
    expect(container.textContent).toContain('Create with chat');
    expect(container.querySelector('input[name="automation-title"]')).not.toBeNull();
  });

  it('renders scheduler health and automation rows', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Automations');
    expect(container.innerHTML).toContain('aria-label="Scheduler healthy.');
    expect(container.textContent).toContain('Daily check');
    expect(container.textContent).toContain('schedule.due');
    expect(container.textContent).toContain('TimeEventEmitted byHandled byStatus');
    expect(container.querySelector('[data-automation-activity-shell="true"]')?.className).toContain('overflow-hidden');
    expect(container.querySelector('[data-automation-activity-main="true"]')?.className).toContain('min-h-0');
    expect(container.querySelector('[data-automation-activity-scroll="true"]')?.className).toContain('overflow-auto');
  });

  it('ignores stale load completions when automation refreshes overlap', async () => {
    const staleTasks = deferred<unknown[]>();
    const freshTasks = deferred<unknown[]>();
    const pa = createPa({
      list: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'initial-check',
            title: 'Initial check',
            scheduleType: 'cron',
            targetType: 'background-agent',
            running: false,
            enabled: true,
            cron: '0 9 * * 1-5',
            prompt: 'Initial',
          },
        ])
        .mockReturnValueOnce(staleTasks.promise)
        .mockReturnValueOnce(freshTasks.promise),
    });
    const { container } = await renderPage(pa);
    const reloadButton = container.querySelector('button[aria-label="Reload automations"]');
    if (!reloadButton) throw new Error('Reload button not found');

    await act(async () => {
      reloadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      reloadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      freshTasks.resolve([
        {
          id: 'fresh-check',
          title: 'Fresh check',
          scheduleType: 'cron',
          targetType: 'background-agent',
          running: false,
          enabled: true,
          cron: '0 10 * * 1-5',
          prompt: 'Fresh',
        },
      ]);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('1 scheduled publisher');

    await act(async () => {
      staleTasks.resolve([
        {
          id: 'stale-check',
          title: 'Stale check',
          scheduleType: 'cron',
          targetType: 'background-agent',
          running: false,
          enabled: true,
          cron: '0 8 * * 1-5',
          prompt: 'Stale',
        },
      ]);
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain('Stale check');
  });

  it('refreshes when automation event topics are invalidated', async () => {
    vi.useFakeTimers();
    let invalidateHandler: ((event: { topics: string[] }) => void) | undefined;
    const subscribeInvalidations = vi.fn((handler: (event: { topics: string[] }) => void) => {
      invalidateHandler = handler;
      return { unsubscribe: vi.fn() };
    });
    const pa = createPa(
      {
        list: vi.fn(async () => []),
      },
      { subscribeInvalidations },
    );
    const invoke = vi.mocked(pa.extension.invoke);
    invoke.mockImplementation(async (_actionId: string, input?: unknown) => {
      const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
      if (action === 'list') {
        const callCount = invoke.mock.calls.filter(([, callInput]) => {
          return callInput && typeof callInput === 'object' && (callInput as { action?: unknown }).action === 'list';
        }).length;
        return {
          details: {
            events: [
              {
                id: callCount > 1 ? 'evt-refreshed' : 'evt-initial',
                type: callCount > 1 ? 'demo.refreshed' : 'demo.initial',
                source: 'script:checkout',
                occurredAt: '2026-05-08T00:00:00.000Z',
                reactions: [],
              },
            ],
          },
        };
      }
      if (action === 'list_subscriptions') return { details: { subscriptions: [] } };
      return {};
    });

    const { container } = await renderPage(pa);
    expect(container.textContent).toContain('Initial');
    expect(subscribeInvalidations).toHaveBeenCalled();

    await act(async () => {
      invalidateHandler?.({ topics: ['automation'] });
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(container.textContent).toContain('Refreshed');
  });

  it('auto-refreshes event activity while the page is open', async () => {
    vi.useFakeTimers();
    const pa = createPa({ list: vi.fn(async () => []) });
    const invoke = vi.mocked(pa.extension.invoke);
    invoke.mockImplementation(async (_actionId: string, input?: unknown) => {
      const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
      if (action === 'list') {
        const callCount = invoke.mock.calls.filter(([, callInput]) => {
          return callInput && typeof callInput === 'object' && (callInput as { action?: unknown }).action === 'list';
        }).length;
        return {
          details: {
            events: [
              {
                id: callCount > 1 ? 'evt-auto-refresh' : 'evt-initial',
                type: callCount > 1 ? 'demo.auto_refreshed' : 'demo.initial',
                source: 'script:checkout',
                occurredAt: '2026-05-08T00:00:00.000Z',
                reactions: [],
              },
            ],
          },
        };
      }
      if (action === 'list_subscriptions') return { details: { subscriptions: [] } };
      return {};
    });

    const { container } = await renderPage(pa);
    expect(container.textContent).toContain('Initial');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(container.textContent).toContain('Auto Refreshed');
  });

  it('preserves the activity shell when no automations exist', async () => {
    const pa = createPa({
      list: vi.fn(async () => []),
    });
    vi.mocked(pa.extension.invoke).mockImplementation(async (_actionId: string, input?: unknown) => {
      const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
      if (action === 'list') return { events: [] };
      if (action === 'list_subscriptions') return { subscriptions: [] };
      if (action === 'replay') return { event: { id: 'evt-replay' }, reactions: [] };
      return {};
    });
    const { container } = await renderPage(pa);

    expect(container.textContent).toContain('No events match this view.');
    expect(container.textContent).toContain('No event selected');
    expect(container.textContent).toContain('All');
    expect(container.querySelector('input[placeholder="Search events…"]')).not.toBeNull();
    expect(container.textContent).toContain('Emitter: All');
    expect(container.textContent).toContain('Handler: All');
  });

  it('replays the selected durable event bus event from the inspector action', async () => {
    const pa = createPa();
    vi.mocked(pa.extension.invoke).mockImplementation(async (_actionId: string, input?: unknown) => {
      const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
      if (action === 'list') {
        return {
          details: {
            events: [
              {
                id: 'evt-daily-check',
                type: 'schedule.due',
                source: 'scheduler',
                occurredAt: '2026-05-08T00:00:00.000Z',
                metadata: { taskId: 'daily-check' },
                reactions: [
                  {
                    id: 'reaction-daily-check',
                    subscriptionId: 'sub-daily-check',
                    subscriptionName: 'Daily check',
                    actionType: 'run_task',
                    status: 'completed',
                  },
                ],
              },
            ],
          },
        };
      }
      if (action === 'replay') return { event: { id: 'evt-replay' }, reactions: [] };
      return {};
    });
    const { container } = await renderPage(pa);
    const runButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Run again');
    if (!runButton) throw new Error('Run again button not found');

    await act(async () => {
      runButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pa.extension.invoke).toHaveBeenCalledWith('eventBus', { action: 'replay', eventId: 'evt-daily-check' });
    expect(pa.automations.run).not.toHaveBeenCalled();
  });

  it('renders custom event bus events from the inspector action', async () => {
    const pa = createPa();
    vi.mocked(pa.extension.invoke).mockImplementation(async (_actionId: string, input?: unknown) => {
      const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
      if (action === 'list') {
        return {
          details: {
            events: [
              {
                id: 'evt-1',
                type: 'schedule.due',
                source: 'scheduler',
                occurredAt: '2026-05-08T00:00:00.000Z',
                metadata: { taskId: 'daily-check' },
                reactions: [
                  {
                    id: 'reaction-1',
                    subscriptionId: 'sub-1',
                    subscriptionName: 'Daily check',
                    actionType: 'run_task',
                    status: 'completed',
                  },
                ],
              },
            ],
          },
        };
      }
      if (action === 'replay') return { event: { id: 'evt-replay' }, reactions: [] };
      return {};
    });
    const { container } = await renderPage(pa);
    const runButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Run again');
    if (!runButton) throw new Error('Run again button not found');

    await act(async () => {
      runButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pa.extension.invoke).toHaveBeenCalledWith('eventBus', { action: 'replay', eventId: 'evt-1' });
    expect(pa.automations.run).not.toHaveBeenCalled();
  });

  it('renders handler names instead of source ids and shows handler details', async () => {
    const pa = createPa();
    vi.mocked(pa.extension.invoke).mockImplementation(async (_actionId: string, input?: unknown) => {
      const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
      if (action === 'list') {
        return {
          details: {
            events: [
              {
                id: 'evt-approved',
                type: 'demo.order.approved',
                source: 'sub-approve-order',
                occurredAt: '2026-05-08T00:00:00.000Z',
                reactions: [
                  {
                    id: 'reaction-fulfillment',
                    subscriptionId: 'sub-request-fulfillment',
                    subscriptionName: 'Request fulfillment',
                    actionType: 'publish_event',
                    status: 'completed',
                  },
                ],
              },
            ],
          },
        };
      }
      if (action === 'list_subscriptions') {
        return {
          details: {
            subscriptions: [
              {
                id: 'sub-approve-order',
                name: 'Approve order',
                pattern: 'demo.order.scored',
                enabled: true,
                action: { type: 'publish_event', eventType: 'demo.order.approved' },
              },
              {
                id: 'sub-request-fulfillment',
                name: 'Request fulfillment',
                pattern: 'demo.order.approved',
                enabled: true,
                action: { type: 'publish_event', eventType: 'demo.fulfillment.requested' },
              },
            ],
          },
        };
      }
      return {};
    });

    const { container } = await renderPage(pa);

    expect(container.textContent).toContain('Approve order');
    expect(container.textContent).toContain('Request fulfillment');
    expect(container.textContent).toContain('Publish Fulfillment Requested');
    expect(container.textContent).not.toContain('sub-approve-order');
  });

  it('renders session names instead of session ids for event emitters', async () => {
    const pa = {
      ...createPa(),
      conversations: {
        list: vi.fn(async () => [{ id: 'conv-order-watch', title: 'Order Watch Session' }]),
      },
    } as unknown as NativeExtensionClient;
    vi.mocked(pa.extension.invoke).mockImplementation(async (_actionId: string, input?: unknown) => {
      const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
      if (action === 'list') {
        return {
          details: {
            events: [
              {
                id: 'evt-session-emitted',
                type: 'demo.order.created',
                source: 'session:conv-order-watch',
                occurredAt: '2026-05-08T00:00:00.000Z',
                reactions: [],
              },
            ],
          },
        };
      }
      if (action === 'list_subscriptions') return { details: { subscriptions: [] } };
      return {};
    });

    const { container } = await renderPage(pa);

    expect(container.textContent).toContain('Order Watch Session');
    expect(container.textContent).not.toContain('conv-order-watch');
  });

  it('pauses the selected publisher from the inspector action', async () => {
    const update = vi.fn(async () => ({ ok: true }));
    const pa = createPa({ update });
    const { container } = await renderPage(pa);
    const pauseButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Pause Publisher');
    if (!pauseButton) throw new Error('Pause Publisher button not found');

    await act(async () => {
      pauseButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(update).toHaveBeenCalledWith('daily-check', expect.objectContaining({ enabled: false }));
  });

  it('turns off the selected event handler from the inspector', async () => {
    const pa = createPa({
      list: vi.fn(async () => []),
    });
    vi.mocked(pa.extension.invoke).mockImplementation(async (_actionId: string, input?: unknown) => {
      const action = input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
      if (action === 'list') {
        return {
          details: {
            events: [
              {
                id: 'evt-agent',
                type: 'tweet.found',
                source: 'webhook',
                occurredAt: '2026-05-08T00:00:00.000Z',
                reactions: [
                  {
                    id: 'reaction-agent',
                    subscriptionId: 'sub-agent',
                    subscriptionName: 'Agent Worker',
                    actionType: 'start_agent',
                    status: 'completed',
                  },
                ],
              },
            ],
          },
        };
      }
      if (action === 'list_subscriptions') {
        return {
          details: {
            subscriptions: [
              {
                id: 'sub-agent',
                name: 'Agent Worker',
                pattern: 'tweet.*',
                enabled: true,
                action: { type: 'start_agent', prompt: 'Handle tweet' },
                maxReactionsPerMinute: 4,
              },
            ],
          },
        };
      }
      return {};
    });
    const { container } = await renderPage(pa);

    expect(container.textContent).toContain('Agent Worker');

    const toggle = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Turn off Agent Worker');
    if (!toggle) throw new Error('Turn off button not found');
    await act(async () => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(pa.extension.invoke).toHaveBeenCalledWith(
      'eventBus',
      expect.objectContaining({
        action: 'save_subscription',
        subscriptionId: 'sub-agent',
        enabled: false,
        subscriptionAction: expect.objectContaining({ type: 'start_agent' }),
      }),
    );
  });

  it('moves overdue one-time automations into a past-due section', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T12:00:00.000Z'));

    const { container } = await renderPage(
      createPa({
        list: vi.fn(async () => [
          {
            id: 'missed-check',
            title: 'Missed check',
            scheduleType: 'at',
            targetType: 'conversation',
            running: false,
            enabled: true,
            at: '2026-05-12T07:13:01.347Z',
            prompt: 'Missed the scheduled slot',
          },
          {
            id: 'later-check',
            title: 'Later check',
            scheduleType: 'at',
            targetType: 'conversation',
            running: false,
            enabled: true,
            at: '2026-05-14T13:10:00.000Z',
            prompt: 'Still upcoming',
          },
        ]),
      }),
    );

    expect(container.textContent).toContain('1 past due');
    expect(container.textContent).toContain('past due');
    expect(container.textContent).toContain('schedule.due');
  });

  it('links conversation automations to their thread', async () => {
    const pa = createPa({
      list: vi.fn(async () => [
        {
          id: 'thread-check',
          title: 'Thread check',
          scheduleType: 'cron',
          targetType: 'conversation',
          running: false,
          enabled: true,
          cron: '0 9 * * 1-5',
          prompt: 'Check the thread',
          threadConversationId: 'conv-123',
        },
      ]),
    });
    mockEventBusList(pa, 'thread-check', 'Thread check', 'start_thread');
    const { container } = await renderPage(pa);

    const openThreadButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Open Thread');

    expect(openThreadButton).not.toBeUndefined();
  });

  it('opens a chat draft instead of directly creating a new automation', async () => {
    let resolveCommand: ((value: boolean) => void) | undefined;
    const execute = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveCommand = resolve;
        }),
    );
    const pa = createPa();
    pa.commands.execute = execute as never;
    const { container } = await renderPage(pa, { search: '?action=new' });

    expect(container.textContent).toContain('Create with chat');
    expect(container.textContent).not.toContain('Create automation');

    const chatButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create with chat');
    if (!chatButton) throw new Error('Create with chat button not found');

    await act(async () => {
      chatButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      chatButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(pa.automations.create).not.toHaveBeenCalled();
    expect(pa.commands.execute).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCommand?.(true);
      await Promise.resolve();
    });

    expect(pa.automations.create).not.toHaveBeenCalled();
    expect(pa.commands.execute).toHaveBeenCalledWith(
      'conversation.newAndFocus',
      expect.objectContaining({
        initialPromptText: expect.stringContaining('Read the built-in scheduled-tasks skill'),
      }),
    );
    expect((pa.commands.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].initialComposerText).toBeUndefined();
    expect((pa.commands.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].initialPromptText).toContain(
      'Do not create the automation until I confirm',
    );
    expect((pa.commands.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].initialPromptText).toContain('- Timeout seconds: 1800');
    expect((pa.commands.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].initialPromptText).toContain(
      '- Catch-up policy window seconds: 900',
    );
  });

  it('keeps the editor open when chat creation cannot be opened', async () => {
    const pa = createPa();
    pa.commands.execute = vi.fn(async () => false) as never;
    const { container } = await renderPage(pa, { search: '?action=new' });

    const chatButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create with chat');
    if (!chatButton) throw new Error('Create with chat button not found');

    await act(async () => {
      chatButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(pa.automations.create).not.toHaveBeenCalled();
    expect(pa.ui.notify).toHaveBeenCalledWith({
      type: 'error',
      message: 'Could not open chat for automation creation.',
      source: 'system-automations',
    });
    expect(container.textContent).toContain('Create with chat');
  });

  it('lets recurring schedules be composed from controls', async () => {
    const pa = createPa();
    const { container } = await renderPage(pa, { search: '?action=new' });

    const cadence = container.querySelector<HTMLSelectElement>('select[name="automation-recurring-cadence"]');
    const time = container.querySelector<HTMLInputElement>('input[name="automation-recurring-time"]');
    const chatButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create with chat');
    if (!cadence || !time || !chatButton) throw new Error('Schedule builder controls not found');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(cadence, 'daily');
      cadence.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(time, '14:30');
      time.dispatchEvent(new Event('input', { bubbles: true }));
      time.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      chatButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect((pa.commands.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].initialPromptText).toContain(
      'Schedule: recurring cron 30 14 * * *',
    );
  });

  it('saves edited catch-up policy values as the automation policy source of truth', async () => {
    const update = vi.fn(async () => ({ ok: true }));
    const pa = createPa({
      update,
      list: vi.fn(async () => [
        {
          id: 'policy-check',
          title: 'Policy check',
          scheduleType: 'cron',
          targetType: 'background-agent',
          running: false,
          enabled: true,
          cron: '0 9 * * *',
          prompt: 'Check policy',
          catchUpWindowSeconds: 900,
          policies: [
            { kind: 'catch_up', enabled: true, windowSeconds: 900, mode: 'latest' },
            { kind: 'overlap', enabled: true, behavior: 'skip' },
          ],
        },
      ]),
    });
    mockEventBusList(pa, 'policy-check', 'Policy check');
    const { container } = await renderPage(pa);
    const editButton = Array.from(container.querySelectorAll('button'))
      .filter((button) => button.textContent === 'Edit Scheduled Publisher')
      .at(-1);
    if (!editButton) throw new Error('Edit Scheduled Publisher button not found');

    await act(async () => {
      editButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('input[name="automation-catch-up-window-seconds"]')).toBeNull();
    const catchUpInput = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="number"]')).find(
      (input) => input.value === '900',
    );
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save changes');
    if (!catchUpInput || !saveButton) throw new Error('Catch-up policy controls not found');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(catchUpInput, '120');
      catchUpInput.dispatchEvent(new Event('input', { bubbles: true }));
      catchUpInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(update).toHaveBeenCalledWith(
      'policy-check',
      expect.objectContaining({
        catchUpWindowSeconds: 120,
        policies: expect.arrayContaining([expect.objectContaining({ kind: 'catch_up', windowSeconds: 120 })]),
      }),
    );
  });
});
