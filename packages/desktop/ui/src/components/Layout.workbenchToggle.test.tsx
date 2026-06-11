// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
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
