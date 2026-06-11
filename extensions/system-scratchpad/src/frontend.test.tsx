// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ScratchpadPanel } from './frontend';

function renderPanel({
  conversationId = 'conv-1',
  invoke = vi.fn().mockResolvedValue({ conversationId, content: 'Initial note', updatedAt: '2026-06-11T12:00:00.000Z' }),
} = {}) {
  const notify = vi.fn();
  render(
    <ScratchpadPanel
      pa={{ extension: { invoke }, ui: { notify } } as never}
      context={{ conversationId, cwd: '/repo', pathname: '', search: '', hash: '' }}
      surface={{ id: 'scratchpad', extensionId: 'system-scratchpad', title: 'Scratchpad', location: 'rightRail', component: 'ScratchpadPanel' } as never}
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
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('setScratchpad', { conversationId: 'conv-1', content: 'Updated note' });
    });
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('asks for a conversation when opened without one', () => {
    renderPanel({ conversationId: '' });

    expect(screen.getByText('Open a conversation')).toBeTruthy();
  });
});
