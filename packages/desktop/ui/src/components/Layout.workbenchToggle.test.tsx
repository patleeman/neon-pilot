// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { setExtensionCommandContext } from '../extensions/commands';
import { sessionStore } from '../store';
import { APP_LAYOUT_MODE_STORAGE_KEY } from '../ui-state/appLayoutMode';
import { Layout } from './Layout';

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

function renderLayout(pathname = '/conversations/new') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="conversations/new" element={<div>Conversation draft</div>} />
          <Route path="conversations/:id" element={<div>Conversation saved</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout workbench toggle', () => {
  beforeEach(() => {
    installLocalStorageShim();
    window.localStorage.clear();
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
    sessionStore.reset?.();
  });

  it('does not render a compact workbench panel when the workbench is hidden', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');

    renderLayout();

    expect(screen.getByText('Conversation draft')).toBeTruthy();
    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    expect((screen.getByRole('button', { name: 'Show workbench' }) as HTMLButtonElement).disabled).toBe(false);
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
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    renderLayout('/conversations/conv-1?workspaceFile=%2Frepo%2FREADME.md');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.refreshActiveFile' } }));
    });

    expect(refreshListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
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
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');
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
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');
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
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');
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
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');
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
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');

    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getByRole('button', { name: /File Explorer/ }));

    const newTabButton = screen.getByRole('button', { name: 'New tab' });
    expect(newTabButton.className).toContain('shrink-0');
    expect(newTabButton.parentElement?.className).toContain('overflow-hidden');
    expect(newTabButton.closest('.overflow-x-auto')).toBeNull();
    expect(document.querySelector('.ui-workbench-tab')?.parentElement?.className).toContain('overflow-x-auto');
  });

});
