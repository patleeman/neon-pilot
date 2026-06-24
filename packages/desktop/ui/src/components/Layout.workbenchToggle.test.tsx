// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { Link, MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { setExtensionCommandContext } from '../extensions/commands';
import { SIDEBAR_WIDTH_STORAGE_KEY } from '../local/localSettings';
import { sessionStore } from '../store';
import { APP_LAYOUT_MODE_SESSION_STORAGE_KEY, APP_LAYOUT_MODE_STORAGE_KEY } from '../ui-state/appLayoutMode';
import { closeWorkbenchTabState, Layout } from './Layout';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function installLocalStorageShim() {
  const items = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => items.clear(),
      getItem: (key: string) => items.get(key) ?? null,
      key: (index: number) => Array.from(items.keys())[index] ?? null,
      removeItem: (key: string) => items.delete(key),
      setItem: (key: string, value: string) => items.set(key, String(value)),
      get length() {
        return items.size;
      },
    },
  });
}

class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function ConversationRouteFixture() {
  const { id } = useParams();
  const location = useLocation();
  return (
    <div>
      <div>Conversation saved</div>
      <div>{`Conversation route ${id ?? 'missing'}`}</div>
      <div data-testid="route-search">{location.search}</div>
      <Link to="/conversations/conv-2">Open second conversation</Link>
    </div>
  );
}

function setWorkbenchModeForCurrentSession() {
  window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');
  window.sessionStorage.setItem(APP_LAYOUT_MODE_SESSION_STORAGE_KEY, 'workbench');
}

