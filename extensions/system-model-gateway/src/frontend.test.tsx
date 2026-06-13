import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ModelGatewaySettingsPanel } from './frontend';

describe('ModelGatewaySettingsPanel', () => {
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
    expect(html).toContain('Loading Model Gateway settings');
  });
});
