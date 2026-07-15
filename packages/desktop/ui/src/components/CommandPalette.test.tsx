// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { OPEN_COMMAND_PALETTE_EVENT } from '../commands/commandPaletteEvents';
import { setExtensionCommandContext } from '../extensions/commands';
import type { ApplicationNavigationRegistration, ApplicationRegistration } from '../extensions/extensionRegistryProjection';
import { CommandPalette } from './CommandPalette';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const conversationMocks = vi.hoisted(() => ({
  state: {
    pinnedSessions: [],
    tabs: [],
    archivedSessions: [],
    openSession: vi.fn(),
    loading: false,
    refetch: vi.fn(),
  },
}));

const extensionRegistryMocks = vi.hoisted(() => ({
  state: {
    applications: [] as Array<Partial<ApplicationRegistration>>,
    applicationNavigation: [] as Array<Partial<ApplicationNavigationRegistration>>,
  },
}));

vi.mock('../hooks/useConversations', () => ({
  useConversations: () => conversationMocks.state,
}));

vi.mock('../store', () => ({
  useAllSessions: () => [],
  useSessionsReady: () => true,
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => extensionRegistryMocks.state,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

describe('CommandPalette', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    setExtensionCommandContext('composer.canSubmit', null);
    setExtensionCommandContext('browser.active', null);
    setExtensionCommandContext('setup.open', null);
    conversationMocks.state.pinnedSessions = [];
    conversationMocks.state.tabs = [];
    conversationMocks.state.archivedSessions = [];
    conversationMocks.state.openSession = vi.fn();
    conversationMocks.state.loading = false;
    conversationMocks.state.refetch = vi.fn();
    extensionRegistryMocks.state.applications = [];
    extensionRegistryMocks.state.applicationNavigation = [];
  });

  it('updates command availability when command context changes while mounted', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    vi.spyOn(api, 'conversationContentSearch').mockResolvedValue({ matches: [] } as Awaited<
      ReturnType<typeof api.conversationContentSearch>
    >);
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

  it('uses command context that changed before the palette opens', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    Element.prototype.scrollIntoView = vi.fn();
    setExtensionCommandContext('browser.active', true);

    render(
      <MemoryRouter initialEntries={['/conversations/conv-1']}>
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'commands', query: 'new browser tab' } }));
    });

    const command = await screen.findByText('New Browser Tab');
    const button = command.closest('button');
    expect(button).toBeTruthy();
    expect(button?.disabled).toBe(false);
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
    expect(screen.getByRole('dialog', { name: 'Launcher' })).toBeTruthy();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('neon-pilot-extension-command-execute', listener);
  });

  it('shows the command empty state while unrelated quick-open providers are still loading', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockReturnValue(new Promise(() => []));
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <MemoryRouter initialEntries={['/conversations/conv-1']}>
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'commands', query: 'zzzzzz-not-a-real-command' } }),
      );
    });

    expect(await screen.findByText('No items match “zzzzzz-not-a-real-command”.')).toBeTruthy();
    expect(screen.queryByText('Loading commands…')).toBeNull();
  });

  it('keeps command identifiers searchable without rendering internal IDs', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-extension-manager',
        surfaceId: 'open',
        title: 'Open Extensions',
        action: 'open',
        description: 'Manage installed extensions.',
      },
    ]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <MemoryRouter initialEntries={['/conversations/conv-1']}>
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'commands', query: 'layout.toggleSidebar' } }));
    });

    expect(await screen.findByText('Toggle Left Sidebar')).toBeTruthy();
    let dialog = screen.getByRole('dialog', { name: 'Launcher' });
    expect(dialog.textContent).not.toContain('layout.toggleSidebar');

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'commands', query: 'system-extension-manager' } }),
      );
    });

    expect(await screen.findByText('Open Extensions')).toBeTruthy();
    dialog = screen.getByRole('dialog', { name: 'Launcher' });
    expect(dialog.textContent).toContain('Manage installed extensions.');
    expect(dialog.textContent).not.toContain('system-extension-manager');
    expect(dialog.textContent).not.toContain('system-extension-manager.open');
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

  it('navigates to a rendered thread result and closes the palette', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    vi.spyOn(api, 'conversationContentSearch').mockResolvedValue({ matches: [] } as Awaited<
      ReturnType<typeof api.conversationContentSearch>
    >);
    Element.prototype.scrollIntoView = vi.fn();
    conversationMocks.state.tabs = [
      {
        id: 'conv-route',
        title: 'Persisted route thread',
        file: '/tmp/conv-route.jsonl',
        timestamp: '2026-06-15T12:00:00.000Z',
        cwd: '/repo',
        cwdSlug: 'repo',
        model: 'openai/gpt-5',
        messageCount: 4,
        isRunning: false,
      },
    ];

    render(
      <MemoryRouter initialEntries={['/conversations/new']}>
        <LocationProbe />
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'threads', query: 'persisted route' } }));
    });

    const thread = await screen.findByText('Persisted route thread');
    const button = thread.closest('button');
    expect(button).toBeTruthy();

    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/conversations/conv-route');
    });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
  });

  it('shows thread and command results in the top-bar all scope', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    vi.spyOn(api, 'conversationContentSearch').mockResolvedValue({ matches: [] } as Awaited<
      ReturnType<typeof api.conversationContentSearch>
    >);
    Element.prototype.scrollIntoView = vi.fn();
    conversationMocks.state.tabs = [
      {
        id: 'settings-thread',
        title: 'Settings migration notes',
        file: '/tmp/settings-thread.jsonl',
        timestamp: '2026-06-15T12:00:00.000Z',
        cwd: '/repo',
        cwdSlug: 'repo',
        model: 'openai/gpt-5',
        messageCount: 4,
        isRunning: false,
      },
    ];

    render(
      <MemoryRouter initialEntries={['/conversations/settings-thread']}>
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, {
          detail: {
            scope: 'all',
            query: 'settings',
            anchorRect: { left: 300, top: 42, width: 520, height: 28 },
          },
        }),
      );
    });

    expect(await screen.findByText('Settings migration notes')).toBeTruthy();
    expect(await screen.findByText('Open Composer Settings')).toBeTruthy();
    expect(screen.getByDisplayValue('settings').getAttribute('placeholder')).toBe(
      'Search applications, pages, conversations, and actions…',
    );
  });

  it('activates the highest scoring thread result on Enter even when it is archived', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    vi.spyOn(api, 'conversationContentSearch').mockResolvedValue({ matches: [] } as Awaited<
      ReturnType<typeof api.conversationContentSearch>
    >);
    Element.prototype.scrollIntoView = vi.fn();
    conversationMocks.state.openSession = vi.fn();
    conversationMocks.state.tabs = [
      {
        id: 'open-partial',
        title: 'ROW81 marker other open',
        file: '/tmp/open-partial.jsonl',
        timestamp: '2026-06-15T12:00:00.000Z',
        cwd: '/tmp/ROW81 marker exact archived',
        cwdSlug: 'open',
        model: 'openai/gpt-5',
        messageCount: 4,
        isRunning: false,
      },
    ];
    conversationMocks.state.archivedSessions = [
      {
        id: 'archived-exact',
        title: 'ROW81 marker exact archived',
        file: '/tmp/archived-exact.jsonl',
        timestamp: '2026-06-15T12:00:00.000Z',
        cwd: '/tmp/archived',
        cwdSlug: 'archived',
        model: 'openai/gpt-5',
        messageCount: 4,
        isRunning: false,
      },
    ];

    render(
      <MemoryRouter initialEntries={['/conversations/open-partial']}>
        <LocationProbe />
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'threads', query: 'ROW81 marker exact archived' } }),
      );
    });

    expect(await screen.findByText('ROW81 marker other open')).toBeTruthy();
    expect((await screen.findAllByText('ROW81 marker exact archived')).length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/conversations/archived-exact');
    });
    expect(conversationMocks.state.openSession).toHaveBeenCalledWith('archived-exact');
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
  });

  it('does not show thread loading rows while refreshed conversation data is already rendered', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    vi.spyOn(api, 'conversationContentSearch').mockResolvedValue({ matches: [] } as Awaited<
      ReturnType<typeof api.conversationContentSearch>
    >);
    Element.prototype.scrollIntoView = vi.fn();
    conversationMocks.state.loading = true;
    conversationMocks.state.tabs = [
      {
        id: 'conv-visible',
        title: 'Visible thread result',
        file: '/tmp/conv-visible.jsonl',
        timestamp: '2026-06-15T12:00:00.000Z',
        cwd: '/repo',
        cwdSlug: 'repo',
        model: 'openai/gpt-5',
        messageCount: 4,
        isRunning: false,
      },
    ];

    render(
      <MemoryRouter initialEntries={['/conversations/new']}>
        <CommandPalette />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { scope: 'threads', query: 'visible thread' } }));
    });

    expect(await screen.findByText('Visible thread result')).toBeTruthy();

    await waitFor(() => {
      expect(api.conversationContentSearch).toHaveBeenCalledWith('visible thread', expect.any(Number));
    });
    await waitFor(() => {
      expect(screen.queryByText('Loading open threads…')).toBeNull();
      expect(screen.queryByText('Loading archived threads…')).toBeNull();
    });
  });

  it('renders an anchored Start-style launcher with compact pins, single-line owners, and custom page icons', async () => {
    vi.spyOn(api, 'extensionCommands').mockResolvedValue([
      {
        extensionId: 'system-automations',
        surfaceId: 'open',
        title: 'Open Automations',
        action: 'app.navigate',
        args: { route: '/automations' },
      },
    ]);
    vi.spyOn(api, 'extensionSearchProviders').mockResolvedValue([]);
    vi.spyOn(api, 'extensionQuickOpen').mockResolvedValue([]);
    Element.prototype.scrollIntoView = vi.fn();
    extensionRegistryMocks.state.applications = [
      {
        id: 'agent',
        extensionId: 'system-agent',
        title: 'Agent',
        startRoute: '/conversations/new',
        icon: 'sparkle',
        available: true,
      },
    ];
    extensionRegistryMocks.state.applicationNavigation = [
      {
        id: 'system-agent:chat',
        extensionId: 'system-agent',
        applicationId: 'agent',
        label: 'Chat',
        route: '/conversations/new',
        icon: 'sparkle',
        slot: 'primary',
        slotOrder: 0,
        order: 0,
      },
      {
        id: 'system-automations:nav',
        extensionId: 'system-automations',
        applicationId: 'agent',
        label: 'Automations',
        route: '/automations',
        icon: 'automation',
        slot: 'primary',
        slotOrder: 0,
        order: 1,
      },
    ];
    conversationMocks.state.tabs = [
      {
        id: 'automation-notes',
        title: 'Automation migration notes',
        file: '/tmp/automation-notes.jsonl',
        timestamp: '2026-06-15T12:00:00.000Z',
        cwd: '/repo',
        cwdSlug: 'repo',
        model: 'openai/gpt-5',
        messageCount: 4,
        isRunning: false,
      },
    ];
    const onToggleLauncherPin = vi.fn();

    render(
      <MemoryRouter initialEntries={['/conversations/new']}>
        <button type="button">Background action</button>
        <CommandPalette
          applicationWorkspace={{
            pinnedApplicationIds: ['agent'],
            launcherPins: [
              {
                key: 'application:agent',
                target: { kind: 'application', applicationId: 'agent' },
                snapshot: { title: 'Agent', icon: 'sparkle' },
              },
            ],
            pinsInitialized: true,
            openViews: [],
            activeViewId: null,
          }}
          onToggleLauncherPin={onToggleLauncherPin}
        />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, {
          detail: { scope: 'all', anchorRect: { left: 74, top: 8, width: 112, height: 28 } },
        }),
      );
    });

    const launcher = await screen.findByRole('dialog', { name: 'Launcher' });
    expect(launcher.getAttribute('style')).toContain('--launcher-left: 74px');
    expect(launcher.getAttribute('style')).toContain('--launcher-top: 42px');
    expect(document.querySelector('.ui-command-palette-footer')).toBeNull();
    expect(document.querySelector('.ui-command-palette-app-grid')).toBeNull();
    const pinnedAgent = within(screen.getByLabelText('Pinned')).getByTitle('Agent');
    expect(pinnedAgent).toBeTruthy();
    pinnedAgent.focus();
    const pinnedEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    pinnedAgent.dispatchEvent(pinnedEnter);
    expect(pinnedEnter.defaultPrevented).toBe(false);

    const chat = screen.getByText('Chat').closest('.ui-command-palette-result-row');
    expect(chat).toBeTruthy();
    expect(chat?.textContent).toContain('Agent');
    expect(chat?.textContent).not.toContain('Page');
    expect(chat?.querySelector('[data-icon="sparkle"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Pin Chat' }));
    expect(onToggleLauncherPin).toHaveBeenCalledWith(
      { kind: 'page', navigationId: 'system-agent:chat' },
      { title: 'Chat', icon: 'sparkle', applicationTitle: 'Agent' },
    );
    expect(screen.getByRole('dialog', { name: 'Launcher' })).toBeTruthy();
    expect(launcher.textContent).not.toContain('results');
    expect(launcher.textContent).not.toContain('navigate');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search launcher' }), { target: { value: 'Automations' } });
    const firstResult = launcher.querySelector('[data-command-palette-idx="0"]');
    expect(firstResult?.textContent).toContain('Automations');
    expect(firstResult?.textContent).not.toContain('Automation migration notes');
    expect(firstResult?.className).toContain('ui-row-button-selected');
    await waitFor(() => expect(screen.queryByText('Open Automations')).toBeNull());

    screen.getByRole('button', { name: 'Background action' }).focus();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Launcher' })).toBeNull());
  });
});
