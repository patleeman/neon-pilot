// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GatewaysPage } from './frontend';

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
  CenteredLoadingState: ({ label }: { label: string }) => <div>{label}</div>,
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
  StatusDot: () => <span data-testid="status-dot" />,
  TextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  ToolbarButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
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

function installFetchMock(input?: {
  gateway?: unknown;
  token?: unknown;
  access?: unknown;
  testResult?: unknown;
  patchAccess?: unknown;
}) {
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

    expect(screen.getByText('Loading gateways...')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Gateways' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Telegram' })).toBeTruthy();
    expect(screen.getByText('Configured')).toBeTruthy();
    expect(screen.getByText('Gateways page')).toBeTruthy();
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

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          path: '/api/gateways/telegram/token',
          init: expect.objectContaining({ method: 'DELETE' }),
        }),
      ),
    );
  });

  it('tests Telegram and manages access allowlists', async () => {
    const calls = installFetchMock({ token: { configured: true } });

    render(<GatewaysPage />);
    await screen.findByRole('heading', { name: 'Telegram' });

    fireEvent.click(screen.getByRole('button', { name: 'Test bot' }));
    expect(await screen.findByText('Telegram responded as @neonpilot_bot.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Telegram user ID'), { target: { value: '1191448898' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);

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

  it('shows a recovery state when gateway APIs fail', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: 'gateway unavailable' }, 500)) as never;

    render(<GatewaysPage />);

    expect(await screen.findByText('gateway unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
