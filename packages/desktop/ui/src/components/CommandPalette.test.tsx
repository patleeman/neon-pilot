// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { OPEN_COMMAND_PALETTE_EVENT } from '../commands/commandPaletteEvents';
import { setExtensionCommandContext } from '../extensions/commands';
import { CommandPalette } from './CommandPalette';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../hooks/useConversations', () => ({
  useConversations: () => ({
    pinnedSessions: [],
    tabs: [],
    archivedSessions: [],
    openSession: vi.fn(),
    loading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../store', () => ({
  useAllSessions: () => [],
  useSessionsReady: () => true,
}));

describe('CommandPalette', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    setExtensionCommandContext('composer.canSubmit', null);
  });

  it('updates command availability when command context changes while mounted', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    Element.prototype.scrollIntoView = vi.fn();
    setExtensionCommandContext('composer.canSubmit', false);

    render(
      <MemoryRouter initialEntries={['/conversations/conv-1']}>
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'commands', query: 'send message' } }));
    });

    const sendCommand = await screen.findByText('Send Message');
    const sendButton = sendCommand.closest('button');
    expect(sendButton).toBeTruthy();
    expect(sendButton?.disabled).toBe(true);

    act(() => {
      setExtensionCommandContext('composer.canSubmit', true);
    });

    await waitFor(() => {
      expect(sendButton?.disabled).toBe(false);
    });
  });

  it('shows an unavailable message when a command action is not handled', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    Element.prototype.scrollIntoView = vi.fn();
    const listener = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<{ resolve?: (handled: boolean) => void }>).detail;
      detail.resolve?.(false);
    });
    window.addEventListener('neon-pilot-extension-command-execute', listener);

    render(
      <MemoryRouter initialEntries={['/conversations/conv-1']}>
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'commands', query: 'toggle left sidebar' } }));
    });

    const command = await screen.findByText('Toggle Left Sidebar');
    const button = command.closest('button');
    expect(button).toBeTruthy();

    fireEvent.click(button!);

    expect(await screen.findByText('Command is unavailable right now.')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeTruthy();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('neon-pilot-extension-command-execute', listener);
  });

  it('executes a rendered command workflow and closes the palette when handled', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    Element.prototype.scrollIntoView = vi.fn();
    const listener = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<{ command: string; resolve?: (handled: boolean) => void }>).detail;
      expect(detail.command).toBe('layout.toggleSidebar');
      detail.resolve?.(true);
    });
    window.addEventListener('neon-pilot-extension-command-execute', listener);

    render(
      <MemoryRouter initialEntries={['/conversations/conv-1']}>
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'commands', query: 'toggle left sidebar' } }));
    });

    const command = await screen.findByText('Toggle Left Sidebar');
    const button = command.closest('button');
    expect(button).toBeTruthy();

    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
    });
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('neon-pilot-extension-command-execute', listener);
  });
});
