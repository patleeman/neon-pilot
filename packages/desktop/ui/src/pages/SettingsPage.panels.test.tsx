// @vitest-environment jsdom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '../../../../../extensions/system-settings/src/SettingsPage';
import { useAppEvents, useSseConnection } from '../app/contexts';
import { api } from '../client/api';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../ui-state/theme';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

vi.mock('../app/contexts', () => ({
  useAppEvents: vi.fn(),
  useSseConnection: vi.fn(),
}));

vi.mock('../ui-state/theme', () => ({
  useTheme: vi.fn(),
}));

Object.assign(globalThis, { React });

function buildUseApiResult<T>(data: T) {
  return {
    data,
    loading: false,
    refreshing: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(data),
    replaceData: vi.fn(),
  };
}

function renderPage(pathname: string): string {
  return renderToString(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsPage — untested panel rendering', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(useTheme).mockReturnValue({
      theme: 'studio-dark',
      themePreference: 'system',
      lightTheme: 'studio-light',
      darkTheme: 'studio-dark',
      availableThemes: [
        { id: 'studio-light', label: 'Light', appearance: 'light' },
        { id: 'studio-dark', label: 'Dark', appearance: 'dark' },
      ],
      setThemePreference: vi.fn(),
      setLightTheme: vi.fn(),
      setDarkTheme: vi.fn(),
      accent: 'cobalt',
      availableAccents: [
        {
          id: 'lime',
          label: 'Lime',
          light: { accent: '62 184 0', accentBg: '226 246 215', selection: '202 255 51', warning: '184 115 10' },
          dark: { accent: '202 255 51', accentBg: '45 56 14', selection: '71 88 24', warning: '255 180 73' },
        },
      ],
      setAccent: vi.fn(),
      toggle: vi.fn(),
    });

    vi.mocked(useSseConnection).mockReturnValue({ status: 'open' });
    vi.mocked(useAppEvents).mockReturnValue({
      versions: { workspace: 1, sessions: 1, sessionFiles: 1, tasks: 1, runs: 1, daemon: 1 },
    });

    // Default: only return models data (needed for sidebar appearance to not crash)
    vi.mocked(useApi).mockImplementation((fetcher: unknown) => {
      if (fetcher === api.models) {
        return buildUseApiResult({
          currentModel: 'gpt-5.4',
          currentThinkingLevel: 'medium',
          currentServiceTier: '',
          currentVisionModel: '',
          models: [{ id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4', context: 200000 }],
        });
      }
      return buildUseApiResult(null);
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // Section header tests — section headers render synchronously without data

  it('does not render daemon controls in core settings', () => {
    const html = renderPage('/settings');
    expect(html).not.toContain('Daemon');
    expect(html).not.toContain('Background runtime');
  });

  it('renders the skills section heading', () => {
    const html = renderPage('/settings');
    expect(html).toContain('Capabilities');
    expect(html).toContain('AGENTS.md files');
  });

  it('renders the capabilities/MCP quick link', () => {
    const html = renderPage('/settings');
    expect(html).toContain('Capabilities');
    expect(html).toContain('MCP wrappers and extension settings.');
  });

  it('does not render interface reset controls in core settings', () => {
    const html = renderPage('/settings');
    expect(html).not.toContain('Interface');
    expect(html).not.toContain('Reset saved UI preferences');
  });

  it('renders the providers section heading', () => {
    const html = renderPage('/settings');
    expect(html).toContain('Providers');
  });

  it('renders the desktop section heading', () => {
    const html = renderPage('/settings');
    expect(html).toContain('Desktop');
    expect(html).toContain('App behavior');
  });
});
