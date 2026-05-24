import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NativeExtensionToolBlockHost } from './NativeExtensionToolBlockHost';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

describe('NativeExtensionToolBlockHost', () => {
  it('renders an inline error when a transcript renderer has gone missing', () => {
    const html = renderToStaticMarkup(
      createElement(NativeExtensionToolBlockHost, {
        extension: undefined,
        renderer: undefined,
        block: {
          type: 'tool_use',
          ts: '2026-05-23T20:21:43.000Z',
          tool: 'self_preservation',
          input: {},
          status: 'ok',
        },
        context: {},
      }),
    );

    expect(html).toContain('Extension renderer unavailable for self_preservation.');
  });
});
