// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ScratchpadPanel } from './frontend';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function renderPanel({
  conversationId = 'conv-1',
  invoke = vi.fn().mockResolvedValue({ conversationId, content: 'Initial note', updatedAt: '2026-06-11T12:00:00.000Z' }),
} = {}) {
  const notify = vi.fn();
  render(
    <ScratchpadPanel
      pa={{ extension: { invoke }, ui: { notify } } as never}
      context={{ conversationId, cwd: '/repo', pathname: '', search: '', hash: '' }}
      surface={
        {
          id: 'scratchpad',
          extensionId: 'system-scratchpad',
          title: 'Scratchpad',
          location: 'rightRail',
          component: 'ScratchpadPanel',
        } as never
      }
      params={{}}
    />,
  );
  return { invoke, notify };
}

describe('ScratchpadPanel', () => {
  it('loads and saves conversation scratchpad content', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ conversationId: 'conv-1', content: 'Initial note', updatedAt: '2026-06-11T12:00:00.000Z' })
      .mockResolvedValueOnce({ conversationId: 'conv-1', content: 'Updated note', updatedAt: '2026-06-11T12:01:00.000Z' });

    renderPanel({ invoke });

    const editor = await screen.findByLabelText('Conversation scratchpad');
    expect((editor as HTMLTextAreaElement).value).toBe('Initial note');

    fireEvent.change(editor, { target: { value: 'Updated note' } });

    await waitFor(
      () => {
        expect(invoke).toHaveBeenCalledWith('setScratchpad', { conversationId: 'conv-1', content: 'Updated note' });
      },
      { timeout: 1200 },
    );
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('asks for a conversation when opened without one', () => {
    renderPanel({ conversationId: '' });

    expect(screen.getByText('Open a conversation')).toBeTruthy();
  });

  it('ignores stale scratchpad loads after switching conversations', async () => {
    const firstLoad = deferred<{ conversationId: string; content: string; updatedAt: string }>();
    const secondLoad = deferred<{ conversationId: string; content: string; updatedAt: string }>();
    const invoke = vi.fn().mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(secondLoad.promise);
    const notify = vi.fn();
    const surface = {
      id: 'scratchpad',
      extensionId: 'system-scratchpad',
      title: 'Scratchpad',
      location: 'rightRail',
      component: 'ScratchpadPanel',
    } as never;
    const { rerender } = render(
      <ScratchpadPanel
        pa={{ extension: { invoke }, ui: { notify } } as never}
        context={{ conversationId: 'conv-1', cwd: '/repo', pathname: '', search: '', hash: '' }}
        surface={surface}
        params={{}}
      />,
    );

    rerender(
      <ScratchpadPanel
        pa={{ extension: { invoke }, ui: { notify } } as never}
        context={{ conversationId: 'conv-2', cwd: '/repo', pathname: '', search: '', hash: '' }}
        surface={surface}
        params={{}}
      />,
    );

    secondLoad.resolve({ conversationId: 'conv-2', content: 'Second note', updatedAt: '2026-06-11T12:02:00.000Z' });
    const editor = await screen.findByLabelText('Conversation scratchpad');
    await waitFor(() => expect((editor as HTMLTextAreaElement).value).toBe('Second note'));

    firstLoad.resolve({ conversationId: 'conv-1', content: 'Stale first note', updatedAt: '2026-06-11T12:01:00.000Z' });
    await Promise.resolve();

    expect((editor as HTMLTextAreaElement).value).toBe('Second note');
  });
});
