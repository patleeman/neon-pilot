// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AutomationsPage, shouldOpenNewAutomationFromSearch } from '../../../../../../extensions/system-automations/src/frontend';
import type { NativeExtensionClient } from '../nativePaClient';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots) act(() => root.unmount());
  mountedRoots.length = 0;
  document.body.innerHTML = '';
});

function createPa(overrides: Partial<NativeExtensionClient['automations']> = {}): NativeExtensionClient {
  return {
    extension: { invoke: vi.fn(), getManifest: vi.fn(), listSurfaces: vi.fn() },
    executions: { start: vi.fn(), get: vi.fn(), list: vi.fn(), readLog: vi.fn(), cancel: vi.fn() },
    storage: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
    commands: { execute: vi.fn(async () => true), list: vi.fn(async () => []), setContext: vi.fn() },
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

describe('AutomationsPage', () => {
  it('opens the creation editor from the command-backed route query', async () => {
    expect(shouldOpenNewAutomationFromSearch('?action=new')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?new=1')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?filter=current')).toBe(false);

    await renderPage(createPa(), { search: '?action=new' });

    expect(document.body.textContent).toContain('New automation');
    expect(document.body.textContent).toContain('Create automation');
    const dialog = document.querySelector('[role="dialog"]');
    const title = document.querySelector<HTMLInputElement>('input[name="automation-title"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.querySelector('form')?.className).toContain('flex');
    const body = dialog?.querySelector('.ui-dialog-body');
    expect(body?.className).toContain('flex-col');
    expect(body?.className).not.toContain('grid');
    expect(dialog?.querySelector('.ui-disclosure')?.className).toContain('shrink-0');
    expect(document.querySelector('select[name="automation-model"]')?.closest('.grid')?.className).toContain('items-start');
    expect(title).not.toBeNull();
    expect(document.activeElement).toBe(title);
    expect(document.querySelector('select[name="automation-owner-thread"]')).not.toBeNull();
    expect(document.querySelector('select[name="automation-timeout-preset"]')?.closest('.ui-field')).not.toBeNull();
    expect(document.querySelector('input[name="automation-cwd"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Enable automation"]')).toBeNull();
  });

  it('mounts the creation dialog at document body so the overlay covers desktop chrome', async () => {
    const { container } = await renderPage(createPa(), { search: '?action=new' });

    const backdrop = document.body.querySelector<HTMLElement>(':scope > .ui-overlay-backdrop');
    const dialog = backdrop?.querySelector('[role="dialog"]');

    expect(backdrop).not.toBeNull();
    expect(dialog).not.toBeNull();
    expect(container.querySelector('.ui-overlay-backdrop')).toBeNull();
  });

  it('keeps the empty state as a list-only page until the dialog is opened', async () => {
    const pa = createPa({ list: vi.fn(async () => []) });
    const { container } = await renderPage(pa);

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.textContent).toContain('No automations yet.');
    expect(Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'New automation')).toHaveLength(1);
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
    expect(container.textContent).toContain('Paused check');
    expect(container.textContent).toContain('Paused');
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

  it('edits an existing automation in the modal instead of an inline details pane', async () => {
    const pa = createPa();
    const { container } = await renderPage(pa);
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Release watch')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    const title = document.querySelector<HTMLInputElement>('input[name="automation-title"]');
    if (!title) throw new Error('edit title input missing');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
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
    await renderPage(pa, { search: '?action=new' });
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
});
