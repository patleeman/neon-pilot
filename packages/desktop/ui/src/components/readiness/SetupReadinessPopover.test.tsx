/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  function LocationProbe() {
    const location = useLocation();
    return <span data-testid="current-path">{location.pathname}</span>;
  }
  render(
    <MemoryRouter>
      <SetupReadinessPopover {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );
  return props;
}

describe('SetupReadinessPopover', () => {
  it('renders incomplete setup items without throwing', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SetupReadinessPopover
          snapshot={snapshot}
          loading={false}
          error={null}
          onClose={() => undefined}
          onRefresh={() => undefined}
          onRunAction={async () => undefined}
          onDismiss={async () => undefined}
          onRestore={async () => undefined}
        />
      </MemoryRouter>,
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
      fireEvent.click(screen.getByLabelText('Dismiss setup item'));
    });
    expect(props.onDismiss).toHaveBeenCalledWith('ext', 'cli');
  });

  it('navigates route actions without invoking a backend setup action', () => {
    const routeSnapshot = {
      ...snapshot,
      items: [
        {
          ...snapshot.items[0],
          status: 'blocked' as const,
          actions: [{ id: 'open-extension-settings', label: 'Open Settings', tone: 'default' as const, route: '/settings/extensions/ext' }],
        },
      ],
    };
    const props = renderPopover({ snapshot: routeSnapshot });

    fireEvent.click(screen.getByText('Open Settings'));

    expect(props.onRunAction).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-path').textContent).toBe('/settings/extensions/ext');
  });

  it('shows all and dismissed filters with restore action', async () => {
    const dismissedSnapshot = {
      ...snapshot,
      counts: { ...snapshot.counts, actionable: 0, dismissed: 1 },
      items: [{ ...snapshot.items[0], dismissed: true }, snapshot.items[1]],
    };
    const props = renderPopover({ snapshot: dismissedSnapshot });

    expect(screen.queryByText('Install the Neon Pilot shell command')).toBeNull();
    fireEvent.change(screen.getByLabelText('Setup readiness filter'), { target: { value: 'dismissed' } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Restore setup item'));
    });
    expect(props.onRestore).toHaveBeenCalledWith('ext', 'cli');
    await waitFor(() => expect((screen.getByLabelText('Setup readiness filter') as HTMLSelectElement).value).toBe('incomplete'));

    fireEvent.change(screen.getByLabelText('Setup readiness filter'), { target: { value: 'all' } });
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

  it('shows the actionable count and opens the popover', () => {
    const onClick = vi.fn();
    render(<SetupReadinessButton count={3} onClick={onClick} />);
    fireEvent.click(screen.getByLabelText('Setup needs attention (3 items)'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3')).toBeTruthy();
  });
});
