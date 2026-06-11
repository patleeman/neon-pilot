/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GatewaysPage, GatewaysSidebar } from './frontend';

vi.mock('@neon-pilot/extensions/ui', () => ({
  ActivityTreeView: ({
    items,
    activeItemId,
    onOpenItem,
  }: {
    items: Array<{ id: string; title: string; subtitle?: string; route?: string }>;
    activeItemId?: string | null;
    onOpenItem?: (item: { id: string; title: string; route?: string }) => void;
  }) => (
    <div role="tree">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-active={activeItemId === item.id ? 'true' : undefined}
          onClick={() => onOpenItem?.(item)}
        >
          {item.title}
          {item.subtitle ? <span>{item.subtitle}</span> : null}
        </button>
      ))}
    </div>
  ),
  AppPageIntro: ({ title, summary, actions }: { title: React.ReactNode; summary?: React.ReactNode; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {summary ? <p>{summary}</p> : null}
      {actions}
    </header>
  ),
  AppPageLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  AppPageSection: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  DataTable: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  DataTableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  DataTableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...props}>{children}</td>,
  DataTableHead: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  DataTableHeaderCell: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...props}>{children}</th>,
  DataTableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  EmptyState: ({ title }: { title: React.ReactNode }) => <p>{title}</p>,
  ErrorState: ({ message }: { message: React.ReactNode }) => <p>{message}</p>,
  Field: ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
    <label>
      <span>{label}</span>
      {children}
    </label>
  ),
  IconButton: ({
    children,
    compact: _compact,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }) => <button {...props}>{children}</button>,
  LoadingState: ({ label }: { label: React.ReactNode }) => <p>{label}</p>,
  Notice: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  PanelMessage: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SectionLabel: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  StatusDot: ({ tone }: { tone: string }) => <span data-tone={tone} />,
  TextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  ToolbarButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

const initialGatewayState = {
  providers: [
    { id: 'telegram', label: 'Telegram', implemented: true, configurationLocation: 'settings' },
    { id: 'slack_mcp', label: 'Slack MCP', implemented: true, configurationLocation: 'settings' },
    {
      id: 'discord',
      label: 'Discord',
      description: 'Route Discord messages into Neon Pilot.',
      implemented: true,
      configurationLocation: 'extension',
      extensionId: 'discord-gateway',
      setupRoute: '/extensions/discord-gateway',
    },
  ],
  connections: [
    {
      id: 'telegram-default',
      provider: 'telegram',
      label: 'Telegram',
      status: 'active',
      enabled: true,
      updatedAt: '2026-06-10T12:00:00.000Z',
    },
  ],
  bindings: [
    {
      id: 'telegram-default:conv-1',
      provider: 'telegram',
      connectionId: 'telegram-default',
      conversationId: 'conv-1',
      conversationTitle: 'Chief of Threads',
      externalChatId: '42',
      externalChatLabel: 'Patrick',
      repliesEnabled: true,
      updatedAt: '2026-06-10T12:00:00.000Z',
    },
  ],
  chatTargets: [
    {
      id: 'telegram-default:chat:42',
      provider: 'telegram',
      connectionId: 'telegram-default',
      externalChatId: '42',
      externalChatLabel: 'Patrick',
      conversationId: 'conv-1',
      conversationTitle: 'Chief of Threads',
      repliesEnabled: true,
      updatedAt: '2026-06-10T12:00:00.000Z',
    },
  ],
  events: [
    {
      id: 'event-1',
      provider: 'telegram',
      kind: 'routing',
      message: 'Telegram attached to Chief of Threads',
      createdAt: '2026-06-10T12:00:00.000Z',
    },
  ],
};

const sessions = [
  { id: 'conv-1', title: 'Chief of Threads', cwd: '/repo', timestamp: '2026-06-10T12:00:00.000Z' },
  { id: 'conv-2', title: 'Gateway Thread', cwd: '/repo', timestamp: '2026-06-10T12:30:00.000Z' },
];

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function renderPage() {
  return render(
    <GatewaysPage
      pa={{} as never}
      context={{ extensionId: 'system-gateways', surfaceId: 'page', pathname: '/gateways', search: '', hash: '', conversationId: 'conv-2' }}
      surface={{} as never}
      params={{}}
    />,
  );
}

function renderSidebar(pathname = '/gateways') {
  const execute = vi.fn().mockResolvedValue(true);
  const view = render(
    <GatewaysSidebar
      pa={{ commands: { execute } } as never}
      context={{ extensionId: 'system-gateways', surfaceId: 'gateways-sidebar', pathname, search: '', hash: '' }}
      surface={{} as never}
      params={{}}
    />,
  );
  return { ...view, execute };
}

let tokenConfigured = true;

