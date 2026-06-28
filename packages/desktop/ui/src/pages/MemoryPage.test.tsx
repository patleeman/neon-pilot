// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import type { ManagedMemoryState } from '../shared/types';
import { MemoryPage } from './MemoryPage';

vi.mock('../client/api', () => ({
  api: {
    createMemoryScope: vi.fn(),
    initializeManagedMemory: vi.fn(),
    managedMemory: vi.fn(),
    memoryFileHistory: vi.fn(),
    writeMemoryFile: vi.fn(),
  },
}));

const initializedState: ManagedMemoryState = {
  initialized: true,
  root: '/Users/patrick/Documents/neon-pilot/memory',
  system: {
    relativePath: 'system.md',
    path: '/Users/patrick/Documents/neon-pilot/memory/system.md',
    exists: true,
    content: '# System Memory\n\nRemember concise output.\n',
    loaded: true,
    updatedAt: '2026-06-28T12:00:00.000Z',
  },
  scopes: [
    {
      slug: 'neon-pilot',
      name: 'Neon Pilot',
      type: 'workspace',
      relativePath: 'scopes/neon-pilot/memory.md',
      path: '/Users/patrick/Documents/neon-pilot/memory/scopes/neon-pilot/memory.md',
      roots: ['/Users/patrick/workingdir/neon-pilot'],
      aliases: ['neon pilot'],
      inject: true,
      active: true,
      content: '# Neon Pilot\n\nUse repo conventions.\n',
      updatedAt: '2026-06-28T12:00:00.000Z',
    },
  ],
  skills: [
    {
      name: 'code-review',
      description: 'Review code changes',
      relativePath: 'skills/code-review/SKILL.md',
      path: '/Users/patrick/Documents/neon-pilot/memory/skills/code-review/SKILL.md',
      content: '---\nname: code-review\ndescription: Review code changes\n---\n',
      source: 'memory',
    },
  ],
  recentChanges: [
    {
      hash: 'abcdef123',
      author: 'Neon Pilot Memory',
      date: '2026-06-28T12:00:00.000Z',
      subject: 'Remember concise output',
      files: ['system.md'],
    },
  ],
  git: {
    initialized: true,
    branch: 'main',
    remoteUrl: null,
  },
};

describe('MemoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.memoryFileHistory).mockResolvedValue({ history: [] });
  });

  it('offers to create memory when the repository is not initialized', async () => {
    vi.mocked(api.managedMemory).mockResolvedValue({
      ...initializedState,
      initialized: false,
      recentChanges: [],
    });
    vi.mocked(api.initializeManagedMemory).mockResolvedValue(initializedState);

    render(<MemoryPage />);

    expect(await screen.findByText('Create local memory')).toBeTruthy();
    fireEvent.click(screen.getByText('Create memory'));

    await waitFor(() => expect(api.initializeManagedMemory).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText('system.md').length).toBeGreaterThan(0));
    await waitFor(() => expect(api.memoryFileHistory).toHaveBeenCalledTimes(2));
  });

  it('renders system, scopes, skills, recent changes, and saves edits', async () => {
    vi.mocked(api.managedMemory).mockResolvedValue(initializedState);
    vi.mocked(api.memoryFileHistory).mockResolvedValue({ history: initializedState.recentChanges });
    vi.mocked(api.writeMemoryFile).mockResolvedValue({
      ...initializedState,
      system: { ...initializedState.system, content: '# System Memory\n\nUpdated.\n' },
      recentChanges: [
        {
          hash: 'fedcba987',
          author: 'Neon Pilot Memory',
          date: '2026-06-28T12:05:00.000Z',
          subject: 'Update system memory',
          files: ['system.md'],
        },
        ...initializedState.recentChanges,
      ],
    });

    render(<MemoryPage />);

    await waitFor(() => expect(screen.getAllByText('system.md').length).toBeGreaterThan(0));
    expect(screen.getByText('Neon Pilot')).toBeTruthy();
    expect(screen.getByText('code-review')).toBeTruthy();
    expect(screen.getAllByText('Remember concise output').length).toBeGreaterThan(0);
    const historyCallsBeforeSave = vi.mocked(api.memoryFileHistory).mock.calls.length;

    fireEvent.click(screen.getByText('Edit'));
    const editor = screen.getAllByRole('textbox')[0] as HTMLTextAreaElement;
    expect(editor.value).toBe('# System Memory\n\nRemember concise output.\n');
    fireEvent.change(editor, { target: { value: '# System Memory\n\nUpdated.\n' } });
    fireEvent.change(screen.getByPlaceholderText('Commit reason'), { target: { value: 'Update system memory' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(api.writeMemoryFile).toHaveBeenCalledWith({
        relativePath: 'system.md',
        content: '# System Memory\n\nUpdated.\n',
        reason: 'Update system memory',
      }),
    );
    expect(await screen.findByText(/Updated/)).toBeTruthy();
    await waitFor(() => expect(api.memoryFileHistory).toHaveBeenCalledTimes(historyCallsBeforeSave + 1));
  });
});