function renderLayout(pathname = '/conversations/new') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="conversations/new" element={<div>Conversation draft</div>} />
          <Route path="conversations/:id" element={<ConversationRouteFixture />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout workbench toggle', () => {
  beforeEach(() => {
    installLocalStorageShim();
    window.localStorage.clear();
    window.sessionStorage.clear();
    setViewportWidth(1600);
    document.documentElement.dataset.neonPilotDesktop = '1';
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverShim,
    });
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverShim,
    });
    vi.spyOn(api, 'extensionKeybindings').mockImplementation(
      () => new Promise<Awaited<ReturnType<typeof api.extensionKeybindings>>>(() => {}),
    );
    vi.spyOn(api, 'extensionCommands').mockImplementation(() => new Promise<Awaited<ReturnType<typeof api.extensionCommands>>>(() => {}));
    vi.spyOn(api, 'models').mockResolvedValue({ models: [], perf: {} });
    vi.spyOn(api, 'conversationModelPreferences').mockResolvedValue({
      currentModel: null,
      currentThinkingLevel: null,
      currentServiceTier: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setExtensionCommandContext('conversation.isStreaming', null);
    setExtensionCommandContext('system-local-dictation.toggleAvailable', null);
    setExtensionCommandContext('workbench.hasActiveFile', null);
    setExtensionCommandContext('workbench.canToggleDiff', null);
    delete document.documentElement.dataset.neonPilotDesktop;
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    window.localStorage.clear();
    window.sessionStorage.clear();
    sessionStore.reset?.();
  });

  it('does not render a compact workbench panel when the workbench is hidden', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');

    renderLayout();

    expect(screen.getByText('Conversation draft')).toBeTruthy();
    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    expect((screen.getByRole('button', { name: 'Show workbench' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('starts with the workbench closed even when the previous app session left it open', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');

    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show workbench' })).toBeTruthy();
  });

  it('uses the desktop right-rail shortcut to toggle the workbench on conversation routes', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');
    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { action: 'toggle-right-rail' } }));
    });

    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Hide workbench' }) as HTMLButtonElement).disabled).toBe(false);

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { action: 'toggle-right-rail' } }));
    });

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    expect((screen.getByRole('button', { name: 'Show workbench' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('persists workbench mode after toggling app chrome and restores it on rerender', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');
    const view = renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show workbench' }));

    expect(window.localStorage.getItem(APP_LAYOUT_MODE_STORAGE_KEY)).toBe('workbench');
    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();

    view.unmount();
    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Hide workbench' })).toBeTruthy();
  });

  it('restores saved sidebar and workbench document widths on conversation workbench routes', () => {
    setWorkbenchModeForCurrentSession();
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '280');
    window.localStorage.setItem('pa:workbench-document-width', '640');

    renderLayout('/conversations/conv-1');

    const sidebarPane = screen.getByLabelText('Loading sidebar').closest<HTMLElement>('[style*="width"]');
    const workbenchPane = document.querySelector<HTMLElement>('[data-workbench-document-pane="true"]');

    expect(sidebarPane?.style.width).toBe('280px');
    expect(workbenchPane?.style.width).toBe('640px');
  });

  it('persists dragged sidebar and workbench widths across conversation route transitions', () => {
    setWorkbenchModeForCurrentSession();

    renderLayout('/conversations/conv-1');

    expect(screen.getByText('Conversation route conv-1')).toBeTruthy();
    let resizeHandles = [...document.querySelectorAll<HTMLElement>('.cursor-col-resize')];
    expect(resizeHandles.length).toBeGreaterThanOrEqual(2);

    act(() => {
      fireEvent.mouseDown(resizeHandles[0], { clientX: 224 });
      fireEvent.mouseMove(document, { clientX: 300 });
      fireEvent.mouseUp(document);
    });

    act(() => {
      fireEvent.mouseDown(resizeHandles[1], { clientX: 1000 });
      fireEvent.mouseMove(document, { clientX: 900 });
      fireEvent.mouseUp(document);
    });

    expect(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('300');
    expect(window.localStorage.getItem('pa:workbench-document-width')).toBe('620');

    fireEvent.click(screen.getByRole('link', { name: 'Open second conversation' }));

    expect(screen.getByText('Conversation route conv-2')).toBeTruthy();
    resizeHandles = [...document.querySelectorAll<HTMLElement>('.cursor-col-resize')];
    expect(resizeHandles.length).toBeGreaterThanOrEqual(2);
    const sidebarPane = screen.getByLabelText('Loading sidebar').closest<HTMLElement>('[style*="width"]');
    const workbenchPane = document.querySelector<HTMLElement>('[data-workbench-document-pane="true"]');

    expect(sidebarPane?.style.width).toBe('300px');
    expect(workbenchPane?.style.width).toBe('620px');
  });

  it('accepts command-only desktop shortcut events for command-backed app chrome actions', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');
    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'layout.toggleRightRail' } }));
    });

    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
  });

  it('accepts command-only desktop shortcut events for workbench refresh', () => {
    setWorkbenchModeForCurrentSession();
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    setExtensionCommandContext('workbench.hasActiveFile', true);
    renderLayout('/conversations/conv-1?workspaceFile=%2Frepo%2FREADME.md');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.refreshActiveFile' } }));
    });

    expect(refreshListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
  });

  it('closes the workbench when the last workbench tab is closed', async () => {
    setWorkbenchModeForCurrentSession();
    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'File Explorer' }));

    await waitFor(() => {
      expect(screen.queryByText('Open a tab')).toBeNull();
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.closeActiveTab' } }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    });
    expect(window.localStorage.getItem(APP_LAYOUT_MODE_STORAGE_KEY)).toBe('compact');
    expect(screen.getByRole('button', { name: 'Show workbench' })).toBeTruthy();
  });

  it('reuses the existing File Explorer tab from the new-tab launcher', async () => {
    setWorkbenchModeForCurrentSession();
    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getByRole('button', { name: 'File Explorer' }));
    await waitFor(() => {
      expect(screen.queryByText('Open a tab')).toBeNull();
    });
    expect(screen.getAllByLabelText('Close File Explorer')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    const fileExplorerButtons = screen.getAllByRole('button', { name: 'File Explorer' });
    fireEvent.click(fileExplorerButtons[fileExplorerButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('Open a tab')).toBeNull();
    });
    expect(screen.getAllByLabelText('Close File Explorer')).toHaveLength(1);
  });

  it('marks file selection for cleanup when closing File Explorer while another tab remains', () => {
    const state = closeWorkbenchTabState(
      [
        { id: 'files', mode: 'files' },
        { id: 'scratchpad', mode: 'scratchpad' },
      ],
      'scratchpad',
      'files',
    );

    expect(state.nextTabs).toEqual([{ id: 'scratchpad', mode: 'scratchpad' }]);
    expect(state.nextActiveTabId).toBe('scratchpad');
    expect(state.nextWouldHaveNoTabs).toBe(false);
    expect(state.shouldClearFileSelection).toBe(true);
  });

  it('does not consume global keybindings for unavailable commands', async () => {
    vi.mocked(api.extensionKeybindings).mockResolvedValue([
      {
        extensionId: 'host',
        surfaceId: 'refresh-workbench-file',
        packageType: 'system',
        title: 'Refresh workbench file',
        keys: ['F5'],
        command: 'workbench.refreshActiveFile',
        scope: 'global',
        defaultKeys: ['F5'],
        enabled: true,
      },
    ]);
    vi.mocked(api.extensionCommands).mockResolvedValue([]);
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    renderLayout('/conversations/conv-1');
    await waitFor(() => expect(api.extensionKeybindings).toHaveBeenCalled());

    const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(refreshListener).not.toHaveBeenCalled();
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
  });

  it('executes available global keybindings through shared host commands', async () => {
    vi.mocked(api.extensionKeybindings).mockResolvedValue([
      {
        extensionId: 'host',
        surfaceId: 'refresh-workbench-file',
        packageType: 'system',
        title: 'Refresh workbench file',
        keys: ['F5'],
        command: 'workbench.refreshActiveFile',
        scope: 'global',
        defaultKeys: ['F5'],
        enabled: true,
      },
    ]);
    vi.mocked(api.extensionCommands).mockResolvedValue([]);
    setWorkbenchModeForCurrentSession();
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    renderLayout('/conversations/conv-1?workspaceFile=%2Frepo%2FREADME.md');
    await waitFor(() => expect(api.extensionKeybindings).toHaveBeenCalled());

    const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(refreshListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
  });

  it('accepts command-only desktop shortcut events for workbench diff toggle', () => {
    setWorkbenchModeForCurrentSession();
    const diffListener = vi.fn();
    window.addEventListener('pa:workbench-toggle-diff', diffListener);
    setExtensionCommandContext('workbench.canToggleDiff', true);
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.toggleDiff' } }));
    });

    expect(diffListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-toggle-diff', diffListener);
  });

  it('renders the workbench diff toggle in the file toolbar', async () => {
    setWorkbenchModeForCurrentSession();
    sessionStore.upsert({
      id: 'conv-1',
      file: '/tmp/conv-1.jsonl',
      timestamp: new Date().toISOString(),
      cwd: '/repo',
      cwdSlug: 'repo',
      model: 'deepseek-v4-flash',
      title: 'Workspace conversation',
      messageCount: 0,
    });
    const diffListener = vi.fn();
    window.addEventListener('pa:workbench-toggle-diff', diffListener);

    renderLayout('/conversations/conv-1?workspaceFile=README.md');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('pa:workbench-diff-state', {
          detail: { cwd: '/repo', path: 'README.md', canToggleDiff: true, diffEnabled: true },
        }),
      );
    });

    const toggle = await screen.findByRole('button', { name: 'Hide diff overlay' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);

    expect(diffListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-toggle-diff', diffListener);
  });

  it('accepts command-only desktop shortcut events for composer stop', () => {
    const stopListener = vi.fn();
    window.addEventListener('neon-pilot:composer-stop', stopListener);
    setExtensionCommandContext('conversation.isStreaming', true);
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'composer.stop' } }));
    });

    expect(stopListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('neon-pilot:composer-stop', stopListener);
  });

  it('accepts command-only desktop shortcut events for available dictation toggle', () => {
    const dictationListener = vi.fn();
    window.addEventListener('neon-pilot:dictation-toggle', dictationListener);
    setExtensionCommandContext('system-local-dictation.toggleAvailable', true);
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'dictation.toggle' } }));
    });

    expect(dictationListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('neon-pilot:dictation-toggle', dictationListener);
  });

  it('accepts command-only desktop shortcut events for available composer drawing creation', () => {
    const createDrawingListener = vi.fn();
    window.addEventListener('neon-pilot-composer-create-drawing-command', createDrawingListener);
    setExtensionCommandContext('composer.canCreateDrawing', true);
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'composer.createDrawing' } }));
    });

    expect(createDrawingListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('neon-pilot-composer-create-drawing-command', createDrawingListener);
  });

  it('accepts command-only desktop shortcut events for focus traversal', () => {
    const offsetParentDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() {
        return document.body;
      },
    });
    renderLayout('/conversations/conv-1');
    const focusable = [
      ...document.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'),
    ].filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0);
    expect(focusable.length).toBeGreaterThan(0);
    expect(document.activeElement).not.toBe(focusable[0]);

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'focus.next' } }));
    });

    expect(document.activeElement).toBe(focusable[0]);
    if (offsetParentDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParentDescriptor);
    } else {
      delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
    }
  });

  it('opens a side chat after reservation without waiting for live-session creation', async () => {
    setWorkbenchModeForCurrentSession();
    const reserveConversation = vi.spyOn(api, 'reserveConversation').mockResolvedValue({
      id: 'side-chat-1',
      sessionFile: '/tmp/side-chat-1.jsonl',
      cwd: '/repo',
      perf: {},
    });
    const createLiveSession = vi
      .spyOn(api, 'createLiveSession')
      .mockImplementation(() => new Promise<Awaited<ReturnType<typeof api.createLiveSession>>>(() => {}));
    vi.mocked(api.conversationModelPreferences).mockResolvedValue({
      currentModel: 'deepseek-v4-flash',
      currentThinkingLevel: 'high',
      currentServiceTier: 'priority',
    });

    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Chat' }).at(-1)!);

    await waitFor(() => {
      expect(reserveConversation).toHaveBeenCalledWith(undefined);
    });
    await waitFor(
      () => {
        expect(document.querySelector('[data-chat-rail="1"]')).not.toBeNull();
      },
      { timeout: 3000 },
    );

    expect(createLiveSession).toHaveBeenCalledWith(undefined, undefined, {
      workspaceCwd: undefined,
      reservedSessionFile: '/tmp/side-chat-1.jsonl',
      model: 'deepseek-v4-flash',
      thinkingLevel: 'high',
      serviceTier: 'priority',
    });
  });

  it('uses the conversation title for side chat tabs when metadata is available', async () => {
    setWorkbenchModeForCurrentSession();
    sessionStore.upsert({
      id: 'side-chat-1',
      file: '/tmp/side-chat-1.jsonl',
      timestamp: new Date().toISOString(),
      cwd: '/repo',
      cwdSlug: 'repo',
      model: 'deepseek-v4-flash',
      title: 'Investigate onboarding crash',
      messageCount: 0,
    });
    vi.spyOn(api, 'reserveConversation').mockResolvedValue({
      id: 'side-chat-1',
      sessionFile: '/tmp/side-chat-1.jsonl',
      cwd: '/repo',
      perf: {},
    });
    vi.spyOn(api, 'createLiveSession').mockImplementation(() => new Promise<Awaited<ReturnType<typeof api.createLiveSession>>>(() => {}));

    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Chat' }).at(-1)!);

    expect(await screen.findByRole('button', { name: 'Investigate onboarding crash' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Chat side-cha/ })).toBeNull();
  });

  it('keeps the workbench new tab button outside the scrollable tab lane', () => {
    setWorkbenchModeForCurrentSession();

    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getByRole('button', { name: /File Explorer/ }));

    const newTabButton = screen.getByRole('button', { name: 'New tab' });
    expect(newTabButton.className).toContain('shrink-0');
    expect(newTabButton.parentElement?.className).toContain('overflow-hidden');
    expect(newTabButton.closest('.overflow-x-auto')).toBeNull();
    expect(document.querySelector('.ui-workbench-tab')?.parentElement?.className).toContain('overflow-x-auto');
  });
});
