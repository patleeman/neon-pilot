// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CaffeinateToggle } from './frontend';

function createClient(invoke: ReturnType<typeof vi.fn>) {
  return {
    extension: { invoke },
    ui: { notify: vi.fn() },
  };
}

describe('CaffeinateToggle', () => {
  it('loads the current backend status when the top-bar button mounts', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'caffeinateStatus') return { running: true, pid: 1234 };
      return { running: false, pid: null };
    });

    render(<CaffeinateToggle pa={createClient(invoke) as never} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop caffeinate' })).toBeTruthy());
    expect(invoke).toHaveBeenCalledWith('caffeinateStatus', {});
  });

  it('toggles caffeinate and reflects the returned status', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'caffeinateStatus') return { running: false, pid: null };
      if (action === 'caffeinateToggle') return { running: true, pid: 4321 };
      return { running: false, pid: null };
    });

    render(<CaffeinateToggle pa={createClient(invoke) as never} />);

    const startButton = await screen.findByRole('button', { name: 'Start caffeinate' });
    fireEvent.click(startButton);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop caffeinate' })).toBeTruthy());
    expect(invoke).toHaveBeenCalledWith('caffeinateToggle', {});
  });
});
