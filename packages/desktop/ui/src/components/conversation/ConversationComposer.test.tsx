import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConversationComposer } from './ConversationComposer';

function renderComposer(notice?: ComponentProps<typeof ConversationComposer>['notice']) {
  return renderToStaticMarkup(
    <ConversationComposer
      dragOver={false}
      hasInteractiveOverlay={false}
      notice={notice}
      inputControls={<div data-testid="input-controls" />}
    />,
  );
}

describe('ConversationComposer', () => {
  it('renders persistent notices with stable composer hooks', () => {
    const html = renderComposer({ tone: 'warning', text: 'Set a vision model in Settings to inspect attached images.' });

    expect(html).toContain('class="ui-composer-notice');
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain('class="ui-pill ui-pill-warning ui-composer-notice__pill"');
    expect(html).toContain('Set a vision model in Settings to inspect attached images.');
  });

  it('omits composer notice chrome when no notice is active', () => {
    const html = renderComposer(null);

    expect(html).not.toContain('ui-composer-notice');
  });
});
