/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useNotificationStore: vi.fn(),
  writeClipboardText: vi.fn(),
}));

vi.mock('./notificationStore', () => ({
  useNotificationStore: () => mocks.useNotificationStore(),
}));

vi.mock('../../desktop/clipboard', () => ({
  writeClipboardText: mocks.writeClipboardText,
}));

import { NotificationCenter } from './NotificationCenter';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

describe('NotificationCenter', () => {
  const storeValue = {
    notifications: [
      {
        id: 'notif-1',
        type: 'error' as const,
        message: 'Build failed',
        details: 'ReferenceError: boom',
        source: 'system',
        timestamp: '2026-05-11T12:00:00.000Z',
        count: 2,
        read: false,
        dismissed: false,
      },
    ],
    unreadCount: 1,
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders unread notifications without throwing', () => {
    mocks.useNotificationStore.mockReturnValue(storeValue);

    const html = renderToStaticMarkup(<NotificationCenter onClose={() => undefined} />);

    expect(html).toContain('Notifications');
    expect(html).toContain('Build failed');
  });

  it('copies the notification summary, message, details, source, and repeat count', async () => {
    mocks.writeClipboardText.mockResolvedValue(undefined);
    mocks.useNotificationStore.mockReturnValue(storeValue);

    render(<NotificationCenter onClose={() => undefined} />);
    fireEvent.click(screen.getByLabelText('Copy notification'));

    expect(mocks.writeClipboardText).toHaveBeenCalledWith(expect.stringContaining('Type: Error'));
    expect(mocks.writeClipboardText).toHaveBeenCalledWith(expect.stringContaining('Source: system'));
    expect(mocks.writeClipboardText).toHaveBeenCalledWith(expect.stringContaining('Repeated: 2x'));
    expect(mocks.writeClipboardText).toHaveBeenCalledWith(expect.stringContaining('Build failed'));
    expect(mocks.writeClipboardText).toHaveBeenCalledWith(expect.stringContaining('Details:\nReferenceError: boom'));
    await waitFor(() => expect(screen.getByLabelText('Copy notification').getAttribute('title')).toBe('Copied'));
  });

  it('clears pending copy feedback timers on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    mocks.writeClipboardText.mockResolvedValue(undefined);
    mocks.useNotificationStore.mockReturnValue(storeValue);

    const view = render(<NotificationCenter onClose={() => undefined} />);

    fireEvent.click(screen.getByLabelText('Copy notification'));

    await waitFor(() => expect(screen.getByLabelText('Copy notification').getAttribute('title')).toBe('Copied'));
    const callsBeforeUnmount = clearTimeoutSpy.mock.calls.length;

    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(callsBeforeUnmount + 1);
  });

  it('closes from button, backdrop, and Escape interactions', () => {
    mocks.useNotificationStore.mockReturnValue(storeValue);
    const onClose = vi.fn();

    const { rerender } = render(<NotificationCenter onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close notifications'));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<NotificationCenter onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog', { name: 'Notifications' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<NotificationCenter onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Notifications' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);

    rerender(<NotificationCenter onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
