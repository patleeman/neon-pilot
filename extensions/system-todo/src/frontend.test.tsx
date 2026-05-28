// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TodoShelf } from './frontend';

const state = {
  schemaVersion: 1 as const,
  updatedAt: '2026-05-23T00:00:00.000Z',
  items: [
    {
      id: 'td_open',
      text: 'Open todo',
      status: 'todo' as const,
      createdAt: '2026-05-23T00:00:00.000Z',
      updatedAt: '2026-05-23T00:00:00.000Z',
    },
    {
      id: 'td_done',
      text: 'Done todo',
      status: 'done' as const,
      createdAt: '2026-05-23T00:00:00.000Z',
      updatedAt: '2026-05-23T00:00:00.000Z',
    },
  ],
};

function renderShelf(invoke = vi.fn().mockResolvedValue(state)) {
  const notify = vi.fn();
  render(<TodoShelf pa={{ extension: { invoke }, ui: { notify } }} shelfContext={{ conversationId: 'conv-1' }} />);
  return { invoke, notify };
}

describe('TodoShelf', () => {
  it('renders compact counts and todo rows from extension state', async () => {
    renderShelf();

    expect(await screen.findByText('Todos')).toBeTruthy();
    expect(screen.getByText('1 open · 1 done')).toBeTruthy();
    expect(screen.getByText('Open todo')).toBeTruthy();
    expect(screen.getByText('Done todo')).toBeTruthy();
    expect(screen.queryByText('Doing')).toBeNull();
    expect(screen.queryByText('Block')).toBeNull();
  });

  it('marks open items done and can clear completed items', async () => {
    const nextState = { ...state, items: [{ ...state.items[0]!, status: 'done' as const }, state.items[1]!] };
    const clearedState = { ...state, items: [state.items[0]!] };
    const invoke = vi.fn().mockResolvedValueOnce(state).mockResolvedValueOnce(nextState).mockResolvedValueOnce(clearedState);
    renderShelf(invoke);

    await screen.findByText('Open todo');
    fireEvent.click(screen.getByTitle('Mark complete'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('updateItem', { conversationId: 'conv-1', id: 'td_open', status: 'done' });
    });

    fireEvent.click(screen.getByText('Clear done'));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('clearItems', { conversationId: 'conv-1', scope: 'done' });
    });
  });

  it('collapses and re-expands the shelf without losing state', async () => {
    renderShelf();

    await screen.findByText('Open todo');
    fireEvent.click(screen.getByText('▾'));
    expect(screen.queryByText('Open todo')).toBeNull();
    fireEvent.click(screen.getByText('▸'));
    expect(screen.getByText('Open todo')).toBeTruthy();
  });

  it('renders nothing when there are no todos', async () => {
    const { container } = render(
      <TodoShelf
        pa={{ extension: { invoke: vi.fn().mockResolvedValue({ ...state, items: [] }) } }}
        shelfContext={{ conversationId: 'conv-1' }}
      />,
    );

    await waitFor(() => {
      expect(container.textContent).toBe('');
    });
  });

  it('does not flash a loading shelf before todos load', async () => {
    let resolveState!: (value: typeof state) => void;
    const invoke = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveState = resolve;
      }),
    );
    const { container } = render(<TodoShelf pa={{ extension: { invoke } }} shelfContext={{ conversationId: 'conv-1' }} />);

    expect(container.textContent).toBe('');

    resolveState(state);
    expect(await screen.findByText('Todos')).toBeTruthy();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  it('hides stale todos while loading a different conversation', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(state)
      .mockReturnValueOnce(new Promise(() => {}));
    const { container, rerender } = render(<TodoShelf pa={{ extension: { invoke } }} shelfContext={{ conversationId: 'conv-1' }} />);

    expect(await screen.findByText('Open todo')).toBeTruthy();

    rerender(<TodoShelf pa={{ extension: { invoke } }} shelfContext={{ conversationId: 'conv-2' }} />);

    expect(container.textContent).toBe('');
  });

  it('does not refetch when the extension host passes a fresh pa object for the same conversation', async () => {
    const invoke = vi.fn().mockResolvedValue(state);
    const { rerender } = render(<TodoShelf pa={{ extension: { invoke } }} shelfContext={{ conversationId: 'conv-1' }} />);

    expect(await screen.findByText('Open todo')).toBeTruthy();
    expect(invoke).toHaveBeenCalledTimes(1);

    rerender(<TodoShelf pa={{ extension: { invoke } }} shelfContext={{ conversationId: 'conv-1' }} />);

    await Promise.resolve();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
