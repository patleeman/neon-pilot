import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConversationSavedHeader } from './ConversationSavedHeader.js';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

describe('ConversationSavedHeader', () => {
  it('makes the title itself the rename trigger when editing is enabled', () => {
    const html = renderToString(<ConversationSavedHeader title="Fix the top bar" onTitleClick={() => {}} />);

    expect(html).toContain('aria-label="Rename conversation: Fix the top bar"');
    expect(html).toContain('>Fix the top bar<');
  });

  it('keeps the saved conversation top bar focused on the title', () => {
    const html = renderToString(<ConversationSavedHeader title="Fix the top bar" />);

    expect(html).toContain('Fix the top bar');
    expect(html).not.toContain('/tmp/neon-pilot');
    expect(html).not.toContain('Choose a new working directory for this conversation');
    expect(html).not.toContain('Enter the working directory manually');
    expect(html).not.toContain('Running');
    expect(html).not.toContain('Needs review');
  });

  it('uses compact workbench title typography', () => {
    const html = renderToString(<ConversationSavedHeader title="New Conversation" />);

    expect(html).toContain('text-[24px]');
    expect(html).toContain('sm:text-[26px]');
    expect(html).toContain('tracking-normal');
    expect(html).not.toContain('text-[32px]');
    expect(html).not.toContain('sm:text-[36px]');
    expect(html).not.toContain('tracking-[-0.018em]');
  });
});
