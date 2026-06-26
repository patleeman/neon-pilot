// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { formatGatewayClientConfig, formatGatewayConfigRows, ModelGatewaySettingsPanel } from './frontend';

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

  it('renders the settings loading state', () => {
    const pa = {
      extension: {
        invoke: vi.fn(async () => ({
          running: false,
          host: '127.0.0.1',
          port: 8766,
          baseUrl: 'http://127.0.0.1:8766/v1',
          models: 1,
          defaultModel: 'auto',
          logs: [],
        })),
      },
      ui: { notify: vi.fn() },
    };
    const html = renderToStaticMarkup(<ModelGatewaySettingsPanel pa={pa as never} />);
    expect(html).toContain('Loading AI Gateway settings');
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
