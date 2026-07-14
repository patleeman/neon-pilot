// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { COMMAND_PALETTE_STATE_EVENT, OPEN_COMMAND_PALETTE_EVENT } from '../commands/commandPaletteEvents.js';
import { APP_NAVIGATION_COMMAND_EVENT, DesktopTopBar } from './DesktopTopBar.js';

function renderTopBar() {
  render(
    <MemoryRouter>
      <DesktopTopBar
        environment={{
          isElectron: true,
          activeHostId: 'local',
          activeHostLabel: 'Local',
          activeHostKind: 'local',
          activeHostSummary: 'Local runtime is healthy.',
        }}
        applications={[]}
        applicationWorkspace={{ pinnedApplicationIds: [], pinsInitialized: false, openViews: [], activeViewId: null }}
        activeApplicationId={null}
        onActivateApplication={() => {}}
        onToggleApplicationPinned={() => {}}
        onCloseApplicationView={() => {}}
      />
    </MemoryRouter>,
  );
}

describe('DesktopTopBar interactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects launcher open state when the command palette opens and closes', () => {
    renderTopBar();

    const launcher = screen.getByRole('button', { name: 'Open Neon Pilot' });
    expect(launcher.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_STATE_EVENT, { detail: { open: true } }));
    });
    expect(launcher.getAttribute('aria-expanded')).toBe('true');

    act(() => {
      window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_STATE_EVENT, { detail: { open: false } }));
    });

    expect(launcher.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the unified launcher from the NeonPilot button', () => {
    const openEvents: Array<{ query?: string; scope?: string; anchorRect?: unknown }> = [];
    const listener = vi.fn((event: Event) => {
      openEvents.push((event as CustomEvent).detail ?? {});
    });
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);

    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'Open Neon Pilot' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(openEvents.at(-1)).toMatchObject({ scope: 'all' });

    window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);
  });

  it('normalizes scoped shortcut opens into the unified launcher', async () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);

    renderTopBar();

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'commands' } }));
    });

    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({ scope: 'all' });

    window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);
  });

  it('handles shared app history navigation commands', async () => {
    window.history.replaceState({ idx: 1 }, '', '/conversations/one');
    window.sessionStorage.setItem('__pa_nav_max_idx__', '1');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderTopBar();

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Go back' }) as HTMLButtonElement).disabled).toBe(false);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(APP_NAVIGATION_COMMAND_EVENT, { detail: { direction: 'back' } }));
    });

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('clears delayed browser navigation sync after unmount', async () => {
    vi.useFakeTimers();
    window.history.replaceState({ idx: 1 }, '', '/conversations/one');
    window.sessionStorage.setItem('__pa_nav_max_idx__', '1');
    const sessionSetItem = vi.spyOn(window.sessionStorage.__proto__, 'setItem');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const view = render(
      <MemoryRouter>
        <DesktopTopBar
          environment={{
            isElectron: true,
            activeHostId: 'local',
            activeHostLabel: 'Local',
            activeHostKind: 'local',
            activeHostSummary: 'Local runtime is healthy.',
          }}
          applications={[]}
          applicationWorkspace={{ pinnedApplicationIds: [], pinsInitialized: false, openViews: [], activeViewId: null }}
          activeApplicationId={null}
          onActivateApplication={() => {}}
          onToggleApplicationPinned={() => {}}
          onCloseApplicationView={() => {}}
        />
      </MemoryRouter>,
    );

    const backButton = screen.getByRole('button', { name: 'Go back' }) as HTMLButtonElement;
    expect(backButton.disabled).toBe(false);

    sessionSetItem.mockClear();
    fireEvent.click(backButton);
    expect(back).toHaveBeenCalledTimes(1);

    view.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(sessionSetItem).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
