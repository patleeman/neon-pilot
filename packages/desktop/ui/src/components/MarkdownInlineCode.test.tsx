import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { InlineMarkdownCode } from './MarkdownInlineCode.js';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

describe('InlineMarkdownCode', () => {
  it('uses wrap-friendly inline code styling for long tokens', () => {
    const html = renderToString(<InlineMarkdownCode>packages/desktop/ui/src/pages/ConversationPage.tsx</InlineMarkdownCode>);

    expect(html).toContain('ui-inline-code');
    expect(html).toContain('ui-inline-code-wrap');
  });
});
