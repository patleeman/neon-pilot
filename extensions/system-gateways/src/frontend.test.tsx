// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GatewaysContextRail, GatewaysPage } from './frontend';

vi.mock('@neon-pilot/extensions/ui', () => ({
  AppPageIntro: ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
    </header>
  ),
  AppPageLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  Button: ({
    children,
    variant: _variant,
    tone: _tone,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; tone?: string }) => <button {...props}>{children}</button>,
  ContextRail: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
  ContextRailBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextRailHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  ),
  ContextRailSection: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <section>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  ),
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  IconButton: ({ children, compact: _compact, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }) => (
    <button {...props}>{children}</button>
  ),
  KeyValueItem: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  ),
  KeyValueList: ({ children }: { children: React.ReactNode }) => <dl>{children}</dl>,
  KeyValueTable: ({ items }: { columns?: number; items: Array<{ label: string; value: React.ReactNode }>; className?: string }) => (
    <dl>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  ),
  Notice: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PanelMessage: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  QuietLoadingState: ({ label }: { label?: string }) => <div role="status" aria-label={label ?? 'Loading'} />,
  SectionLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StatusDot: () => <span data-testid="status-dot" />,
  Switch: ({ checked, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean }) => (
    <button type="button" role="switch" aria-checked={checked} onClick={onClick} {...props} />
  ),
  TextLink: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  TextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  ToolbarButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  WindowedBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  WindowedDataRow: ({
    name,
    meta,
    status,
    action,
  }: {
    name: string;
    meta?: string;
    status?: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div>
      <span>{name}</span>
      {meta ? <span>{meta}</span> : null}
      {status}
      {action}
    </div>
  ),
  WindowedDataTable: ({ children }: { columns: unknown[]; children: React.ReactNode }) => <div>{children}</div>,
  WindowedField: ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <label>
      {label}
      {children}
      {hint ? <span>{hint}</span> : null}
    </label>
  ),
  WindowedKeyValueGrid: ({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) => (
    <dl>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  ),
  WindowedKeyValueList: ({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) => (
    <dl>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  ),
  WindowedList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  WindowedListItem: ({
    title,
    meta,
    detail,
    status,
    onSelect,
  }: {
    title: string;
    meta?: string;
    detail?: string;
    status?: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={onSelect}>
      <span>{title}</span>
      {meta ? <span>{meta}</span> : null}
      {detail ? <span>{detail}</span> : null}
      {status}
    </button>
  ),
  WindowedPageButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  WindowedPageMain: ({
    eyebrow,
    title,
    description,
    actions,
    children,
  }: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <main>
      {eyebrow ? <span>{eyebrow}</span> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
      {children}
    </main>
  ),
  WindowedPageRail: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <nav>
      <h2>{title}</h2>
      {children}
    </nav>
  ),
  WindowedPageSection: ({ title, children, meta }: { title: string; children?: React.ReactNode; meta?: string }) => (
    <section>
      <h3>{title}</h3>
      {meta ? <span>{meta}</span> : null}
      {children}
    </section>
  ),
  WindowedPageShell: ({ children, layout }: { children: React.ReactNode; layout?: string }) => (
    <div className="wos-page-shell" data-layout={layout ?? 'standard'}>
      {children}
    </div>
  ),
  WindowedStateBlock: ({
    title,
    children,
    action,
  }: {
    title?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
    tone?: string;
  }) => (
    <div>
      {title ? <strong>{title}</strong> : null}
      {children}
      {action}
    </div>
  ),
  WindowedTextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  WindowedTimeline: ({ children }: { children: React.ReactNode }) => <ol>{children}</ol>,
  WindowedTimelineItem: ({ title, meta }: { title: string; meta?: string }) => (
    <li>
      <span>{title}</span>
      {meta ? <span>{meta}</span> : null}
    </li>
  ),
  WindowedToggle: ({
    checked,
    label,
    onChange,
    accent: _accent,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    checked: boolean;
    label?: string;
    accent?: string;
    onChange?: (checked: boolean) => void;
  }) => <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange?.(!checked)} {...props} />,
}));

const baseGateway = {
  providers: [
    {
      id: 'telegram',
      label: 'Telegram',
      description: 'Run Neon Pilot from Telegram DMs, groups, and topics.',
      implemented: true,
      configurationLocation: 'gateways',
      setupRoute: '/gateways',
      docsUrl: 'https://core.telegram.org/bots/api',
    },
  ],
  connections: [
    {
      id: 'telegram-default',
      provider: 'telegram',
      label: 'Telegram',
      status: 'needs_config',
      enabled: false,
      updatedAt: '2026-06-26T12:00:00.000Z',
    },
  ],
  events: [],
};

