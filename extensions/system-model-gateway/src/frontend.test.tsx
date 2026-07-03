// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { formatGatewayClientConfig, formatGatewayConfigRows, ModelGatewaySettingsPanel } from './frontend';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('ModelGatewaySettingsPanel', () => {
  it('formats Codex setup rows and copy config from gateway status', () => {
    const status = {
      running: true,
      host: '127.0.0.1',
      port: 8766,
      baseUrl: 'http://127.0.0.1:8766/v1',
      authToken: 'secret-token',
      models: 2,
      defaultModel: 'auto',
      catalogPath: '/tmp/catalog.json',
      logs: [],
    };

    expect(formatGatewayConfigRows(status)).toEqual([
      { label: 'Base URL', value: 'http://127.0.0.1:8766/v1' },
      { label: 'Auth token', value: 'secret-token', secret: true },
      { label: 'Default model', value: 'auto' },
      { label: 'Model catalog', value: '/tmp/catalog.json' },
    ]);
    expect(formatGatewayClientConfig(status)).toBe(
      'base_url="http://127.0.0.1:8766/v1"\nauth_token="secret-token"\ndefault_model="auto"\nmodel_catalog="/tmp/catalog.json"',
    );
  });

  it('keeps settings loading chrome visually quiet', () => {
    const status = deferred<never>();
    const pa = {
      extension: {
        invoke: vi.fn(() => status.promise),
      },
      ui: { notify: vi.fn() },
    };
    render(<ModelGatewaySettingsPanel pa={pa as never} />);
    expect(screen.getByRole('status', { name: 'Loading AI Gateway settings' })).toBeTruthy();
    expect(screen.queryByText('Loading AI Gateway settings...')).toBeNull();
  });

  it('renders loaded setup rows and guided copy action', async () => {
    const pa = {
      extension: {
        invoke: vi.fn(async () => ({
          running: true,
          host: '127.0.0.1',
          port: 8766,
          baseUrl: 'http://127.0.0.1:8766/v1',
          authToken: 'secret-token',
          models: 2,
          defaultModel: 'auto',
          catalogPath: '/tmp/catalog.json',
          logs: [],
        })),
      },
      ui: { notify: vi.fn() },
    };

    render(<ModelGatewaySettingsPanel pa={pa as never} />);

    await waitFor(() => expect(screen.getByText('Codex client setup')).toBeTruthy());
    expect(screen.getByText('Endpoint')).toBeTruthy();
    expect(screen.getAllByText('http://127.0.0.1:8766/v1')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Copy Codex config' })).toBeTruthy();
  });

  it('renders a native windowed settings surface without stable table chrome', async () => {
    const pa = {
      extension: {
        invoke: vi.fn(async () => ({
          running: true,
          host: '127.0.0.1',
          port: 8766,
          baseUrl: 'http://127.0.0.1:8766/v1',
          authToken: 'secret-token',
          models: 2,
          defaultModel: 'auto',
          catalogPath: '/tmp/catalog.json',
          logs: [
            {
              id: 'log-1',
              at: '2026-07-03T05:00:00.000Z',
              method: 'POST',
              path: '/v1/responses',
              status: 200,
              model: 'gpt-5.4',
              durationMs: 183,
            },
          ],
        })),
      },
      ui: { notify: vi.fn() },
    };

    const { container } = render(<ModelGatewaySettingsPanel pa={pa as never} settingsContext={{ shellPresentation: 'windowed' }} />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Loopback endpoint' })).toBeTruthy());
    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(screen.getByRole('heading', { name: 'AI Gateway' })).toBeTruthy();
    expect(container.querySelector('.wos-page-section')).toBeTruthy();
    expect(container.querySelector('.wos-key-value-grid')).toBeTruthy();
    expect(container.querySelector('.wos-data-table')).toBeTruthy();
    expect(container.querySelector('.ui-data-table')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Listener' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Codex client setup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy config' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear logs' }).getAttribute('data-tone')).toBe('danger');
    expect(screen.getByText('POST /v1/responses')).toBeTruthy();
    expect(screen.getByText('183ms')).toBeTruthy();
  });

  it('keeps windowed loading state inside the canonical page shell', () => {
    const status = deferred<never>();
    const pa = {
      extension: {
        invoke: vi.fn(() => status.promise),
      },
      ui: { notify: vi.fn() },
    };

    const { container } = render(<ModelGatewaySettingsPanel pa={pa as never} settingsContext={{ shellPresentation: 'windowed' }} />);

    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(screen.getByRole('heading', { name: 'AI Gateway' })).toBeTruthy();
    expect(screen.getByText('Loading AI Gateway settings.').closest('.wos-state-block')).toBeTruthy();
  });

  it('shows a user-facing message when clipboard copy is blocked', async () => {
    const writeText = vi.fn(async () => {
      throw new DOMException("Failed to execute 'writeText' on 'Clipboard': Write permission denied.", 'NotAllowedError');
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const pa = {
      extension: {
        invoke: vi.fn(async () => ({
          running: true,
          host: '127.0.0.1',
          port: 8766,
          baseUrl: 'http://127.0.0.1:8766/v1',
          authToken: 'secret-token',
          models: 2,
          defaultModel: 'auto',
          catalogPath: '/tmp/catalog.json',
          logs: [],
        })),
      },
      ui: { notify: vi.fn() },
    };

    render(<ModelGatewaySettingsPanel pa={pa as never} />);

    await waitFor(() => expect(screen.getByText('Codex client setup')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Copy Codex config' }));

    await waitFor(() =>
      expect(screen.getByText('Could not copy the config. Copy the setup values manually from the rows below.')).toBeTruthy(),
    );
    expect(screen.queryByText(/Failed to execute 'writeText'/)).toBeNull();
  });
});
