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
  return {
    extension: { invoke: vi.fn(), getManifest: vi.fn(), listSurfaces: vi.fn() },
    executions: { start: vi.fn(), get: vi.fn(), list: vi.fn(), readLog: vi.fn(), cancel: vi.fn() },
    storage: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    commands: { execute: vi.fn(async () => true), list: vi.fn(async () => []), setContext: vi.fn() },
    ui: { toast: vi.fn(), notify: vi.fn(), confirm: vi.fn(async () => true), ...uiOverrides },
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

describe('AutomationsPage', () => {
  it('opens the creation editor from the command-backed route query', async () => {
    expect(shouldOpenNewAutomationFromSearch('?action=new')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?new=1')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?filter=current')).toBe(false);

    const { container } = await renderPage(createPa(), { search: '?action=new' });

    expect(container.textContent).toContain('New automation');
    expect(container.textContent).toContain('Create with chat');
    expect(container.querySelector('input[name="automation-title"]')).not.toBeNull();
  });

  it('renders scheduler health and automation rows', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Automations');
    expect(container.innerHTML).toContain('aria-label="Scheduler healthy.');
    expect(container.textContent).toContain('Daily check');
    expect(container.textContent).toContain('Workday start');
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

    expect(container.textContent).toContain('Fresh check');

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

    expect(container.textContent).toContain('Fresh check');
    expect(container.textContent).not.toContain('Stale check');
  });

  it('preserves the activity shell when no automations exist', async () => {
    const { container } = await renderPage(
      createPa({
        list: vi.fn(async () => []),
      }),
    );

    expect(container.textContent).toContain('No matching event activity.');
    expect(container.textContent).toContain('No event selected');
    expect(container.textContent).toContain('Publisher emits');
    expect(container.textContent).toContain('Reaction matches');
    expect(container.textContent).toContain('All');
    expect(container.querySelector('input[placeholder="Search events…"]')).not.toBeNull();
    expect(container.textContent).toContain('Event Stream');
    expect(container.textContent).toContain('Published Event');
  });

  it('re-emits the selected event from the inspector action', async () => {
    const pa = createPa();
    const { container } = await renderPage(pa);
    const runButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Re-emit Event');
    if (!runButton) throw new Error('Re-emit button not found');

    await act(async () => {
      runButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pa.automations.run).toHaveBeenCalledWith('daily-check');
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
    expect(container.textContent).toContain('Missed check');
    expect(container.textContent).toContain('schedule.due');
    expect(container.textContent).toContain('Later check');
  });

  it('links conversation automations to their thread', async () => {
    const { container } = await renderPage(
      createPa({
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
      }),
    );

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
    const { container } = await renderPage(pa);
    const newButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create Reaction');
    if (!newButton) throw new Error('New automation button not found');

    await act(async () => {
      newButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

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
    const { container } = await renderPage(pa);
    const newButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create Reaction');
    if (!newButton) throw new Error('New automation button not found');

    await act(async () => {
      newButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

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
    const { container } = await renderPage(pa);
    const newButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create Reaction');
    if (!newButton) throw new Error('New automation button not found');

    await act(async () => {
      newButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

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
    const { container } = await renderPage(pa);
    const editButton = Array.from(container.querySelectorAll('button'))
      .filter((button) => button.textContent === 'Create Reaction')
      .at(-1);
    if (!editButton) throw new Error('Create Reaction button not found');

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
