import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConversationGoalPanel } from './ConversationGoalPanel';

describe('ConversationGoalPanel', () => {
  it('renders goal with spinner on the left and cancel button', () => {
    const html = renderToStaticMarkup(
      <ConversationGoalPanel goal={{ objective: 'Ship goal mode', status: 'active', tasks: [], stopReason: null, updatedAt: null }} />,
    );

    expect(html).toContain('Goal');
    expect(html).toContain('Ship goal mode');
    expect(html).toContain('Active');
    // Spinner (ui-spinner class) should appear before the Goal label
    expect(html.indexOf('ui-spinner')).toBeGreaterThan(-1);
    expect(html.indexOf('ui-spinner')).toBeLessThan(html.indexOf('Goal'));
    // Cancel button should be present for active goals
    expect(html).toContain('Cancel');
    expect(html).toContain('aria-label="Cancel goal"');
  });

  it('does not render completed goals', () => {
    const html = renderToStaticMarkup(
      <ConversationGoalPanel goal={{ objective: 'Ship goal mode', status: 'complete', tasks: [], stopReason: null, updatedAt: null }} />,
    );

    expect(html).toBe('');
  });

  it('does not render cancel button for paused goals', () => {
    const html = renderToStaticMarkup(
      <ConversationGoalPanel goal={{ objective: 'Ship goal mode', status: 'paused', tasks: [], stopReason: null, updatedAt: null }} />,
    );

    expect(html).toContain('Goal');
    expect(html).toContain('Paused');
    expect(html).not.toContain('Cancel');
    expect(html).not.toContain('ui-spinner');
  });
});
