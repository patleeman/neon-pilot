/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { SetupReadinessSnapshot } from '../../shared/types';
import { SetupReadinessButton } from './SetupReadinessButton';
import { SetupReadinessPopover } from './SetupReadinessPopover';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

const snapshot: SetupReadinessSnapshot = {
  checkedAt: '2026-06-30T12:00:00.000Z',
  counts: { total: 2, ready: 1, incomplete: 1, actionable: 1, dismissed: 0, blocked: 0, unknown: 0 },
  items: [
    {
      key: 'ext:cli',
      extensionId: 'ext',
      extensionName: 'Neon Pilot CLI',
      id: 'cli',
      title: 'Install the Neon Pilot shell command',
      description: 'Adds the neon-pilot command to your user shell path.',
      capability: 'Command line',
      severity: 'recommended',
      status: 'needs_setup',
      detail: 'Shell link is missing.',
      dismissed: false,
      dismissible: true,
      actions: [{ id: 'install', label: 'Install', tone: 'primary' }],
      checkedAt: '2026-06-30T12:00:00.000Z',
      order: 0,
    },
    {
      key: 'ext:ready',
      extensionId: 'ext',
      extensionName: 'Neon Pilot CLI',
      id: 'ready',
      title: 'Ready item',
      description: 'Already set.',
      severity: 'optional',
      status: 'ready',
      dismissed: false,
      dismissible: true,
      actions: [],
      checkedAt: '2026-06-30T12:00:00.000Z',
      order: 1,
    },
  ],
};

function renderPopover(overrides: Partial<React.ComponentProps<typeof SetupReadinessPopover>> = {}) {
  const props = {
    snapshot,
    loading: false,
    error: null,
    onClose: vi.fn(),
    onRefresh: vi.fn(),
    onRunAction: vi.fn(async () => undefined),
    onDismiss: vi.fn(async () => undefined),
    onRestore: vi.fn(async () => undefined),
    ...overrides,
  };
  render(<SetupReadinessPopover {...props} />);
  return props;
}

describe('SetupReadinessPopover', () => {
  it('renders incomplete setup items without throwing', () => {
    const html = renderToStaticMarkup(
      <SetupReadinessPopover
        snapshot={snapshot}
        loading={false}
        error={null}
        onClose={() => undefined}
        onRefresh={() => undefined}
        onRunAction={async () => undefined}
        onDismiss={async () => undefined}
        onRestore={async () => undefined}
      />,
    );

    expect(html).toContain('Setup Readiness');
    expect(html).toContain('Install the Neon Pilot shell command');
    expect(html).not.toContain('Ready item');
  });

  it('runs item actions and supports dismissing incomplete items', async () => {
    const props = renderPopover();

    await act(async () => {
      fireEvent.click(screen.getByText('Install'));
    });
    expect(props.onRunAction).toHaveBeenCalledWith('ext', 'cli', 'install');
    await waitFor(() => expect((screen.getByText('Install') as HTMLButtonElement).disabled).toBe(false));

    await act(async () => {
      fireEvent.click(screen.getByText('Dismiss'));
    });
    expect(props.onDismiss).toHaveBeenCalledWith('ext', 'cli');
  });

  it('shows all and dismissed filters with restore action', async () => {
    const dismissedSnapshot = {
      ...snapshot,
      counts: { ...snapshot.counts, actionable: 0, dismissed: 1 },
      items: [{ ...snapshot.items[0], dismissed: true }, snapshot.items[1]],
    };
    const props = renderPopover({ snapshot: dismissedSnapshot });

    expect(screen.queryByText('Install the Neon Pilot shell command')).toBeNull();
    fireEvent.click(screen.getByText('Dismissed'));
    await act(async () => {
      fireEvent.click(screen.getByText('Restore'));
    });
    expect(props.onRestore).toHaveBeenCalledWith('ext', 'cli');

    fireEvent.click(screen.getByText('All'));
    expect(screen.getByText('Ready item')).toBeTruthy();
  });

  it('closes from button, backdrop, and Escape interactions', () => {
    const props = renderPopover();

    fireEvent.click(screen.getByLabelText('Close setup readiness'));
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('dialog', { name: 'Setup readiness' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });
});

describe('SetupReadinessButton', () => {
  it('hides when there are no incomplete setup items', () => {
    const { container } = render(<SetupReadinessButton count={0} onClick={() => undefined} />);
    expect(container.textContent).toBe('');
  });

  it('shows the actionable count and opens the drawer', () => {
    const onClick = vi.fn();
    render(<SetupReadinessButton count={3} onClick={onClick} />);
    fireEvent.click(screen.getByLabelText('Setup needs attention (3 items)'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3')).toBeTruthy();
  });
});
