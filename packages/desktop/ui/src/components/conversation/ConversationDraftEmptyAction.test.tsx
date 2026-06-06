import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ConversationDraftEmptyAction } from './ConversationDraftEmptyAction';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

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
});
