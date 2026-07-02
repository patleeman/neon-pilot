/* @vitest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WindowedLayout } from './WindowedLayout';

const mocks = vi.hoisted(() => ({
  layout: vi.fn(({ children }: { children?: ReactNode }) => (
    <div data-testid="embedded-layout">
      embedded layout
      {children}
    </div>
  )),
  archiveSession: vi.fn(),
}));

vi.mock('./Layout', () => ({
  Layout: mocks.layout,
}));

vi.mock('../extensions/ExtensionRouteHost', async () => {
  const { useLocation } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ExtensionRouteHost: ({ shellPresentation = 'stable' }: { shellPresentation?: 'stable' | 'windowed' }) => {
      const location = useLocation();
      return <div data-testid="extension-route-host">{`${location.pathname}:${shellPresentation}`}</div>;
    },
  };
});

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => ({
    loading: false,
    error: null,
    extensions: [
      {
        id: 'system-routines',
        enabled: true,
        contributes: {
          nav: [{ id: 'routines', label: 'Routines', route: '/routines' }],
        },
      },
    ],
    surfaces: [],
  }),
}));

vi.mock('../hooks/useConversations', () => ({
  useConversations: () => ({
    pinnedSessions: [],
    tabs: [],
    archiveSession: mocks.archiveSession,
  }),
}));

vi.mock('../pages/ConversationPage', () => ({
  ConversationPage: () => <div data-testid="conversation-page">Conversation</div>,
}));

function renderWindowedLayout() {
  return render(
    <BrowserRouter>
      <WindowedLayout />
    </BrowserRouter>,
  );
}

describe('WindowedLayout route windows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.layout.mockClear();
    mocks.archiveSession.mockClear();
  });

  it('renders non-chat routes through the extension host without the embedded stable layout', async () => {
    renderWindowedLayout();

    expect(screen.getByTestId('embedded-layout')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    fireEvent.click(screen.getByRole('button', { name: /routines/i }));

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/routines:windowed');

    const routinesWindow = screen.getByRole('region', { name: /routines/i });
    expect(within(routinesWindow).getByTestId('extension-route-host')).toBeTruthy();
    expect(within(routinesWindow).queryByTestId('embedded-layout')).toBeNull();
    expect(screen.getAllByTestId('embedded-layout')).toHaveLength(1);
  });

  it('keeps the windowed shell app controls text-only without monogram badges or secondary labels', () => {
    const { container } = renderWindowedLayout();

    expect(container.querySelector('.wos-taskbar .wos-app-monogram')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    expect(within(startMenu).getByText('Neon Pilot OS')).toBeTruthy();
    expect(within(startMenu).queryByText('APPS')).toBeNull();
    expect(startMenu.querySelector('.wos-app-monogram')).toBeNull();
  });
});
