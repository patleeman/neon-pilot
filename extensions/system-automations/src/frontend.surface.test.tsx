// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AutomationsPage } from './frontend';

Object.assign(globalThis, { React });

function createPa() {
  return {
    automations: {
      list: vi.fn(async () => [
        {
          id: 'task-1',
          title: 'Quarter-hour chime',
          enabled: true,
          running: true,
          scheduleType: 'cron',
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
          scheduleType: 'cron',
          cron: '0 9 * * 1',
          prompt: 'Check release blockers.',
          threadConversationId: 'conv-2',
          threadTitle: 'Release thread',
          lastStatus: 'failed',
        },
      ]),
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
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Task queue' })).toBeTruthy();
    expect(screen.getByText('Quarter-hour chime')).toBeTruthy();
    expect(screen.getByText('Release watch')).toBeTruthy();
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getAllByText('Paused').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Run' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /actions for/i })).toBeNull();
  });
});
