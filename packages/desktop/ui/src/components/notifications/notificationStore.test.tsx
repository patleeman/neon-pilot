/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { NotificationProvider, useNotificationStore } from './notificationStore';

function NotificationProbe() {
  const { notifications, unreadCount } = useNotificationStore();
  const visible = notifications.filter((notification) => !notification.dismissed);

  return (
    <div>
      <span data-testid="unread-count">{unreadCount}</span>
      {visible.map((notification) => (
        <article key={notification.id}>
          <h2>{notification.message}</h2>
          {notification.details ? <pre>{notification.details}</pre> : null}
          {notification.source ? <span>{notification.source}</span> : null}
        </article>
      ))}
    </div>
  );
}

function renderNotifications() {
  return render(
    <NotificationProvider>
      <NotificationProbe />
    </NotificationProvider>,
  );
}

describe('NotificationProvider', () => {
  it('preserves helpful details from notification events', () => {
    renderNotifications();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', {
          detail: {
            type: 'warning',
            message: 'Connection paused',
            details: 'Retry after the current run finishes.',
            source: 'system',
          },
        }),
      );
    });

    expect(screen.getByRole('heading', { name: 'Connection paused' })).toBeTruthy();
    expect(screen.getByText('Retry after the current run finishes.')).toBeTruthy();
    expect(screen.getByText('system')).toBeTruthy();
    expect(screen.getByTestId('unread-count').textContent).toBe('1');
  });

  it('removes internal route and stack details before notifications render', () => {
    renderNotifications();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', {
          detail: {
            type: 'error',
            message: 'Workspace failed to load',
            details: [
              'Error: Local API route did not complete for GET /api/workspace/tree at Module.ep',
              '(file:///Users/patrick/workingdir/neon-pilot/packages/desktop/server/dist/app/localApi.js:132:20)',
            ].join('\n'),
            source: 'workspace',
          },
        }),
      );
    });

    expect(screen.getByRole('heading', { name: 'Workspace failed to load' })).toBeTruthy();
    expect(screen.queryByText(/Local API route did not complete/i)).toBeNull();
    expect(screen.queryByText(/localApi\.js/i)).toBeNull();
  });

  it('replaces raw diagnostic messages with a short fallback', () => {
    renderNotifications();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('neon-pilot-notification', {
          detail: {
            type: 'error',
            message: 'Error: Local API route did not complete for GET /api/workspace/tree at Module.ep',
            source: 'workspace',
          },
        }),
      );
    });

    expect(screen.getByRole('heading', { name: 'Something went wrong.' })).toBeTruthy();
    expect(screen.queryByText(/\/api\/workspace\/tree/i)).toBeNull();
    expect(screen.getByTestId('unread-count').textContent).toBe('1');
  });
});
