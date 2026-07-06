// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@neon-pilot/extensions/workbench-files', () => ({
  WorkspaceExplorer: ({ cwd, activeFilePath }: { cwd: string; activeFilePath: string | null }) => (
    <div data-active-file-path={activeFilePath ?? ''} data-cwd={cwd} data-testid="workspace-explorer" />
  ),
  WorkspaceFileDocument: ({ cwd, path }: { cwd: string; path: string }) => (
    <div data-cwd={cwd} data-path={path} data-testid="workspace-file-document" />
  ),
}));

Object.assign(globalThis, { React });

const chatWorkspaceCwd = '/Users/patrick/Library/Application Support/Neon Pilot/chat-workspaces/session-1';

function renderWithRouter(ui: React.ReactElement, initialEntry = '/') {
  return render(<MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>);
}

describe('system-files panels', () => {
  it('renders the explorer for legacy chat-workspaces cwd values', async () => {
    const { WorkspaceFilesPanel } = await import('./panels');

    renderWithRouter(
      <WorkspaceFilesPanel context={{ conversationId: 'conv-1', cwd: chatWorkspaceCwd, search: '?workspaceFile=notes.md' } as never} />,
      '/files?workspaceFile=notes.md',
    );

    const explorer = screen.getByTestId('workspace-explorer');
    expect(explorer.getAttribute('data-cwd')).toBe(chatWorkspaceCwd);
    expect(explorer.getAttribute('data-active-file-path')).toBe('notes.md');
    expect(screen.queryByText('Not available in chat conversations')).toBeNull();
  });

  it('renders file detail for legacy chat-workspaces cwd values', async () => {
    const { WorkspaceFileDetailPanel } = await import('./panels');

    renderWithRouter(
      <WorkspaceFileDetailPanel
        context={{ conversationId: 'conv-1', cwd: chatWorkspaceCwd, search: '?workspaceFile=notes.md' } as never}
      />,
    );

    const document = screen.getByTestId('workspace-file-document');
    expect(document.getAttribute('data-cwd')).toBe(chatWorkspaceCwd);
    expect(document.getAttribute('data-path')).toBe('notes.md');
    expect(screen.queryByText('Not available in chat conversations')).toBeNull();
  });

  it('keeps an empty state when no working directory is available', async () => {
    const { WorkspaceFilesPanel } = await import('./panels');

    renderWithRouter(<WorkspaceFilesPanel context={{ conversationId: 'conv-1', cwd: null, search: '' } as never} />);

    expect(screen.getByText('Set a working directory')).toBeTruthy();
    expect(screen.getByText('File Explorer needs a working directory. Open a folder or project to browse and edit files.')).toBeTruthy();
  });
});