describe('GatewaysPage', () => {
  beforeEach(() => {
    tokenConfigured = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (path === '/api/gateways' && method === 'GET') return Promise.resolve(jsonResponse(initialGatewayState));
        if (path === '/api/gateways/telegram/token' && method === 'GET') return Promise.resolve(jsonResponse({ configured: tokenConfigured }));
        if (path === '/api/sessions?limit=100' && method === 'GET') return Promise.resolve(jsonResponse(sessions));
        if (path === '/api/gateways/connections/telegram') {
          return Promise.resolve(
            jsonResponse({
              ...initialGatewayState,
              connections: [{ ...initialGatewayState.connections[0], enabled: false, status: 'paused' }],
            }),
          );
        }
        if (path === '/api/gateways/bindings') {
          return Promise.resolve(
            jsonResponse({
              ...initialGatewayState,
              bindings: [
                ...initialGatewayState.bindings,
                {
                  id: 'telegram-default:conv-2',
                  provider: 'telegram',
                  connectionId: 'telegram-default',
                  conversationId: 'conv-2',
                  conversationTitle: 'Gateway Thread',
                  externalChatId: '43',
                  externalChatLabel: 'Test Chat',
                  repliesEnabled: true,
                  updatedAt: '2026-06-10T12:30:00.000Z',
                },
              ],
            }),
          );
        }
        return Promise.resolve(jsonResponse({ configured: true, state: initialGatewayState }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders backend gateway state and token status', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Gateways' })).toBeTruthy();
    expect(screen.getAllByText('Chief of Threads').length).toBeGreaterThan(0);
    expect(screen.getByText('Telegram attached to Chief of Threads')).toBeTruthy();
    expect(screen.getByText('Credentials saved')).toBeTruthy();
    expect(screen.getAllByText(/1\s*active\s*route/).length).toBeGreaterThan(0);
    expect(screen.getByText('Active Routes')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Discord/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Connections' })).toBeNull();
  });

  it('keeps routing hidden until Telegram credentials are saved', async () => {
    tokenConfigured = false;
    renderPage();

    expect((await screen.findAllByText('Needs Bot Token')).length).toBeGreaterThan(0);
    expect(screen.getByText('Save a bot token to route Telegram chats into conversations.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save Bot Token' })).toBeTruthy();
    expect(screen.queryByLabelText(/Conversation Title/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save Route' })).toBeNull();
  });

  it('toggles Telegram through the backend connection route', async () => {
    renderPage();
    await screen.findAllByText('Chief of Threads');

    const telegramSection = screen.getByRole('heading', { name: 'Telegram' }).closest('section')!;
    fireEvent.click(within(telegramSection).getByRole('button', { name: 'Pause Telegram' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/gateways/connections/telegram',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'paused', enabled: false }),
        }),
      ),
    );
    expect(await screen.findByText('Telegram gateway paused.')).toBeTruthy();
  });

  it('attaches a conversation through the backend bindings route', async () => {
    renderPage();
    await screen.findAllByText('Chief of Threads');

    const telegramSection = screen.getByRole('heading', { name: 'Telegram' }).closest('section')!;
    fireEvent.change(within(telegramSection).getByLabelText(/^Conversation$/), { target: { value: 'conv-2' } });
    fireEvent.change(within(telegramSection).getByLabelText(/Telegram Chat ID/), { target: { value: '43' } });
    fireEvent.change(within(telegramSection).getByLabelText(/Telegram Chat Label/), { target: { value: 'Test Chat' } });
    fireEvent.click(within(telegramSection).getByRole('button', { name: 'Save Route' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/gateways/bindings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            provider: 'telegram',
            conversationId: 'conv-2',
            conversationTitle: 'Gateway Thread',
            externalChatId: '43',
            externalChatLabel: 'Test Chat',
          }),
        }),
      ),
    );
    expect(await screen.findByText('Telegram route saved.')).toBeTruthy();
  });

  it('renders contributed gateway providers in the channel detail', async () => {
    renderPage();
    await screen.findAllByText('Chief of Threads');

    fireEvent.click(screen.getByRole('button', { name: /Discord/ }));

    expect(await screen.findByRole('heading', { name: 'Discord' })).toBeTruthy();
    expect(screen.getByText('Route Discord messages into Neon Pilot.')).toBeTruthy();
    expect(screen.getByText('Provided by discord-gateway')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Setup' })).toBeTruthy();
  });
});

describe('GatewaysSidebar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (path === '/api/gateways' && method === 'GET') return Promise.resolve(jsonResponse(initialGatewayState));
        if (path === '/api/sessions?limit=100' && method === 'GET') return Promise.resolve(jsonResponse(sessions));
        return Promise.resolve(jsonResponse({ error: 'not found' }, false));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows Telegram routes in the extension sidebar', async () => {
    renderSidebar('/conversations/conv-1');

    expect(await screen.findByText('Gateway Routes')).toBeTruthy();
    expect(screen.getByText(/1 active route\s*·\s*Telegram/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Chief of Threads/ }).getAttribute('data-active')).toBe('true');
    expect(screen.getByText(/Telegram\s*·\s*Patrick/)).toBeTruthy();
  });

  it('opens a routed conversation from the sidebar', async () => {
    const { execute } = renderSidebar();

    fireEvent.click(await screen.findByRole('button', { name: /Chief of Threads/ }));

    expect(execute).toHaveBeenCalledWith('app.navigate', { to: '/conversations/conv-1?gateway=1' });
  });
});
