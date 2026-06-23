import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConversationComposerMeta } from './ConversationComposerMeta';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

const baseProps: React.ComponentProps<typeof ConversationComposerMeta> = {
  draft: true,
  hasDraftCwd: false,
  draftCwdValue: '',
  draftCwdError: null,
  draftCwdPickBusy: false,
  availableDraftWorkspacePaths: ['/repo'],
  onClearDraftCwdSelection: vi.fn(),
  onSelectDraftWorkspace: vi.fn(),
  onPickDraftCwd: vi.fn(),
  conversationCwdEditorOpen: false,
  currentCwd: null,
  currentCwdLabel: '',
  conversationCwdDraft: '',
  conversationCwdError: null,
  conversationCwdBusy: false,
  conversationCwdPickBusy: false,
  availableConversationWorkspacePaths: ['/repo'],
  onSubmitConversationCwdChange: vi.fn(),
  onCancelConversationCwdEdit: vi.fn(),
  onPickConversationCwd: vi.fn(),
  onBeginConversationCwdEdit: vi.fn(),
  branchLabel: null,
  gitSummaryPresentation: { kind: 'none' },
  sessionTokens: null,
};

describe('ConversationComposerMeta', () => {
  it('renders draft workspace controls', () => {
    const html = renderToString(<ConversationComposerMeta {...baseProps} />);

    expect(html).toContain('Workspace folder');
    expect(html).toContain('/repo');
    expect(html).toContain('Choose folder');
    expect(html).not.toContain('Conversation options');
  });

  it('renders draft cwd errors', () => {
    const html = renderToString(<ConversationComposerMeta {...baseProps} draftCwdValue="~/repo" draftCwdError="bad path" />);

    expect(html).toContain('bad path');
    expect(html).toContain('Workspace folder');
  });

  it('renders saved conversation cwd metadata', () => {
    const html = renderToString(
      <ConversationComposerMeta
        {...baseProps}
        draft={false}
        currentCwd="/repo/project"
        currentCwdLabel="project"
        branchLabel="main"
        gitSummaryPresentation={{ kind: 'diff', added: '+12', deleted: '-3' }}
        sessionTokens={{ total: 50000, contextWindow: 100000 }}
      />,
    );

    expect(html).toContain('Working directory: /repo/project');
    expect(html).toContain('project');
    expect(html).not.toContain('Conversation options');
  });

  it('renders neutral chat cwd without exposing the backing path', () => {
    const html = renderToString(
      <ConversationComposerMeta
        {...baseProps}
        draft={false}
        currentCwd="/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/shared"
        currentCwdLabel="Chat"
      />,
    );

    expect(html).toContain('Chat - no workspace');
    expect(html).toContain('Chat');
    expect(html).not.toContain('chat-workspaces/shared');
  });

  it('renders saved conversation cwd editing as an immediate dropdown picker', () => {
    const html = renderToString(
      <ConversationComposerMeta
        {...baseProps}
        draft={false}
        conversationCwdEditorOpen
        currentCwd="/repo/project"
        currentCwdLabel="project"
        conversationCwdDraft="/repo/project"
        availableConversationWorkspacePaths={['/repo/project', '/repo/other']}
      />,
    );

    expect(html).toContain('Conversation working directory');
    expect(html).toContain('/repo/project');
    expect(html).toContain('/repo/other');
    expect(html).toContain('Choose folder');
    expect(html).toContain('Cancel working directory edit');
    expect(html).not.toContain('Switch');
    expect(html).not.toContain('>Cancel<');
    expect(html).not.toContain('type="text"');
  });
});
