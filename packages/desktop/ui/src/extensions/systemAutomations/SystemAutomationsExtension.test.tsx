// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AutomationDialogPanel,
  AutomationsPage,
  shouldOpenNewAutomationFromSearch,
} from '../../../../../../extensions/system-automations/src/frontend';
import type { NativeExtensionClient } from '../nativePaClient';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots) act(() => root.unmount());
  mountedRoots.length = 0;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function createPa(overrides: Partial<NativeExtensionClient['automations']> = {}): NativeExtensionClient {
  return {
    extension: { invoke: vi.fn(), getManifest: vi.fn(), listSurfaces: vi.fn() },
    executions: { start: vi.fn(), get: vi.fn(), list: vi.fn(), readLog: vi.fn(), cancel: vi.fn() },
    storage: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    commands: { execute: vi.fn(async () => true), list: vi.fn(async () => []), setContext: vi.fn() },
    selection: { get: vi.fn(() => null), set: vi.fn(), subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
    ui: {
      toast: vi.fn(),
      notify: vi.fn(),
      confirm: vi.fn(async () => true),
      subscribeInvalidations: vi.fn(() => ({ unsubscribe: vi.fn() })),
    },
    conversations: {
      list: vi.fn(async () => [{ id: 'conv-owner', title: 'Release watch thread', cwd: '/repo' }]),
      attachments: vi.fn(),
      attachment: vi.fn(),
      attachmentAsset: vi.fn(),
      createAttachment: vi.fn(),
      updateAttachment: vi.fn(),
    },
    automations: {
      list: vi.fn(async () => [
        {
          id: 'release-watch',
          title: 'Release watch',
          scheduleType: 'cron',
          targetType: 'conversation',
          running: false,
          enabled: true,
          cron: '*/15 * * * *',
          prompt: 'Check release state',
          threadMode: 'existing',
          threadConversationId: 'conv-owner',
          threadTitle: 'Release watch thread',
          lastRunAt: '2026-06-22T12:00:00.000Z',
        },
        {
          id: 'paused-check',
          title: 'Paused check',
          scheduleType: 'at',
          targetType: 'conversation',
          running: false,
          enabled: false,
          at: '2026-06-24T12:00:00.000Z',
          prompt: 'Once',
          threadMode: 'existing',
          threadConversationId: 'conv-owner',
          threadTitle: 'Release watch thread',
        },
      ]),
      readSchedulerHealth: vi.fn(async () => ({
        status: 'healthy',
        lastEvaluatedAt: '2026-06-22T12:00:00.000Z',
        staleAfterSeconds: 60,
        checkedAt: '2026-06-22T12:00:01.000Z',
      })),
      get: vi.fn(),
      create: vi.fn(async () => ({ ok: true })),
      update: vi.fn(async () => ({ ok: true })),
      delete: vi.fn(async () => ({ ok: true })),
      run: vi.fn(async () => ({ ok: true })),
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
  await act(async () => root.render(<AutomationsPage pa={pa} context={context} />));
  await act(async () => Promise.resolve());
  return { container, pa };
}

async function renderRail(pa = createPa()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  await act(async () => root.render(<AutomationDialogPanel pa={pa} />));
  await act(async () => Promise.resolve());
  return { container, pa };
}

function automationSelection(data: unknown, id = 'automation:new') {
  return {
    kind: 'resource',
    resource: {
      type: 'automation',
      id,
      data,
    },
    updatedAt: new Date().toISOString(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises(times = 3) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => Promise.resolve());
  }
}

describe('AutomationsPage', () => {
  it('keeps initial automations loading chrome visually quiet', async () => {
    const list = deferred<unknown[]>();
    const pa = createPa({ list: vi.fn(() => list.promise) });
    const { container } = await renderPage(pa);

    expect(container.querySelector('[role="status"][aria-label="Loading automations"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Loading automations...');
  });

  it('opens the creation editor from the command-backed route query', async () => {
    expect(shouldOpenNewAutomationFromSearch('?action=new')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?new=1')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?filter=current')).toBe(false);

    const pa = createPa();
    await renderPage(pa, { search: '?action=new' });

    expect(pa.selection.set).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('input[name="automation-title"]')).not.toBeNull();
  });

  it('keeps dialog create drafts when conversations load later', async () => {
    const conversations = deferred<unknown[]>();
    const pa = createPa();
    pa.conversations.list = vi.fn(() => conversations.promise);
    vi.mocked(pa.selection.get).mockReturnValue(automationSelection({ kind: 'new' }) as never);

    await renderRail(pa);

    const title = document.querySelector<HTMLInputElement>('input[name="automation-title"]');
    const ownerBefore = document.querySelector<HTMLSelectElement>('select[name="automation-owner-thread"]');
    if (!title || !ownerBefore) throw new Error('create editor controls missing');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(title, 'Draft automation');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });

    conversations.resolve([{ id: 'conv-owner', title: 'Release watch thread', cwd: '/repo' }]);
    await flushPromises();

    expect(document.querySelector<HTMLInputElement>('input[name="automation-title"]')?.value).toBe('Draft automation');
    expect(document.querySelector<HTMLSelectElement>('select[name="automation-owner-thread"]')?.value).toBe('conv-owner');
  });

  it('renders the creation editor in the automation dialog panel', async () => {
    const pa = createPa();
    vi.mocked(pa.selection.get).mockReturnValue(automationSelection({ kind: 'new' }) as never);

    const { container } = await renderRail(pa);

    expect(container.textContent).toContain('New automation');
    expect(container.textContent).toContain('Create automation');
    expect(container.querySelector('input[name="automation-title"]')).not.toBeNull();
    expect(container.querySelector('select[name="automation-owner-thread"]')).not.toBeNull();
    expect(container.querySelector('select[name="automation-timeout-preset"]')).not.toBeNull();
    expect(container.querySelector('input[name="automation-cwd"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps the empty state as a list-only page until the dialog is opened', async () => {
    const pa = createPa({ list: vi.fn(async () => []) });
    const { container } = await renderPage(pa);

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.textContent).toContain('Schedule work into a conversation');
    expect(
      Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.includes('New automation')),
    ).toHaveLength(2);
    expect(container.querySelector('input[name="automation-title"]')).toBeNull();
    expect(container.textContent).not.toContain('Run preview');
    expect(container.textContent).not.toContain('Scheduler');
  });

  it('renders a schedule-first list with next run, last run, and owner thread', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Automations');
    expect(container.textContent).toContain('StatusAutomationScheduleNext runLast runOwner thread');
    expect(container.textContent).toContain('Release watch');
    expect(container.textContent).toContain('*/15 * * * *');
    expect(container.textContent).toContain('Release watch thread');
    expect(container.querySelector('button[aria-label="Open owner thread for Release watch: Release watch thread"]')).not.toBeNull();
    expect(container.textContent).toContain('Paused check');
    expect(container.textContent).toContain('Paused');
  });

  it('renders selected automation details in the automation dialog panel', async () => {
    const pa = createPa();
    vi.mocked(pa.selection.get).mockReturnValue({
      kind: 'resource',
      resource: {
        type: 'automation',
        id: 'automation:release-watch',
        data: {
          kind: 'automation',
          task: {
            id: 'release-watch',
            title: 'Release watch',
            scheduleType: 'cron',
            enabled: true,
            cron: '*/15 * * * *',
            prompt: 'Check release state',
            threadConversationId: 'conv-owner',
            threadTitle: 'Release watch thread',
          },
        },
      },
      updatedAt: new Date().toISOString(),
    });

    const { container } = await renderRail(pa);

    expect(container.textContent).toContain('Automation context');
    expect(container.textContent).toContain('Release watch');
    expect(container.textContent).toContain('Check release state');
    expect(container.textContent).toContain('Run now');
    expect(container.textContent).toContain('Release watch thread');
  });

  it('opens the owner thread from the automations list', async () => {
    const pa = createPa();
    const { container } = await renderPage(pa);

    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Open owner thread for Release watch: Release watch thread"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(pa.commands.execute).toHaveBeenCalledWith('conversation.open', { conversationId: 'conv-owner' });
  });

  it('refreshes running automations until the row settles', async () => {
    vi.useFakeTimers();
    const list = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'release-watch',
          title: 'Release watch',
          scheduleType: 'at',
          targetType: 'conversation',
          running: true,
          enabled: true,
          at: '2026-06-24T12:00:00.000Z',
          prompt: 'Check release state',
          threadMode: 'existing',
          threadConversationId: 'conv-owner',
          threadTitle: 'Release watch thread',
        },
      ])
      .mockResolvedValue([
        {
          id: 'release-watch',
          title: 'Release watch',
          scheduleType: 'at',
          targetType: 'conversation',
          running: false,
          enabled: true,
          at: '2026-06-24T12:00:00.000Z',
          prompt: 'Check release state',
          threadMode: 'existing',
          threadConversationId: 'conv-owner',
          threadTitle: 'Release watch thread',
          lastRunAt: '2026-06-24T12:00:05.000Z',
          lastStatus: 'success',
        },
      ]);
    const pa = createPa({ list });
    const { container } = await renderPage(pa);

    expect(container.textContent).toContain('Running');
    expect(container.textContent).toContain('Now');

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    expect(list).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('Running');
    expect(container.textContent).not.toContain('Now');
    vi.useRealTimers();
  });

  it('reconciles idle automation rows when push invalidations are missed', async () => {
    vi.useFakeTimers();
    const list = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'release-watch',
          title: 'Release watch',
          scheduleType: 'at',
          targetType: 'conversation',
          running: false,
          enabled: true,
          at: '2026-06-24T12:00:00.000Z',
          prompt: 'Check release state',
          threadMode: 'existing',
          threadConversationId: 'conv-owner',
          threadTitle: 'Release watch thread',
        },
      ])
      .mockResolvedValue([
        {
          id: 'release-watch',
          title: 'Release watch',
          scheduleType: 'at',
          targetType: 'conversation',
          running: false,
          enabled: true,
          at: '2026-06-24T12:00:00.000Z',
          prompt: 'Check release state',
          threadMode: 'existing',
          threadConversationId: 'conv-owner',
          threadTitle: 'Release watch thread',
          lastRunAt: '2026-06-24T12:00:05.000Z',
          lastStatus: 'success',
        },
      ]);
    const pa = createPa({ list });
    const { container } = await renderPage(pa);

    expect(container.textContent).toContain('Never');

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(list).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('Never');
    expect(container.textContent).toContain('Jun 24, 2026');
    vi.useRealTimers();
  });

  it('disables run and delete actions while an automation is already running', async () => {
    const pa = createPa({
      list: vi.fn(async () => [
        {
          id: 'release-watch',
          title: 'Release watch',
          scheduleType: 'at',
          targetType: 'conversation',
          running: true,
          enabled: true,
          at: '2026-06-24T12:00:00.000Z',
          prompt: 'Check release state',
          threadMode: 'existing',
          threadConversationId: 'conv-owner',
          threadTitle: 'Release watch thread',
        },
      ]),
    });
    const { container } = await renderPage(pa);
    const buttons = () => Array.from(container.querySelectorAll('button'));

    await act(async () =>
      buttons()
        .find((button) => button.getAttribute('aria-label') === 'Actions for Release watch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    const runNow = buttons().find((button) => button.textContent === 'Run now');
    expect(runNow).not.toBeUndefined();
    expect(runNow?.hasAttribute('disabled')).toBe(true);
    const deleteButton = buttons().find((button) => button.textContent === 'Delete');
    expect(deleteButton).not.toBeUndefined();
    expect(deleteButton?.hasAttribute('disabled')).toBe(true);

    await act(async () => runNow?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(pa.automations.run).not.toHaveBeenCalled();
    expect(pa.automations.delete).not.toHaveBeenCalled();
  });

  it('runs, pauses, resumes, and deletes from the row action menu', async () => {
    const pa = createPa();
    const { container } = await renderPage(pa);
    const buttons = () => Array.from(container.querySelectorAll('button'));
    const openReleaseMenu = async () => {
      await act(async () =>
        buttons()
          .find((button) => button.getAttribute('aria-label') === 'Actions for Release watch')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
      );
    };

    await openReleaseMenu();
    const trigger = buttons().find((button) => button.getAttribute('aria-label') === 'Actions for Release watch');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    const menuId = trigger?.getAttribute('aria-controls');
    expect(Array.from(container.querySelectorAll('[role="menu"]')).some((menu) => menu.id === menuId)).toBe(true);

    await act(async () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    await openReleaseMenu();
    await act(async () =>
      buttons()
        .find((button) => button.textContent === 'Run now')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    expect(pa.automations.run).toHaveBeenCalledWith('release-watch');

    await openReleaseMenu();
    await act(async () =>
      buttons()
        .find((button) => button.textContent === 'Pause')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    expect(pa.automations.update).toHaveBeenCalledWith(
      'release-watch',
      expect.objectContaining({ enabled: false, threadConversationId: 'conv-owner' }),
    );

    await openReleaseMenu();
    await act(async () =>
      buttons()
        .find((button) => button.textContent === 'Delete')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    expect(pa.automations.delete).toHaveBeenCalledWith('release-watch');
  });

  it('ignores stale refresh responses after a newer mutation reloads', async () => {
    const staleRefresh = deferred<unknown[]>();
    let listCalls = 0;
    const list = vi.fn(() => {
      listCalls += 1;
      if (listCalls === 2) return staleRefresh.promise;
      if (listCalls >= 3) return Promise.resolve([]);
      return Promise.resolve([
        {
          id: 'release-watch',
          title: 'Release watch',
          scheduleType: 'cron',
          targetType: 'conversation',
          running: false,
          enabled: true,
          cron: '*/15 * * * *',
          prompt: 'Check release state',
          threadMode: 'existing',
          threadConversationId: 'conv-owner',
          threadTitle: 'Release watch thread',
        },
      ]);
    });
    const pa = createPa({ list });
    const { container } = await renderPage(pa);
    const buttons = () => Array.from(container.querySelectorAll('button'));

    await act(async () =>
      buttons()
        .find((button) => button.getAttribute('aria-label') === 'Refresh automations')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    await act(async () =>
      buttons()
        .find((button) => button.getAttribute('aria-label') === 'Actions for Release watch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    await act(async () =>
      buttons()
        .find((button) => button.textContent === 'Delete')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    await flushPromises();

    expect(container.textContent).not.toContain('Release watch');

    staleRefresh.resolve([
      {
        id: 'release-watch',
        title: 'Release watch',
        scheduleType: 'cron',
        targetType: 'conversation',
        running: false,
        enabled: true,
        cron: '*/15 * * * *',
        prompt: 'Check release state',
        threadMode: 'existing',
        threadConversationId: 'conv-owner',
        threadTitle: 'Release watch thread',
      },
    ]);
    await flushPromises();

    expect(pa.automations.delete).toHaveBeenCalledWith('release-watch');
    expect(container.textContent).not.toContain('Release watch');
  });

  it('opens existing automation details from the table title', async () => {
    const pa = createPa();
    const { container } = await renderPage(pa);
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Release watch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(pa.selection.set).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Automation details');
    expect(document.body.textContent).toContain('Release watch');
  });

  it('edits an existing automation from the row action menu', async () => {
    const pa = createPa();
    const { container } = await renderPage(pa);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Actions for Release watch"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    await act(async () =>
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Edit')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(pa.selection.set).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Edit automation');
    expect(document.querySelector<HTMLInputElement>('input[name="automation-title"]')?.value).toBe('Release watch');
  });

  it('saves edits from the automation dialog panel', async () => {
    const pa = createPa();
    vi.mocked(pa.selection.get).mockReturnValue(
      automationSelection(
        {
          kind: 'edit',
          task: {
            id: 'release-watch',
            title: 'Release watch',
            scheduleType: 'cron',
            enabled: true,
            cron: '*/15 * * * *',
            prompt: 'Check release state',
            threadConversationId: 'conv-owner',
            threadTitle: 'Release watch thread',
          },
        },
        'automation:release-watch',
      ) as never,
    );

    await renderRail(pa);
    const title = document.querySelector<HTMLInputElement>('input[name="automation-title"]');
    if (!title) throw new Error('edit title input missing');
    expect(title.value).toBe('Release watch');
    expect(document.querySelector('[aria-label="Enable automation"]')).toBeNull();

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(title, 'Release watch updated');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Save automation')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(pa.automations.update).toHaveBeenCalledWith('release-watch', expect.objectContaining({ title: 'Release watch updated' }));
  });

  it('creates a new owner-threaded conversation automation', async () => {
    const pa = createPa();
    vi.mocked(pa.selection.get).mockReturnValue(automationSelection({ kind: 'new' }) as never);
    await renderRail(pa);
    const title = document.querySelector<HTMLInputElement>('input[name="automation-title"]');
    const owner = document.querySelector<HTMLSelectElement>('select[name="automation-owner-thread"]');
    const prompt = document.querySelector<HTMLTextAreaElement>('textarea[name="automation-prompt"]');
    if (!title || !owner || !prompt) throw new Error('editor controls missing');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(title, 'Morning release check');
      title.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(owner, 'conv-owner');
      owner.dispatchEvent(new Event('change', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(prompt, 'Check release status.');
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Create automation')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(pa.automations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Morning release check',
        prompt: 'Check release status.',
        enabled: true,
        targetType: 'conversation',
        threadMode: 'existing',
        threadConversationId: 'conv-owner',
      }),
    );
  });

  it('validates custom timeout before creating an automation', async () => {
    const pa = createPa();
    vi.mocked(pa.selection.get).mockReturnValue(automationSelection({ kind: 'new' }) as never);
    await renderRail(pa);
    const title = document.querySelector<HTMLInputElement>('input[name="automation-title"]');
    const owner = document.querySelector<HTMLSelectElement>('select[name="automation-owner-thread"]');
    const prompt = document.querySelector<HTMLTextAreaElement>('textarea[name="automation-prompt"]');
    const timeoutPreset = document.querySelector<HTMLSelectElement>('select[name="automation-timeout-preset"]');
    if (!title || !owner || !prompt || !timeoutPreset) throw new Error('editor controls missing');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(title, 'Timeout check');
      title.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(owner, 'conv-owner');
      owner.dispatchEvent(new Event('change', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(prompt, 'Check timeout validation.');
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(timeoutPreset, '__custom');
      timeoutPreset.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const timeout = document.querySelector<HTMLInputElement>('input[name="automation-timeout"]');
    if (!timeout) throw new Error('custom timeout input missing');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(timeout, 'abc');
      timeout.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Create automation')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(pa.automations.create).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter a whole-number timeout from 1 second to 7 days.');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(timeout, '45');
      timeout.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Create automation')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(pa.automations.create).toHaveBeenCalledWith(expect.objectContaining({ timeoutSeconds: 45 }));
  });
});
