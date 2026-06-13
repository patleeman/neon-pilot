import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ModelGatewayPage } from './frontend';

describe('ModelGatewayPage', () => {
  it('renders the gateway page shell', () => {
    const pa = {
      extension: {
        invoke: vi.fn(async () => ({
          running: false,
          host: '127.0.0.1',
          port: 8766,
          baseUrl: 'http://127.0.0.1:8766/v1',
          models: 1,
          defaultModel: 'auto',
        })),
      },
      ui: { notify: vi.fn() },
    };
    const html = renderToStaticMarkup(<ModelGatewayPage pa={pa as never} context={{} as never} surface={{} as never} params={{}} />);
    expect(html).toContain('Loading Model Gateway');
  });
});
