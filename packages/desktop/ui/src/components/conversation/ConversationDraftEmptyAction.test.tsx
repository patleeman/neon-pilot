// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ConversationDraftEmptyAction } from './ConversationDraftEmptyAction';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseProps: React.ComponentProps<typeof ConversationDraftEmptyAction> = {
  hasDraftCwd: false,
  draftCwdValue: '',
  draftCwdError: null,
  draftCwdPickBusy: false,
  savedWorkspacePathsLoading: false,
  availableDraftWorkspacePaths: ['/repo'],
  onClearDraftCwdSelection: vi.fn(),
  onSelectDraftWorkspace: vi.fn(),
  onPickDraftCwd: vi.fn(),
};

function renderAction(overrides: Partial<React.ComponentProps<typeof ConversationDraftEmptyAction>> = {}) {
  return renderToString(
    <MemoryRouter>
      <ConversationDraftEmptyAction {...baseProps} {...overrides} />
    </MemoryRouter>,
  );
}

function renderInteractive(overrides: Partial<React.ComponentProps<typeof ConversationDraftEmptyAction>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter>
        <ConversationDraftEmptyAction {...baseProps} {...overrides} />
      </MemoryRouter>,
    );
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('ConversationDraftEmptyAction', () => {
  it('renders chat/workspace selection', () => {
    const html = renderAction();

    expect(html).toContain('Chat');
    expect(html).toContain('Saved workspace');
    expect(html).toContain('Chat — no workspace');
    expect(html).toContain('Choose workspace folder');
  });

  it('summarizes selected workspace paths', () => {
    const html = renderAction({
      hasDraftCwd: true,
      draftCwdValue: '/Users/patrick/workingdir/neon-pilot',
    });

    expect(html).toContain('Workspace');
    expect(html).toContain('neon-pilot');
    expect(html).toContain('/Users/patrick/workingdir');
  });

  it('renders cwd errors without remote controls', () => {
    const html = renderAction({
      draftCwdValue: '~/repo',
      draftCwdError: 'bad path',
    });

    expect(html).toContain('bad path');
    expect(html).toContain('Saved workspace');
  });

  it('keeps the saved workspace picker bounded in narrow layouts', () => {
    const { container, unmount } = renderInteractive({
      availableDraftWorkspacePaths: ['/Users/patrick/workingdir/neon-pilot', '/tmp/neon-pilot-long-worktree'],
    });

    try {
      const workspaceButton = container.querySelector<HTMLButtonElement>('button[aria-label="Saved workspace"]');
      expect(workspaceButton).not.toBeNull();

      const pickerWrapper = workspaceButton?.closest('div');
      expect(pickerWrapper?.className).toContain('min-w-0');
      expect(pickerWrapper?.className).toContain('sm:min-w-[18rem]');
      expect(pickerWrapper?.parentElement?.className).toContain('flex-nowrap');

      act(() => workspaceButton?.click());

      const listbox = container.querySelector<HTMLElement>('[role="listbox"][aria-label="Saved workspaces"]');
      expect(listbox).not.toBeNull();
      expect(listbox?.className).toContain('overflow-y-auto');
      expect(listbox?.style.maxHeight).toBe('min(18rem, 42vh)');
    } finally {
      unmount();
    }
  });
});
