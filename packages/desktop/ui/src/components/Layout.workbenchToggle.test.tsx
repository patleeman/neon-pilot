// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
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
    vi.spyOn(api, 'extensionKeybindings').mockImplementation(
      () => new Promise<Awaited<ReturnType<typeof api.extensionKeybindings>>>(() => {}),
    );
    vi.spyOn(api, 'extensionCommands').mockImplementation(
      () => new Promise<Awaited<ReturnType<typeof api.extensionCommands>>>(() => {}),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.neonPilotDesktop;
    window.localStorage.clear();
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
});
