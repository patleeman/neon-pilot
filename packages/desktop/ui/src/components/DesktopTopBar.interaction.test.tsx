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
        sidebarOpen
        onToggleSidebar={() => {}}
        showRailToggle={false}
        railOpen={false}
        onToggleRail={() => {}}
      />
    </MemoryRouter>,
  );
}

describe('DesktopTopBar interactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears the top-bar search query when the command palette closes', () => {
    renderTopBar();

    const input = screen.getByLabelText('Search threads, models, settings') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'extensions' } });

    expect(input.value).toBe('extensions');

    act(() => {
      window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_STATE_EVENT, { detail: { open: false } }));
    });

    expect(input.value).toBe('');
  });

  it('opens the command palette from top-bar search focus and typed queries', () => {
    const openEvents: Array<{ query?: string; anchorRect?: unknown }> = [];
    const listener = vi.fn((event: Event) => {
      openEvents.push((event as CustomEvent).detail ?? {});
    });
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);

    renderTopBar();

    const input = screen.getByLabelText('Search threads, models, settings') as HTMLInputElement;
    fireEvent.focus(input);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(openEvents.at(-1)).toMatchObject({ query: '' });

    fireEvent.change(input, { target: { value: 'toggle left sidebar' } });

    expect(input.value).toBe('toggle left sidebar');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(openEvents.at(-1)).toMatchObject({ query: 'toggle left sidebar' });

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
          sidebarOpen
          onToggleSidebar={() => {}}
          showRailToggle={false}
          railOpen={false}
          onToggleRail={() => {}}
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
