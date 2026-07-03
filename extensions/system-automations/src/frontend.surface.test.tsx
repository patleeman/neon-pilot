// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AutomationsPage } from './frontend';

Object.assign(globalThis, { React });

type SurfaceTask = {
  id: string;
  title: string;
  enabled: boolean;
  running: boolean;
  scheduleType: 'cron';
  cron: string;
  prompt: string;
  threadConversationId: string;
  threadTitle: string;
  lastStatus: string;
};

function createPa(
  tasks: SurfaceTask[] | Promise<SurfaceTask[]> = [
    {
      id: 'task-1',
      title: 'Quarter-hour chime',
      enabled: true,
      running: true,
      scheduleType: 'cron' as const,
      cron: '15,45 * * * *',
      prompt: 'Report the current time.',
      threadConversationId: 'conv-1',
      threadTitle: 'Automation log',
      lastStatus: 'completed',
    },
    {
      id: 'task-2',
      title: 'Release watch',
      enabled: false,
      running: false,
      scheduleType: 'cron' as const,
      cron: '0 9 * * 1',
      prompt: 'Check release blockers.',
      threadConversationId: 'conv-2',
      threadTitle: 'Release thread',
      lastStatus: 'failed',
    },
  ],
) {
  return {
    automations: {
      list: vi.fn(async () => tasks),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
      run: vi.fn(async () => ({})),
    },
    commands: { execute: vi.fn(async () => true) },
    selection: { get: vi.fn(() => null), set: vi.fn(), subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
    ui: { confirm: vi.fn(async () => true), toast: vi.fn(), subscribeInvalidations: vi.fn(() => ({ unsubscribe: vi.fn() })) },
  } as never;
}

describe('AutomationsPage windowed surface', () => {
  it('renders native windowed automation chrome without the stable app page shell', async () => {
    const { container } = render(<AutomationsPage pa={createPa()} context={{ shellPresentation: 'windowed' }} />);

    await waitFor(() => expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard'));

    expect(container.querySelector('.automations-page-windowed')).toBeTruthy();
    expect(container.querySelector('.ui-app-page-shell')).toBeNull();
    expect(container.querySelector('.wos-page-main__header .wos-page-eyebrow')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Task queue' })).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(container.querySelector('.wos-data-table')).toBeTruthy();
    expect(container.querySelector<HTMLElement>('.wos-automation-queue')?.style.getPropertyValue('--wos-data-column-template')).toBe(
      'minmax(12rem, 1fr) minmax(5.75rem, 0.34fr) minmax(0, 1.08fr)',
    );
    expect(container.querySelector('.wos-automation-table')).toBeNull();
    expect(screen.getByText('Quarter-hour chime')).toBeTruthy();
    expect(screen.getByText('Release watch')).toBeTruthy();
    expect(screen.getByText('Quarter-hour chime').closest('.wos-data-row')?.getAttribute('data-selectable')).toBe('true');
    expect(screen.getByText('Quarter-hour chime').closest('.wos-data-row')?.getAttribute('data-accent')).toBe('automations');
    expect(screen.getByText(/15,45 \* \* \* \*/)).toBeTruthy();
    expect(screen.getByText(/Automation log/)).toBeTruthy();
    expect(screen.getAllByText('Running').some((element) => element.closest('.wos-badge')?.getAttribute('data-tone') === 'warning')).toBe(
      true,
    );
    expect(screen.getAllByText('Paused').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Paused').some((element) => element.closest('.wos-badge')?.getAttribute('data-tone') === 'neutral')).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Run Quarter-hour chime' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause Quarter-hour chime' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Quarter-hour chime' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open details for Quarter-hour chime' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open owner thread for Quarter-hour chime: Automation log' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run Release watch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume Release watch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Release watch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Release watch' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
    expect(screen.queryByRole('button', { name: /actions for/i })).toBeNull();
  });

  it('keeps windowed automation rows readable inside narrow app windows', () => {
    const stylesSource = readFileSync(join(process.cwd(), 'packages/windowed-os-ui/src/styles.css'), 'utf8');

    expect(stylesSource).toContain('@container (max-width: 640px)');
    expect(stylesSource).toContain('.wos-automation-queue .wos-data-table__header');
    expect(stylesSource).toContain('.wos-automation-queue .wos-data-row');
    expect(stylesSource).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(stylesSource).toContain('.wos-automation-queue .wos-automation-actions');
    expect(stylesSource).toContain('grid-template-columns: repeat(auto-fit, minmax(4.5rem, 1fr));');
    expect(stylesSource).toContain('.wos-automation-queue .wos-automation-actions .wos-page-button');
    expect(stylesSource).toContain('width: 100%;');
  });

  it('keeps destructive automation actions available in windowed rows', async () => {
    const pa = createPa();
    render(<AutomationsPage pa={pa} context={{ shellPresentation: 'windowed' }} />);

    const deleteButton = await screen.findByRole('button', { name: 'Delete Release watch' });
    expect(deleteButton.closest('.wos-page-button')?.getAttribute('data-tone')).toBe('danger');

    fireEvent.click(deleteButton);

    await waitFor(() => expect(pa.ui.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete automation' })));
    await waitFor(() => expect(pa.automations.delete).toHaveBeenCalledWith('task-2'));
    expect(screen.queryByRole('dialog', { name: 'Automation details' })).toBeNull();
  });

  it('opens automation details with native windowed dialog chrome instead of the stable context rail', async () => {
    const { container } = render(<AutomationsPage pa={createPa()} context={{ shellPresentation: 'windowed' }} />);

    const row = (await screen.findByText('Quarter-hour chime')).closest('.wos-data-row');
    if (!row) throw new Error('Missing automation row');

    fireEvent.click(row);

    const dialog = await screen.findByRole('dialog', { name: 'Automation details' });
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(dialog.className).toContain('wos-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Actions' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'Schedule' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'Owner' })).toBeTruthy();
    expect(within(dialog).getByText('Report the current time.')).toBeTruthy();
    expect(dialog.querySelector('.ui-context-rail')).toBeNull();
    expect(dialog.querySelector('.wos-key-value-list')).toBeTruthy();
    expect(container.querySelector('.ui-context-rail')).toBeNull();
  });

  it('opens automation details from selectable rows with the keyboard', async () => {
    render(<AutomationsPage pa={createPa()} context={{ shellPresentation: 'windowed' }} />);

    const row = (await screen.findByText('Release watch')).closest('.wos-data-row');
    if (!row) throw new Error('Missing automation row');

    fireEvent.keyDown(row, { key: 'Enter' });

    const dialog = await screen.findByRole('dialog', { name: 'Automation details' });
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(within(dialog).getByText('Check release blockers.')).toBeTruthy();
  });

  it('opens automation edit forms with native windowed fields', async () => {
    const { container } = render(<AutomationsPage pa={createPa()} context={{ shellPresentation: 'windowed' }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Quarter-hour chime' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit automation' });
    expect(dialog.querySelector('.ui-context-rail')).toBeNull();
    expect(dialog.querySelectorAll('.wos-form-grid')).toHaveLength(4);
    expect(dialog.querySelector('.wos-field')).toBeTruthy();
    expect(dialog.querySelector('.wos-textarea')).toBeTruthy();
    expect(dialog.querySelector('.wos-select')).toBeTruthy();
    expect(within(dialog).getByRole('switch', { name: 'Disable automation' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Save automation' })).toBeTruthy();
    expect(container.querySelector('.ui-context-rail')).toBeNull();
  });

  it('uses shared windowed empty-state chrome when no automations exist', async () => {
    const { container } = render(<AutomationsPage pa={createPa([])} context={{ shellPresentation: 'windowed' }} />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Task queue' })).toBeTruthy());

    expect(screen.getByText('Schedule prompts into owner threads for recurring reports, checks, and reminders.')).toBeTruthy();
    expect(container.querySelectorAll('.wos-empty-state')).toHaveLength(1);
    expect(container.querySelector('.wos-automation-empty')).toBeNull();
    expect(container.querySelector('.wos-automation-error')).toBeNull();
  });

  it('uses shared windowed state-block chrome while automations are loading', async () => {
    const { container } = render(
      <AutomationsPage pa={createPa(new Promise(() => undefined))} context={{ shellPresentation: 'windowed' }} />,
    );

    await waitFor(() => expect(screen.getByText('Loading automations.')).toBeTruthy());

    expect(screen.getByText('Loading automations.').closest('.wos-state-block')).toBeTruthy();
    expect(container.querySelector('.wos-empty-state')).toBeNull();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
    expect(container.querySelector('.ui-error-state')).toBeNull();
  });

  it('uses shared windowed state-block chrome when automations fail to load', async () => {
    const pa = createPa([]);
    vi.mocked(pa.automations.list).mockRejectedValueOnce(new Error('Automations could not be loaded.'));

    const { container } = render(<AutomationsPage pa={pa} context={{ shellPresentation: 'windowed' }} />);

    await waitFor(() => expect(screen.getByText('Automations could not be loaded.')).toBeTruthy());

    expect(screen.getByText('Automations could not be loaded.').closest('.wos-state-block')?.getAttribute('data-tone')).toBe('danger');
    expect(container.querySelector('.wos-empty-state')).toBeNull();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
    expect(container.querySelector('.ui-error-state')).toBeNull();
  });
});
