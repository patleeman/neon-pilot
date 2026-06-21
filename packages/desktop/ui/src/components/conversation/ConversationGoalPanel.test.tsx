// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONVERSATION_CANCEL_GOAL_COMMAND_EVENT } from './conversationGoalCommands';
import { ConversationGoalPanel } from './ConversationGoalPanel';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const baseGoal = {
  objective: 'Ship goal mode',
  status: 'active' as const,
  tasks: [],
  stopReason: null,
  startedAt: null,
  updatedAt: null,
};

describe('ConversationGoalPanel', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    vi.restoreAllMocks();
  });

  it('renders goal with spinner on the left and cancel button', () => {
    const html = renderToStaticMarkup(<ConversationGoalPanel goal={baseGoal} />);

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
    const html = renderToStaticMarkup(<ConversationGoalPanel goal={{ ...baseGoal, status: 'complete' }} />);

    expect(html).toBe('');
  });

  it('does not render cancel button for paused goals', () => {
    const html = renderToStaticMarkup(<ConversationGoalPanel goal={{ ...baseGoal, status: 'paused' }} />);

    expect(html).toContain('Goal');
    expect(html).toContain('Paused');
    expect(html).not.toContain('Cancel');
    expect(html).not.toContain('ui-spinner');
  });

  it('handles the shared cancel goal command while active', () => {
    const onCancel = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<ConversationGoalPanel goal={baseGoal} onCancel={onCancel} />);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONVERSATION_CANCEL_GOAL_COMMAND_EVENT));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