function installFetchMock(input?: { gateway?: unknown; token?: unknown; access?: unknown; testResult?: unknown; patchAccess?: unknown }) {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const gateway = input?.gateway ?? baseGateway;
  const token = input?.token ?? { configured: false };
  const access = input?.access ?? { approvedUserIds: [], approvedChatIds: [] };

  globalThis.fetch = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
    const url = String(path);
    calls.push({ path: url, init });
    if (url === '/api/gateways') return jsonResponse(gateway);
    if (url === '/api/gateways/telegram/token' && (!init?.method || init.method === 'GET')) return jsonResponse(token);
    if (url === '/api/gateways/telegram/access' && (!init?.method || init.method === 'GET')) return jsonResponse(access);
    if (url === '/api/gateways/telegram/token' && init.method === 'POST') {
      return jsonResponse({ configured: true, state: gateway });
    }
    if (url === '/api/gateways/telegram/token' && init.method === 'DELETE') {
      return jsonResponse({ configured: false, state: gateway });
    }
    if (url === '/api/gateways/telegram/test' && init.method === 'POST') {
      return jsonResponse(input?.testResult ?? { ok: true, bot: { username: 'neonpilot_bot' } });
    }
    if (url === '/api/gateways/connections' && init.method === 'POST') return jsonResponse(gateway);
    if (url === '/api/gateways/connections/telegram' && init.method === 'PATCH') return jsonResponse(gateway);
    if (url === '/api/gateways/telegram/access' && init.method === 'PATCH') {
      return jsonResponse(input?.patchAccess ?? JSON.parse(String(init.body)));
    }
    return jsonResponse({ error: `Unhandled ${url}` }, 404);
  }) as never;

  return calls;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('GatewaysPage', () => {
  it('loads Telegram gateway state from the host gateway APIs', async () => {
    installFetchMock({ token: { configured: true } });

    render(<GatewaysPage />);

    expect(screen.getByRole('heading', { name: 'Gateways' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Loading gateway settings' })).toBeTruthy();
    expect(screen.queryByText('Loading gateway settings...')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Gateways' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Telegram' })).toBeTruthy();
    expect(screen.getByText('Configured')).toBeTruthy();
    expect(screen.queryByText('Gateways page')).toBeNull();
  });

  it('renders a native windowed gateways surface when hosted by the windowed shell', async () => {
    const calls = installFetchMock({ token: { configured: true } });
    const { container } = render(<GatewaysPage context={{ shellPresentation: 'windowed' } as never} />);

    expect(await screen.findByText('Gateway provider')).toBeTruthy();
    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('two-column');
    expect(screen.getByRole('button', { name: 'Test bot' })).toBeTruthy();
    expect(screen.getByText('Telegram access')).toBeTruthy();
    expect(screen.getAllByText('Setup').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent activity')).toBeTruthy();
    expect(screen.queryByText('Gateway context')).toBeNull();

    fireEvent.click(screen.getByLabelText('Enable Telegram gateway'));
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          path: '/api/gateways/connections/telegram',
          init: expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"enabled":true') }),
        }),
      ),
    );
  });

  it('keeps the windowed loading state inside the provider shell', async () => {
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {})) as never;

    const { container } = render(<GatewaysPage context={{ shellPresentation: 'windowed' } as never} />);

    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('two-column');
    expect(screen.getByRole('heading', { name: 'Telegram' })).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Loading gateway settings' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Loading' })).toBeNull();
    expect(screen.queryByText('Loading gateway settings.')).toBeNull();
  });

  it('keeps the windowed recovery state inside the provider shell', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: 'gateway unavailable' }, 500)) as never;

    const { container } = render(<GatewaysPage context={{ shellPresentation: 'windowed' } as never} />);

    expect(await screen.findByText('gateway unavailable')).toBeTruthy();
    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('two-column');
    expect(screen.getByRole('heading', { name: 'Telegram' })).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.getByText('Status unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Could not load' })).toBeNull();
  });

  it('saves and clears the bot token through the Telegram token route', async () => {
    const calls = installFetchMock({ token: { configured: true } });

    render(<GatewaysPage />);
    const tokenInput = await screen.findByLabelText('Telegram bot token');
    fireEvent.change(tokenInput, { target: { value: '123456:secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save token' }));

    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          path: '/api/gateways/telegram/token',
          init: expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: '123456:secret' }) }),
        }),
      ),
    );
    expect(await screen.findByText('Telegram token saved and the gateway is enabled.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Telegram bot token' }));
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          path: '/api/gateways/telegram/token',
          init: expect.objectContaining({ method: 'DELETE' }),
        }),
      ),
    );
  });

  it('keeps Telegram gateway controls in the page toolbar', async () => {
    const calls = installFetchMock({ token: { configured: true } });

    render(<GatewaysPage />);
    const toggle = await screen.findByLabelText('Enable Telegram gateway');
    expect(screen.getByRole('button', { name: 'Test Telegram bot' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enable gateway' })).toBeNull();

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          path: '/api/gateways/connections/telegram',
          init: expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"enabled":true') }),
        }),
      ),
    );
  });

  it('tests Telegram and manages access allowlists', async () => {
    const calls = installFetchMock({ token: { configured: true } });

    render(<GatewaysPage />);
    await screen.findByRole('heading', { name: 'Telegram' });

    fireEvent.click(screen.getByRole('button', { name: 'Test Telegram bot' }));
    expect(await screen.findByText('Telegram responded as @neonpilot_bot.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Telegram user ID'), { target: { value: '1191448898' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add approved users' }));

    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          path: '/api/gateways/telegram/access',
          init: expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ approvedUserIds: ['1191448898'], approvedChatIds: [] }),
          }),
        }),
      ),
    );
  });

  it('reloads gateway status when the app invalidates gateways', async () => {
    const activeGateway = {
      ...baseGateway,
      connections: [
        {
          id: 'telegram-default',
          provider: 'telegram',
          label: 'Telegram',
          status: 'active',
          enabled: true,
          updatedAt: '2026-06-26T12:00:00.000Z',
        },
      ],
    };
    const failedGateway = {
      ...activeGateway,
      connections: [
        {
          ...activeGateway.connections[0],
          status: 'needs_attention',
          statusMessage: 'Telegram polling failed: Unauthorized',
        },
      ],
      events: [
        {
          id: 'event-1',
          provider: 'telegram',
          kind: 'error',
          message: 'Telegram polling failed: Unauthorized',
          createdAt: '2026-06-26T12:01:00.000Z',
        },
      ],
    };
    let gateway = activeGateway;
    globalThis.fetch = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
      const url = String(path);
      if (url === '/api/gateways') return jsonResponse(gateway);
      if (url === '/api/gateways/telegram/token' && (!init?.method || init.method === 'GET')) return jsonResponse({ configured: true });
      if (url === '/api/gateways/telegram/access' && (!init?.method || init.method === 'GET')) {
        return jsonResponse({ approvedUserIds: [], approvedChatIds: [] });
      }
      return jsonResponse({ error: `Unhandled ${url}` }, 404);
    }) as never;

    render(<GatewaysPage />);

    expect(await screen.findByText('Active')).toBeTruthy();
    gateway = failedGateway;
    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-app-invalidate', { detail: { topics: ['gateways'] } }));
    });

    expect(await screen.findByText('Needs attention')).toBeTruthy();
    expect(await screen.findByText('Telegram polling failed: Unauthorized')).toBeTruthy();
  });

  it('shows server validation errors for invalid Telegram access IDs', async () => {
    const calls = installFetchMock({
      token: { configured: true },
      patchAccess: { error: 'Telegram access IDs must be numeric. Chat IDs may start with -.' },
    });
    globalThis.fetch = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
      const url = String(path);
      calls.push({ path: url, init });
      if (url === '/api/gateways') return jsonResponse(baseGateway);
      if (url === '/api/gateways/telegram/token' && (!init?.method || init.method === 'GET')) return jsonResponse({ configured: true });
      if (url === '/api/gateways/telegram/access' && (!init?.method || init.method === 'GET')) {
        return jsonResponse({ approvedUserIds: [], approvedChatIds: [] });
      }
      if (url === '/api/gateways/telegram/access' && init?.method === 'PATCH') {
        return jsonResponse({ error: 'Telegram access IDs must be numeric. Chat IDs may start with -.' }, 400);
      }
      return jsonResponse({ error: `Unhandled ${url}` }, 404);
    }) as never;

    render(<GatewaysPage />);
    await screen.findByRole('heading', { name: 'Telegram' });

    fireEvent.change(screen.getByLabelText('Telegram user ID'), { target: { value: '@alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add approved users' }));

    expect(await screen.findByText('Telegram access IDs must be numeric. Chat IDs may start with -.')).toBeTruthy();
  });

  it('shows a recovery state when gateway APIs fail', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: 'gateway unavailable' }, 500)) as never;

    render(<GatewaysPage />);

    expect(await screen.findByText('gateway unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('GatewaysContextRail', () => {
  it('renders provider metadata and recent activity in the right rail', async () => {
    installFetchMock({
      token: { configured: true },
      gateway: {
        ...baseGateway,
        connections: [{ ...baseGateway.connections[0], status: 'active', enabled: true }],
        events: [
          {
            id: 'event-1',
            provider: 'telegram',
            kind: 'status',
            message: 'Telegram gateway enabled',
            createdAt: '2026-06-26T12:01:00.000Z',
          },
        ],
      },
    });

    render(<GatewaysContextRail />);

    expect(await screen.findByText('Telegram')).toBeTruthy();
    expect(screen.queryByText('Loading gateway context...')).toBeNull();
    expect(screen.getByText('Gateways page')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Telegram Bot API' }).getAttribute('href')).toBe('https://core.telegram.org/bots/api');
    expect(screen.getByText('Telegram gateway enabled')).toBeTruthy();
  });
});
