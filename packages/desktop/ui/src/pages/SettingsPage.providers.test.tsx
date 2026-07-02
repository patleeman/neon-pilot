// @vitest-environment jsdom
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage, SettingsSidebar } from '../../../../../extensions/system-settings/src/SettingsPage';
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

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

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

function renderPage(
  sectionId?: string,
  pathname = '/settings',
  context: Partial<Pick<ExtensionSurfaceProps['context'], 'route' | 'pathname' | 'search' | 'hash' | 'shellPresentation'>> & {
    conversationId?: string | null;
    cwd?: string | null;
  } = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route
            path="/settings/*"
            element={
              <SettingsPage
                sectionIds={sectionId ? [sectionId] : undefined}
                context={{
                  route: context.route ?? '/settings',
                  pathname: context.pathname ?? pathname,
                  search: context.search ?? '',
                  hash: context.hash ?? '',
                  shellPresentation: context.shellPresentation,
                  conversationId: context.conversationId ?? null,
                  cwd: context.cwd ?? null,
                }}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  });

  mountedRoots.push(root);
  return { container };
}

function renderSettingsSidebar(hash = '', pathname = '/settings') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const execute = vi.fn().mockResolvedValue(true);

  act(() => {
    root.render(
      <SettingsSidebar
        pa={{ commands: { execute } }}
        context={{
          route: '/settings',
          pathname,
          search: '',
          hash,
          params: {},
          query: {},
          conversationId: null,
          cwd: null,
        }}
      />,
    );
  });

  mountedRoots.push(root);
  return { container, execute };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function queryButton(container: HTMLElement, label: string, index = 0): HTMLButtonElement {
  const matches = Array.from(container.querySelectorAll('button')).filter((node) => node.textContent?.trim() === label);
  const button = matches[index];
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected button ${label} at index ${index}`);
  }
  return button;
}

function queryButtonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((node) => node.getAttribute('aria-label') === label);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected button with label ${label}`);
  }
  return button;
}

function queryInput(container: HTMLElement, selector: string): HTMLInputElement {
  const input = container.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Expected input for selector ${selector}`);
  }
  return input;
}

function queryProviderPicker(container: HTMLElement): HTMLSelectElement {
  const picker = Array.from(container.querySelectorAll('select')).find((select) =>
    Array.from(select.options).some((option) => option.value === 'anthropic'),
  );
  if (!(picker instanceof HTMLSelectElement)) {
    throw new Error('Expected provider picker');
  }
  return picker;
}

function querySettingsTocLink(container: HTMLElement, sectionId: string): HTMLButtonElement {
  const label = sectionId
    .replace(/^settings-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const link = Array.from(container.querySelectorAll('nav[aria-label="Settings sections"] button')).find(
    (button) => button.textContent?.trim() === label,
  );
  if (!(link instanceof HTMLButtonElement)) {
    throw new Error(`Expected settings table-of-contents link for ${sectionId}`);
  }
  return link;
}

function click(button: HTMLButtonElement) {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function selectProviderByText(container: HTMLElement, providerId: string): HTMLButtonElement {
  const providerButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes(providerId));
  if (!(providerButton instanceof HTMLButtonElement)) {
    throw new Error(`Expected ${providerId} provider button`);
  }
  click(providerButton);
  return providerButton;
}

function expectNoInternalProviderErrorDetails(container: HTMLElement) {
  expect(container.textContent).not.toContain('Local API route did not complete');
  expect(container.textContent).not.toContain('/api/provider-auth');
  expect(container.textContent).not.toContain('file:///');
  expect(container.textContent).not.toContain('localApi.js');
  expect(container.textContent).not.toContain('Module.ep');
  expect(container.textContent).not.toContain('packages/desktop');
}

function expectNoInternalModelPreferenceErrorDetails(container: HTMLElement) {
  expect(container.textContent).not.toContain('Local API route did not complete');
  expect(container.textContent).not.toContain('/api/model-preferences');
  expect(container.textContent).not.toContain('file:///');
  expect(container.textContent).not.toContain('localApi.js');
  expect(container.textContent).not.toContain('Module.ep');
  expect(container.textContent).not.toContain('packages/desktop');
}

function updateInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (!descriptor?.set) {
    throw new Error('Expected HTMLInputElement value setter');
  }

  act(() => {
    descriptor.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function updateSelectValue(select: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  if (!descriptor?.set) {
    throw new Error('Expected HTMLSelectElement value setter');
  }

  act(() => {
    descriptor.set?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('SettingsPage provider model editor', () => {
  let saveModelProviderMock: ReturnType<typeof vi.spyOn>;
  let deleteModelProviderMock: ReturnType<typeof vi.spyOn>;
  let saveModelProviderModelMock: ReturnType<typeof vi.spyOn>;
  let deleteModelProviderModelMock: ReturnType<typeof vi.spyOn>;
  let updateModelPreferencesMock: ReturnType<typeof vi.spyOn>;
  let refreshModelsMock: ReturnType<typeof vi.spyOn>;
  let testModelProviderMock: ReturnType<typeof vi.spyOn>;
  let startProviderOAuthLoginMock: ReturnType<typeof vi.spyOn>;
  let setProviderApiKeyMock: ReturnType<typeof vi.spyOn>;
  let removeProviderCredentialMock: ReturnType<typeof vi.spyOn>;
  let maintainTelemetryDbMock: ReturnType<typeof vi.spyOn>;
  let updateSettingsMock: ReturnType<typeof vi.spyOn>;
  let modelsRefetchMock: ReturnType<typeof vi.fn>;
  let settingsResult: ReturnType<typeof buildUseApiResult<Record<string, unknown>>>;
  let settingsSchemaResult: ReturnType<typeof buildUseApiResult<unknown[]>>;
  let providerAuthResult: ReturnType<typeof buildUseApiResult<{ authFile: string; providers: Array<Record<string, unknown>> }>>;

  beforeEach(() => {
    saveModelProviderMock = vi.spyOn(api, 'saveModelProvider');
    deleteModelProviderMock = vi.spyOn(api, 'deleteModelProvider');
    saveModelProviderModelMock = vi.spyOn(api, 'saveModelProviderModel');
    deleteModelProviderModelMock = vi.spyOn(api, 'deleteModelProviderModel');
    updateModelPreferencesMock = vi.spyOn(api, 'updateModelPreferences');
    refreshModelsMock = vi.spyOn(api, 'refreshModels');
    testModelProviderMock = vi.spyOn(api, 'testModelProvider');
    startProviderOAuthLoginMock = vi.spyOn(api, 'startProviderOAuthLogin');
    setProviderApiKeyMock = vi.spyOn(api, 'setProviderApiKey');
    removeProviderCredentialMock = vi.spyOn(api, 'removeProviderCredential');
    maintainTelemetryDbMock = vi.spyOn(api, 'maintainTelemetryDb');
    updateSettingsMock = vi.spyOn(api, 'updateSettings').mockResolvedValue({});
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/settings');

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

    vi.mocked(useSseConnection).mockReturnValue({
      status: 'open',
    });

    vi.mocked(useAppEvents).mockReturnValue({
      versions: {
        workspace: 1,
        sessions: 1,
        sessionFiles: 1,
        tasks: 1,
        runs: 1,
        daemon: 1,
      },
    });

    const skillFoldersResult = buildUseApiResult({
      configFile: '/tmp/config.json',
      skillDirs: ['/Users/patrick/Documents/neon-pilot/skills'],
    });
    const instructionsResult = buildUseApiResult({
      configFile: '/tmp/config.json',
      instructionFiles: ['/Users/patrick/Documents/neon-pilot/AGENTS.md'],
    });
    const modelsResult = buildUseApiResult({
      currentModel: 'gpt-5.4',
      currentVisionModel: '',
      currentThinkingLevel: 'medium',
      currentServiceTier: '',
      models: [
        {
          id: 'gpt-5.4',
          provider: 'openai-codex',
          name: 'GPT-5.4',
          context: 200000,
          input: ['text', 'image'],
          supportedServiceTiers: ['auto', 'priority'],
        },
        {
          id: 'qwen-reap',
          provider: 'desktop',
          name: 'Qwen REAP',
          context: 262144,
          input: ['text'],
        },
      ],
    });
    modelsRefetchMock = modelsResult.refetch;
    const modelProvidersResult = buildUseApiResult({
      profile: 'assistant',
      filePath: '/tmp/assistant-models.json',
      providers: [
        {
          id: 'desktop',
          baseUrl: 'http://desktop:8000/v1',
          api: 'openai-completions',
          apiKey: 'local-dev',
          authHeader: false,
          headers: undefined,
          compat: undefined,
          modelOverrides: undefined,
          models: [
            {
              id: 'qwen-reap',
              name: 'Qwen REAP',
              api: undefined,
              baseUrl: undefined,
              reasoning: true,
              input: ['text'],
              contextWindow: 262144,
              maxTokens: 32768,
              headers: undefined,
              cost: undefined,
              compat: undefined,
            },
          ],
        },
      ],
    });
    const defaultCwdResult = buildUseApiResult({
      currentCwd: '',
      effectiveCwd: '/Users/patrick/workingdir/neon-pilot',
    });
    const conversationTitleSettingsResult = buildUseApiResult({
      enabled: true,
      currentModel: '',
      effectiveModel: 'openai-codex/gpt-5.4',
    });
    const transcriptionSettingsResult = buildUseApiResult({
      settings: {
        provider: 'local-whisper',
        model: 'base.en',
      },
      providers: [],
    });
    const statusResult = buildUseApiResult({
      profile: 'assistant',
      repoRoot: '/Users/patrick/workingdir/neon-pilot',
      projectCount: 5,
      appRevision: 'abc123',
    });
    providerAuthResult = buildUseApiResult({
      authFile: '/tmp/auth.json',
      providers: [
        {
          id: 'anthropic',
          modelCount: 3,
          authType: 'none',
          hasStoredCredential: false,
          apiKeySupported: true,
          oauthSupported: false,
          oauthProviderName: '',
          oauthUsesCallbackServer: false,
        },
        {
          id: 'openai-codex',
          modelCount: 12,
          authType: 'oauth',
          hasStoredCredential: true,
          apiKeySupported: false,
          oauthSupported: true,
          oauthProviderName: 'OpenAI',
          oauthUsesCallbackServer: true,
        },
      ],
    });
    const remoteAuthResult = buildUseApiResult({
      sessions: [],
      pendingPairings: [],
    });
    settingsResult = buildUseApiResult({});
    settingsSchemaResult = buildUseApiResult([]);
    updateModelPreferencesMock.mockResolvedValue({
      currentModel: 'gpt-5.4',
      currentThinkingLevel: 'medium',
      currentServiceTier: 'priority',
    });

    vi.mocked(useApi).mockImplementation((fetcher, key) => {
      if (fetcher === api.skillFolders) {
        return skillFoldersResult;
      }

      if (fetcher === api.instructions) {
        return instructionsResult;
      }

      if (fetcher === api.systemPromptTemplate) {
        return buildUseApiResult({ configFile: '/tmp/config.json', template: '# Neon Pilot defaults\n' });
      }

      if (fetcher === api.models) {
        return modelsResult;
      }

      if (fetcher === api.modelProviders) {
        return modelProvidersResult;
      }

      if (fetcher === api.defaultCwd) {
        return defaultCwdResult;
      }

      if (fetcher === api.conversationTitleSettings) {
        return conversationTitleSettingsResult;
      }

      if (fetcher === api.transcriptionSettings) {
        return transcriptionSettingsResult;
      }

      if (fetcher === api.settings) {
        return settingsResult;
      }

      if (fetcher === api.settingsSchema) {
        return settingsSchemaResult;
      }

      if (fetcher === api.status) {
        return statusResult;
      }

      if (fetcher === api.telemetryLogs) {
        return buildUseApiResult({ logDir: '/tmp/pa/logs/telemetry', fileCount: 0, sizeBytes: 0, files: [] });
      }

      if (fetcher === api.providerAuth) {
        return providerAuthResult;
      }

      if (fetcher === api.secrets) {
        return buildUseApiResult({ backend: 'file', secrets: [] });
      }

      if (fetcher === api.telegramGatewayToken) {
        return buildUseApiResult({ configured: false });
      }

      if (key === 'system-remote-auth') {
        return remoteAuthResult;
      }

      if (key === 'knowledge-settings-knowledge-base') {
        return buildUseApiResult({ configured: false, repoUrl: '', branch: 'main', status: 'idle' });
      }

      throw new Error(`Unexpected SettingsPage useApi call for key ${key ?? '<none>'}`);
    });

    maintainTelemetryDbMock.mockResolvedValue({
      appTelemetry: {
        dbPath: '/tmp/pa/observability/observability.db',
        maxEvents: 50000,
        deletedRows: 1,
        remainingRows: 10,
        vacuumed: true,
      },
      trace: { dbPath: '/tmp/pa/observability/observability.db', maxRowsPerTable: 50000, deletedRows: { trace_stats: 2 }, vacuumed: true },
    });

    const savedProviderState = {
      profile: 'assistant',
      filePath: '/tmp/assistant-models.json',
      providers: [
        {
          id: 'anthropic',
          baseUrl: undefined,
          api: undefined,
          apiKey: undefined,
          authHeader: false,
          headers: undefined,
          compat: undefined,
          modelOverrides: undefined,
          models: [
            {
              id: 'claude-sonnet-4-7',
              name: undefined,
              api: undefined,
              baseUrl: undefined,
              reasoning: false,
              input: ['text'],
              contextWindow: 128000,
              maxTokens: 16384,
              headers: undefined,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
              },
              compat: undefined,
            },
          ],
        },
      ],
    };
    saveModelProviderMock.mockResolvedValue(savedProviderState);
    deleteModelProviderMock.mockResolvedValue(savedProviderState);
    saveModelProviderModelMock.mockResolvedValue(savedProviderState);
    deleteModelProviderModelMock.mockResolvedValue({
      profile: 'assistant',
      filePath: '/tmp/assistant-models.json',
      providers: [
        {
          id: 'desktop',
          baseUrl: 'http://desktop:8000/v1',
          api: 'openai-completions',
          apiKey: 'local-dev',
          authHeader: false,
          headers: undefined,
          compat: undefined,
          modelOverrides: undefined,
          models: [],
        },
      ],
    });
    refreshModelsMock.mockResolvedValue({
      currentModel: 'gpt-5.4',
      currentVisionModel: '',
      currentThinkingLevel: 'medium',
      currentServiceTier: '',
      models: [
        { id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4', context: 200000 },
        { id: 'qwen-reap', provider: 'desktop', name: 'Qwen REAP', context: 262144 },
      ],
    });
    testModelProviderMock.mockResolvedValue({
      provider: 'desktop',
      ok: true,
      status: 'ok',
      message: 'Connected. Provider returned 1 models.',
      modelCount: 1,
      sampleModels: ['qwen-reap'],
    });
  });

  afterEach(() => {
    saveModelProviderMock.mockRestore();
    deleteModelProviderMock.mockRestore();
    saveModelProviderModelMock.mockRestore();
    deleteModelProviderModelMock.mockRestore();
    updateModelPreferencesMock.mockRestore();
    refreshModelsMock.mockRestore();
    testModelProviderMock.mockRestore();
    startProviderOAuthLoginMock.mockRestore();
    setProviderApiKeyMock.mockRestore();
    removeProviderCredentialMock.mockRestore();
    maintainTelemetryDbMock.mockRestore();
    updateSettingsMock.mockRestore();
    delete (window as { neonPilotDesktop?: unknown }).neonPilotDesktop;
    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
  });

  it('navigates between settings sections through the rendered settings sidebar', async () => {
    const { container, execute } = renderSettingsSidebar('#settings-workspace');
    await flushAsyncWork();

    const workspaceLink = querySettingsTocLink(container, 'settings-workspace');
    expect(workspaceLink.getAttribute('aria-current')).toBe('page');

    const providersLink = querySettingsTocLink(container, 'settings-providers');

    act(() => {
      providersLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await flushAsyncWork();

    expect(execute).toHaveBeenCalledWith('app.navigate', { to: '/settings#settings-providers' });
  });

  it('highlights the concrete settings section for direct settings routes', async () => {
    const { container } = renderSettingsSidebar('', '/settings/providers');
    await flushAsyncWork();

    expect(querySettingsTocLink(container, 'settings-providers').getAttribute('aria-current')).toBe('page');
    expect(querySettingsTocLink(container, 'settings-appearance').getAttribute('aria-current')).toBeNull();
  });

  it('highlights appearance and conversation for their direct settings routes', async () => {
    const { container } = renderSettingsSidebar('', '/settings/appearance');
    await flushAsyncWork();
    expect(querySettingsTocLink(container, 'settings-appearance').getAttribute('aria-current')).toBe('page');
    expect(querySettingsTocLink(container, 'settings-providers').getAttribute('aria-current')).toBeNull();

    const conversationContainer = renderSettingsSidebar('', '/settings/conversation');
    await flushAsyncWork();
    expect(querySettingsTocLink(conversationContainer.container, 'settings-conversation').getAttribute('aria-current')).toBe('page');
    expect(querySettingsTocLink(conversationContainer.container, 'settings-appearance').getAttribute('aria-current')).toBeNull();
  });

  it('uses direct section routes from the windowed settings rail', async () => {
    const navigationEvents: string[] = [];
    const listener = (event: Event) => {
      navigationEvents.push((event as CustomEvent<{ route?: string }>).detail?.route ?? '');
    };
    window.addEventListener('neon-pilot-desktop-navigate', listener);

    const { container } = renderPage(undefined, '/settings', { shellPresentation: 'windowed', pathname: '/settings' });
    await flushAsyncWork();

    expect(container.querySelector('.wos-page-rail')?.getAttribute('aria-label')).toBe('Settings');
    expect(container.querySelector('.wos-page-rail__header')).toBeNull();

    const providersButton = queryButton(container, 'Providers');

    act(() => {
      providersButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await flushAsyncWork();

    expect(navigationEvents).toContain('/settings/providers');
    expect(providersButton.getAttribute('data-active')).toBe('true');
    expect(container.querySelector('#settings-providers')).toBeInstanceOf(HTMLElement);
    expect(container.querySelector('#settings-appearance')).toBeNull();

    window.removeEventListener('neon-pilot-desktop-navigate', listener);
  });

  it('renders the conversation section for direct settings routes', async () => {
    const { container } = renderPage(undefined, '/settings/conversation');
    await flushAsyncWork();

    const section = container.querySelector('#settings-conversation');
    const heading = container.querySelector('h1');

    expect(section).toBeInstanceOf(HTMLElement);
    expect(heading?.textContent?.trim()).toBe('Conversation');
  });

  it('renders and saves default service tier choices for supported default models', async () => {
    const { container } = renderPage(undefined, '/settings/conversation');
    await flushAsyncWork();

    const serviceTierSelect = container.querySelector('#settings-service-tier');
    if (!(serviceTierSelect instanceof HTMLSelectElement)) {
      throw new Error('Expected service tier select');
    }

    expect(Array.from(serviceTierSelect.options).map((option) => option.textContent)).toEqual(['Standard queue', 'Automatic', 'Priority']);
    expect(container.textContent).toContain('Service tier');
    expect(container.textContent).toContain('Default for GPT-5.4: Standard queue');
    expect(container.textContent).not.toContain('priority');

    updateSelectValue(serviceTierSelect, 'priority');
    await flushAsyncWork();

    expect(updateModelPreferencesMock).toHaveBeenCalledWith({ serviceTier: 'priority' });
    expect(modelsRefetchMock).toHaveBeenCalledWith({ resetLoading: false });
  });

  it('hides raw model preference save failures in the conversation defaults section', async () => {
    updateModelPreferencesMock.mockRejectedValueOnce(
      new Error(
        'Local API route did not complete for PATCH /api/model-preferences at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/localApi.js:132:20)',
      ),
    );
    const { container } = renderPage(undefined, '/settings/conversation');
    await flushAsyncWork();

    const serviceTierSelect = container.querySelector('#settings-service-tier');
    if (!(serviceTierSelect instanceof HTMLSelectElement)) {
      throw new Error('Expected service tier select');
    }

    updateSelectValue(serviceTierSelect, 'priority');
    await flushAsyncWork();

    expect(container.textContent).toContain('Could not save the default service tier. Try again.');
    expectNoInternalModelPreferenceErrorDetails(container);
  });

  it('falls back to browser pathname when context pathname is not a concrete settings route', async () => {
    const { container } = renderPage(undefined, '/settings/conversation', { pathname: '/settings' });
    await flushAsyncWork();

    const heading = container.querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('Conversation');
  });

  it('auto-saves extension settings without save or reset controls', async () => {
    settingsResult = buildUseApiResult({ 'sample.label': 'Old label' });
    settingsSchemaResult = buildUseApiResult([
      {
        extensionId: 'sample-extension',
        key: 'sample.label',
        type: 'string',
        default: 'Old label',
        description: 'Sample extension setting',
        group: 'Sample',
        order: 1,
      },
    ]);

    const { container } = renderPage('settings-extensions');
    await flushAsyncWork();

    expect(container.querySelector('button[aria-label="Save extension settings"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Reset extension settings"]')).toBeNull();

    const input = queryInput(container, 'input[value="Old label"]');
    updateInputValue(input, 'New label');
    await flushAsyncWork();

    expect(updateSettingsMock).toHaveBeenCalledWith({ 'sample.label': 'New label' });
  });

  it('restores the previous extension setting value when autosave fails', async () => {
    updateSettingsMock.mockRejectedValueOnce(
      new Error('Local API route did not complete for PATCH /api/settings at file:///Users/patrick/app/localApi.js'),
    );
    settingsResult = buildUseApiResult({ 'sample.label': 'Old label' });
    settingsSchemaResult = buildUseApiResult([
      {
        extensionId: 'sample-extension',
        key: 'sample.label',
        type: 'string',
        default: 'Old label',
        description: 'Sample extension setting',
        group: 'Sample',
        order: 1,
      },
    ]);

    const { container } = renderPage('settings-extensions');
    await flushAsyncWork();

    const input = queryInput(container, 'input[value="Old label"]');
    updateInputValue(input, 'Unsaved label');
    await flushAsyncWork();

    expect(updateSettingsMock).toHaveBeenCalledWith({ 'sample.label': 'Unsaved label' });
    expect(queryInput(container, 'input[value="Old label"]')).toBeInstanceOf(HTMLInputElement);
    expect(container.textContent).toContain('Could not save this setting. Your change was not saved.');
    expect(container.textContent).not.toContain('/api/settings');
    expect(container.textContent).not.toContain('localApi.js');
    expect(container.textContent).not.toContain('file:///');
  });

  it('renders File Explorer path link target options as human labels', async () => {
    settingsResult = buildUseApiResult({ 'systemFiles.transcriptPathLinkTarget': 'fileExplorer' });
    settingsSchemaResult = buildUseApiResult([
      {
        extensionId: 'system-files',
        key: 'systemFiles.transcriptPathLinkTarget',
        type: 'select',
        default: 'fileExplorer',
        enum: ['fileExplorer', 'desktop'],
        description: 'Where validated transcript file path links open.',
        group: 'File Explorer',
        order: 20,
      },
    ]);

    const { container } = renderPage('settings-extensions');
    await flushAsyncWork();

    const select = container.querySelector('select');
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Expected File Explorer path link target select');
    }

    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['File Explorer', 'Desktop']);
    expect(container.textContent).not.toContain('fileExplorer');
  });

  it('renders provider choices and configured providers with readable labels plus advanced IDs', async () => {
    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    const providerPicker = queryProviderPicker(container);
    expect(Array.from(providerPicker.options).map((option) => option.textContent)).toEqual(
      expect.arrayContaining(['Anthropic', 'Add custom provider...']),
    );
    expect(Array.from(providerPicker.options).map((option) => option.textContent)).not.toContain('anthropic');

    const openAiCodexRow = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Advanced name: openai-codex'),
    );
    if (!(openAiCodexRow instanceof HTMLButtonElement)) {
      throw new Error('Expected OpenAI Codex configured provider row');
    }

    expect(openAiCodexRow.textContent).toContain('OpenAI');
    expect(openAiCodexRow.textContent).toContain('Advanced name: openai-codex');
    expect(openAiCodexRow.textContent).toContain('Logged in with saved OAuth credentials.');
  });

  it('adds a model directly to a picked built-in provider without saving the provider first', async () => {
    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    updateSelectValue(queryProviderPicker(container), 'anthropic');
    click(queryButton(container, 'Continue'));

    expect(container.textContent).toContain('Provider · anthropic');
    expect(container.textContent).toContain('These are the models Neon Pilot will show for this provider');

    click(queryButton(container, 'Add model'));
    const modelIdInput = queryInput(container, '#settings-provider-model-id');
    updateInputValue(modelIdInput, 'claude-sonnet-4-7');
    await flushAsyncWork();

    const modelForm = modelIdInput.closest('form');
    if (!(modelForm instanceof HTMLFormElement)) {
      throw new Error('Expected model editor form');
    }

    act(() => {
      modelForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushAsyncWork();

    expect(saveModelProviderModelMock).toHaveBeenCalledWith(
      'anthropic',
      expect.objectContaining({
        modelId: 'claude-sonnet-4-7',
      }),
    );
  });

  it('hides internal provider save failures in the provider editor', async () => {
    saveModelProviderMock.mockRejectedValue(
      new Error(
        'Local API route did not complete for PUT /api/model-providers/qa-local at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/localApi.js:132:20)',
      ),
    );

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    const picker = queryProviderPicker(container);
    const customOption = Array.from(picker.options).find((option) => option.textContent === 'Add custom provider...');
    if (!customOption) {
      throw new Error('Expected Add custom provider option');
    }
    updateSelectValue(picker, customOption.value);
    click(queryButton(container, 'Continue'));

    updateInputValue(queryInput(container, '#settings-model-provider-id'), 'qa-local');
    updateInputValue(queryInput(container, '#settings-model-provider-base-url'), 'http://127.0.0.1:9/v1');
    click(queryButton(container, 'Create provider'));
    await flushAsyncWork();

    expect(saveModelProviderMock).toHaveBeenCalledWith(
      'qa-local',
      expect.objectContaining({
        baseUrl: 'http://127.0.0.1:9/v1',
      }),
    );
    expect(container.textContent).toContain('Could not save this provider. Check the settings and try again.');
    expectNoInternalProviderErrorDetails(container);
  });

  it('hides internal model save failures in the model editor', async () => {
    saveModelProviderModelMock.mockRejectedValue(
      new Error(
        'Local API route did not complete for PUT /api/model-providers/anthropic/models/claude-fail at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/localApi.js:132:20)',
      ),
    );

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    updateSelectValue(queryProviderPicker(container), 'anthropic');
    click(queryButton(container, 'Continue'));
    click(queryButton(container, 'Add model'));

    updateInputValue(queryInput(container, '#settings-provider-model-id'), 'claude-fail');
    const modelForm = queryInput(container, '#settings-provider-model-id').closest('form');
    if (!(modelForm instanceof HTMLFormElement)) {
      throw new Error('Expected model editor form');
    }

    act(() => {
      modelForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushAsyncWork();

    expect(saveModelProviderModelMock).toHaveBeenCalledWith(
      'anthropic',
      expect.objectContaining({
        modelId: 'claude-fail',
      }),
    );
    expect(container.textContent).toContain('Could not save this model. Check the settings and try again.');
    expectNoInternalProviderErrorDetails(container);
  });

  it('keeps the model management section open after removing a model', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    const desktopRow = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('desktop'));
    if (!(desktopRow instanceof HTMLButtonElement)) {
      throw new Error('Expected configured desktop provider row');
    }
    click(desktopRow);
    await flushAsyncWork();

    const modelsSummary = Array.from(container.querySelectorAll('summary')).find((summary) => summary.textContent?.trim() === 'Models');
    if (!(modelsSummary instanceof HTMLElement)) {
      throw new Error('Expected Models disclosure summary');
    }
    const modelsDetails = modelsSummary.closest('details');
    if (!(modelsDetails instanceof HTMLDetailsElement)) {
      throw new Error('Expected Models details element');
    }
    act(() => {
      modelsDetails.open = true;
    });

    const qwenRow = Array.from(container.querySelectorAll('.ui-list-row')).find((row) => row.textContent?.includes('qwen-reap'));
    if (!(qwenRow instanceof HTMLElement)) {
      throw new Error('Expected qwen-reap model row');
    }
    const removeButton = Array.from(qwenRow.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Reset');
    if (!(removeButton instanceof HTMLButtonElement)) {
      throw new Error('Expected model Reset button');
    }
    click(removeButton);
    await flushAsyncWork();

    expect(deleteModelProviderModelMock).toHaveBeenCalledWith('desktop', 'qwen-reap');
    expect(modelsDetails.open).toBe(true);
    expect(container.textContent).toContain('Removed qwen-reap.');

    confirmMock.mockRestore();
  });

  it('refreshes models from advanced config', async () => {
    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    updateSelectValue(queryProviderPicker(container), 'anthropic');
    click(queryButton(container, 'Continue'));

    click(queryButton(container, 'Find models from provider...'));
    await flushAsyncWork();

    expect(refreshModelsMock).toHaveBeenCalled();
    expect(modelsRefetchMock).toHaveBeenCalledWith({ resetLoading: false });
    expect(container.textContent).toContain('Refreshed 2 models.');
  });

  it('tests a saved provider from the provider editor', async () => {
    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    const desktopRow = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('desktop'));
    if (!(desktopRow instanceof HTMLButtonElement)) {
      throw new Error('Expected configured desktop provider row');
    }
    click(desktopRow);
    await flushAsyncWork();

    click(queryButton(container, 'Test'));
    await flushAsyncWork();

    expect(testModelProviderMock).toHaveBeenCalledWith('desktop');
    expect(container.textContent).toContain('Connected. Provider returned 1 models.');
    expect(container.textContent).toContain('Sample: qwen-reap.');
  });

  it('hides internal provider test failures in the provider editor', async () => {
    testModelProviderMock.mockRejectedValue(
      new Error(
        'Local API route did not complete for POST /api/model-providers/desktop/test at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/localApi.js:132:20)',
      ),
    );

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    selectProviderByText(container, 'desktop');
    await flushAsyncWork();

    click(queryButton(container, 'Test'));
    await flushAsyncWork();

    expect(testModelProviderMock).toHaveBeenCalledWith('desktop');
    expect(container.textContent).toContain('Could not test this provider. Try again.');
    expectNoInternalProviderErrorDetails(container);
  });

  it('saves an API key for the provider shown in the credentials section', async () => {
    setProviderApiKeyMock.mockResolvedValue({
      authFile: '/tmp/auth.json',
      providers: [
        {
          id: 'desktop',
          modelCount: 1,
          authType: 'api_key',
          hasStoredCredential: true,
          apiKeySupported: true,
          oauthSupported: false,
          oauthProviderName: '',
          oauthUsesCallbackServer: false,
        },
      ],
    });
    providerAuthResult.data.providers = [
      {
        id: 'anthropic',
        modelCount: 3,
        authType: 'none',
        hasStoredCredential: false,
        apiKeySupported: true,
        oauthSupported: false,
        oauthProviderName: '',
        oauthUsesCallbackServer: false,
      },
      {
        id: 'desktop',
        modelCount: 1,
        authType: 'none',
        hasStoredCredential: false,
        apiKeySupported: true,
        oauthSupported: false,
        oauthProviderName: '',
        oauthUsesCallbackServer: false,
      },
    ];

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    const desktopRow = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('desktop'));
    if (!(desktopRow instanceof HTMLButtonElement)) {
      throw new Error('Expected configured desktop provider row');
    }
    click(desktopRow);
    await flushAsyncWork();

    updateInputValue(queryInput(container, '#settings-provider-api-key-modal'), 'sk-test-visible-provider');
    click(queryButtonByLabel(container, 'Save API key'));
    await flushAsyncWork();

    expect(setProviderApiKeyMock).toHaveBeenCalledWith('desktop', 'sk-test-visible-provider');
  });

  it('hides internal API key save failures for provider credentials', async () => {
    setProviderApiKeyMock.mockRejectedValue(
      new Error(
        'Local API route did not complete for PATCH /api/provider-auth/desktop/api-key at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/app/localApi.js:132:20)',
      ),
    );
    providerAuthResult.data.providers = [
      {
        id: 'desktop',
        modelCount: 1,
        authType: 'none',
        hasStoredCredential: false,
        apiKeySupported: true,
        oauthSupported: false,
        oauthProviderName: '',
        oauthUsesCallbackServer: false,
      },
    ];

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    const desktopRow = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('desktop'));
    if (!(desktopRow instanceof HTMLButtonElement)) {
      throw new Error('Expected configured desktop provider row');
    }
    click(desktopRow);
    await flushAsyncWork();

    updateInputValue(queryInput(container, '#settings-provider-api-key-modal'), 'sk-test-visible-provider');
    click(queryButtonByLabel(container, 'Save API key'));
    await flushAsyncWork();

    expect(setProviderApiKeyMock).toHaveBeenCalledWith('desktop', 'sk-test-visible-provider');
    expect(container.textContent).toContain('Could not save this provider credential. Try again.');
    expect(container.textContent).not.toContain('Local API route did not complete');
    expect(container.textContent).not.toContain('/api/provider-auth');
    expect(container.textContent).not.toContain('file:///');
    expect(container.textContent).not.toContain('localApi.js');
    expect(container.textContent).not.toContain('Module.ep');
    expect(container.textContent).not.toContain('packages/desktop');
  });

  it('hides internal OAuth start failures for provider login', async () => {
    startProviderOAuthLoginMock.mockRejectedValue(
      new Error(
        'Local API route did not complete for POST /api/provider-auth/openai-codex/oauth/start at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/localApi.js:132:20)',
      ),
    );

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    selectProviderByText(container, 'openai-codex');
    await flushAsyncWork();

    click(queryButtonByLabel(container, 'Start OAuth login (openai-codex)'));
    await flushAsyncWork();

    expect(startProviderOAuthLoginMock).toHaveBeenCalledWith('openai-codex');
    expect(container.textContent).toContain('Could not start provider login. Try again.');
    expectNoInternalProviderErrorDetails(container);
  });

  it('opens OAuth login URLs through the desktop shell bridge', async () => {
    const openExternalUrl = vi.fn().mockResolvedValue({ url: 'https://auth.openai.com/oauth', opened: true });
    const writeClipboardText = vi.fn().mockResolvedValue({ ok: true });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockImplementation(() => new Promise(() => {})),
        readDesktopAppPreferences: vi.fn().mockResolvedValue({
          available: true,
          supportsStartOnSystemStart: true,
          autoInstallUpdates: false,
          updatePath: 'stable',
          startOnSystemStart: false,
          keyboardShortcuts: {
            showApp: 'CommandOrControl+Shift+A',
            newConversation: 'CommandOrControl+N',
            closeTab: 'CommandOrControl+W',
            reopenClosedTab: 'Command+Shift+N',
            previousConversation: 'CommandOrControl+[',
            nextConversation: 'CommandOrControl+]',
            togglePinned: 'CommandOrControl+Alt+P',
            archiveRestoreConversation: 'CommandOrControl+Alt+A',
            renameConversation: 'CommandOrControl+Alt+R',
            focusComposer: 'CommandOrControl+L',
            editWorkingDirectory: 'CommandOrControl+Shift+L',
            findOnPage: 'CommandOrControl+F',
            settings: 'CommandOrControl+,',
            quit: 'CommandOrControl+Q',
            conversationMode: 'F1',
            workbenchMode: 'F2',
            newWorkbenchTab: 'CommandOrControl+T',
            closeWorkbenchTab: 'CommandOrControl+Shift+W',
            closeWorkbenchFile: 'CommandOrControl+Alt+W',
            refreshWorkbenchFile: 'F5',
            toggleWorkbenchExplorer: 'CommandOrControl+B',
            toggleWorkbenchDiff: 'CommandOrControl+Shift+D',
            toggleSidebar: 'CommandOrControl+/',
            toggleRightRail: 'CommandOrControl+\\',
          },
          update: { supported: false, status: 'idle', currentVersion: '0.0.0' },
        }),
        updateDesktopAppPreferences: vi.fn(),
        startProviderOAuthLogin: vi.fn(),
        subscribeProviderOAuthLogin: vi.fn().mockResolvedValue({ subscriptionId: 'oauth-sub-1' }),
        unsubscribeProviderOAuthLogin: vi.fn().mockResolvedValue(undefined),
        openExternalUrl,
        writeClipboardText,
      },
    });
    startProviderOAuthLoginMock.mockResolvedValue({
      id: 'login-1',
      provider: 'openai-codex',
      providerName: 'OpenAI',
      status: 'running',
      authUrl: 'https://auth.openai.com/oauth',
      authInstructions: 'A browser window should open.',
      deviceCode: {
        verificationUri: 'https://auth.openai.com/oauth',
        userCode: 'ABCD-1234',
        expiresInSeconds: 600,
      },
      prompt: null,
      progress: [],
      error: '',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
    });

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    selectProviderByText(container, 'openai-codex');
    await flushAsyncWork();

    const oauthButton = queryButtonByLabel(container, 'Start OAuth login (openai-codex)');
    click(oauthButton);
    await flushAsyncWork();

    expect(startProviderOAuthLoginMock).toHaveBeenCalledWith('openai-codex');
    expect(openExternalUrl).toHaveBeenCalledWith('https://auth.openai.com/oauth');
    const verificationLink = container.querySelector('a[href="https://auth.openai.com/oauth"]');
    expect(verificationLink).toBeInstanceOf(HTMLAnchorElement);
    expect(container.textContent).toContain('ABCD-1234');

    const copyCodeButton = queryButton(container, 'Copy code');
    click(copyCodeButton);
    await flushAsyncWork();

    expect(writeClipboardText).toHaveBeenCalledWith('ABCD-1234');
  });

  it('hides internal OAuth browser-open failures for provider login', async () => {
    const openExternalUrl = vi.fn().mockResolvedValue({
      url: 'https://auth.openai.com/oauth',
      opened: false,
      error:
        'Local API route did not complete for POST /api/provider-auth/open-external at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/localApi.js:132:20)',
    });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockImplementation(() => new Promise(() => {})),
        readDesktopAppPreferences: vi.fn().mockResolvedValue({
          available: true,
          supportsStartOnSystemStart: true,
          autoInstallUpdates: false,
          updatePath: 'stable',
          startOnSystemStart: false,
          keyboardShortcuts: {
            showApp: 'CommandOrControl+Shift+A',
            newConversation: 'CommandOrControl+N',
            closeTab: 'CommandOrControl+W',
            reopenClosedTab: 'Command+Shift+N',
            previousConversation: 'CommandOrControl+[',
            nextConversation: 'CommandOrControl+]',
            togglePinned: 'CommandOrControl+Alt+P',
            archiveRestoreConversation: 'CommandOrControl+Alt+A',
            renameConversation: 'CommandOrControl+Alt+R',
            focusComposer: 'CommandOrControl+L',
            editWorkingDirectory: 'CommandOrControl+Shift+L',
            findOnPage: 'CommandOrControl+F',
            settings: 'CommandOrControl+,',
            quit: 'CommandOrControl+Q',
            conversationMode: 'F1',
            workbenchMode: 'F2',
            newWorkbenchTab: 'CommandOrControl+T',
            closeWorkbenchTab: 'CommandOrControl+Shift+W',
            closeWorkbenchFile: 'CommandOrControl+Alt+W',
            refreshWorkbenchFile: 'F5',
            toggleWorkbenchExplorer: 'CommandOrControl+B',
            toggleWorkbenchDiff: 'CommandOrControl+Shift+D',
            toggleSidebar: 'CommandOrControl+/',
            toggleRightRail: 'CommandOrControl+\\',
          },
          update: { supported: false, status: 'idle', currentVersion: '0.0.0' },
        }),
        updateDesktopAppPreferences: vi.fn(),
        startProviderOAuthLogin: vi.fn(),
        subscribeProviderOAuthLogin: vi.fn().mockResolvedValue({ subscriptionId: 'oauth-sub-1' }),
        unsubscribeProviderOAuthLogin: vi.fn().mockResolvedValue(undefined),
        openExternalUrl,
        writeClipboardText: vi.fn().mockResolvedValue({ ok: true }),
      },
    });
    startProviderOAuthLoginMock.mockResolvedValue({
      id: 'login-1',
      provider: 'openai-codex',
      providerName: 'OpenAI',
      status: 'running',
      authUrl: 'https://auth.openai.com/oauth',
      authInstructions: 'A browser window should open.',
      deviceCode: null,
      prompt: null,
      progress: [],
      error: '',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
    });

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    selectProviderByText(container, 'openai-codex');
    await flushAsyncWork();

    click(queryButtonByLabel(container, 'Start OAuth login (openai-codex)'));
    await flushAsyncWork();

    expect(openExternalUrl).toHaveBeenCalledWith('https://auth.openai.com/oauth');
    expect(container.textContent).toContain('Could not open the provider login page. Copy the link and open it in your browser.');
    expectNoInternalProviderErrorDetails(container);
  });

  it('hides internal terminal OAuth login failures', async () => {
    startProviderOAuthLoginMock.mockResolvedValue({
      id: 'login-1',
      provider: 'openai-codex',
      providerName: 'OpenAI',
      status: 'failed',
      authUrl: '',
      authInstructions: '',
      deviceCode: null,
      prompt: null,
      progress: [],
      error:
        'OAuth login failed for /api/provider-auth/openai-codex/oauth/start at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/localApi.js:132:20)',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
    });

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    selectProviderByText(container, 'openai-codex');
    await flushAsyncWork();

    click(queryButtonByLabel(container, 'Start OAuth login (openai-codex)'));
    await flushAsyncWork();

    expect(container.textContent).toContain('Provider login failed. Try again.');
    expectNoInternalProviderErrorDetails(container);
  });

  it('auto-opens OAuth login URLs while showing manual callback recovery input', async () => {
    const openExternalUrl = vi.fn().mockResolvedValue({ url: 'https://auth.openai.com/oauth', opened: true });
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockImplementation(() => new Promise(() => {})),
        readDesktopAppPreferences: vi.fn().mockResolvedValue({
          available: true,
          supportsStartOnSystemStart: true,
          autoInstallUpdates: false,
          updatePath: 'stable',
          startOnSystemStart: false,
          keyboardShortcuts: {
            showApp: 'CommandOrControl+Shift+A',
            newConversation: 'CommandOrControl+N',
            closeTab: 'CommandOrControl+W',
            reopenClosedTab: 'Command+Shift+N',
            previousConversation: 'CommandOrControl+[',
            nextConversation: 'CommandOrControl+]',
            togglePinned: 'CommandOrControl+Alt+P',
            archiveRestoreConversation: 'CommandOrControl+Alt+A',
            renameConversation: 'CommandOrControl+Alt+R',
            focusComposer: 'CommandOrControl+L',
            editWorkingDirectory: 'CommandOrControl+Shift+L',
            findOnPage: 'CommandOrControl+F',
            settings: 'CommandOrControl+,',
            quit: 'CommandOrControl+Q',
            conversationMode: 'F1',
            workbenchMode: 'F2',
            newWorkbenchTab: 'CommandOrControl+T',
            closeWorkbenchTab: 'CommandOrControl+Shift+W',
            closeWorkbenchFile: 'CommandOrControl+Alt+W',
            refreshWorkbenchFile: 'F5',
            toggleWorkbenchExplorer: 'CommandOrControl+B',
            toggleWorkbenchDiff: 'CommandOrControl+Shift+D',
            toggleSidebar: 'CommandOrControl+/',
            toggleRightRail: 'CommandOrControl+\\',
          },
          update: { supported: false, status: 'idle', currentVersion: '0.0.0' },
        }),
        updateDesktopAppPreferences: vi.fn(),
        startProviderOAuthLogin: vi.fn(),
        subscribeProviderOAuthLogin: vi.fn().mockResolvedValue({ subscriptionId: 'oauth-sub-1' }),
        unsubscribeProviderOAuthLogin: vi.fn().mockResolvedValue(undefined),
        openExternalUrl,
        writeClipboardText: vi.fn().mockResolvedValue({ ok: true }),
      },
    });
    startProviderOAuthLoginMock.mockResolvedValue({
      id: 'login-1',
      provider: 'openai-codex',
      providerName: 'OpenAI',
      status: 'running',
      authUrl: 'https://auth.openai.com/oauth',
      authInstructions: 'A browser window should open.',
      deviceCode: null,
      prompt: {
        message: 'Paste the full redirect URL from the browser address bar. If the browser shows State mismatch, paste that URL here.',
        placeholder: 'http://localhost:1455/auth/callback?code=...',
        allowEmpty: false,
        manualCode: true,
      },
      progress: [],
      error: '',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
    });

    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    const providerButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('openai-codex'));
    if (!(providerButton instanceof HTMLButtonElement)) {
      throw new Error('Expected openai-codex provider button');
    }
    click(providerButton);
    await flushAsyncWork();

    click(queryButtonByLabel(container, 'Start OAuth login (openai-codex)'));
    await flushAsyncWork();

    expect(openExternalUrl).toHaveBeenCalledWith('https://auth.openai.com/oauth');
    expect(container.textContent).toContain('If the browser shows State mismatch, paste that URL here.');
    const oauthUrlInput = container.querySelector('#settings-provider-oauth-url');
    expect(oauthUrlInput).toBeInstanceOf(HTMLInputElement);
    expect((oauthUrlInput as HTMLInputElement).value).toBe('https://auth.openai.com/oauth');
  });

  it('removes a stored provider credential from the provider editor', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    removeProviderCredentialMock.mockResolvedValue({
      authFile: '/tmp/auth.json',
      providers: [
        {
          id: 'openai-codex',
          modelCount: 12,
          authType: 'none',
          hasStoredCredential: false,
          apiKeySupported: false,
          oauthSupported: true,
          oauthProviderName: 'OpenAI',
          oauthUsesCallbackServer: true,
        },
      ],
    });

    try {
      const { container } = renderPage('settings-providers');
      await flushAsyncWork();

      const providerButton = Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('openai-codex'),
      );
      if (!(providerButton instanceof HTMLButtonElement)) {
        throw new Error('Expected openai-codex provider button');
      }
      click(providerButton);
      await flushAsyncWork();

      const removeButton = queryButtonByLabel(container, 'Remove stored credential');
      expect(removeButton.disabled).toBe(false);
      click(removeButton);
      await flushAsyncWork();

      expect(confirmMock).toHaveBeenCalledWith('Remove the stored credential for openai-codex?');
      expect(removeProviderCredentialMock).toHaveBeenCalledWith('openai-codex');
    } finally {
      confirmMock.mockRestore();
    }
  });

  it('opens known providers from the preconfigured provider picker', async () => {
    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    expect(container.textContent).toContain('Choose provider');

    updateSelectValue(queryProviderPicker(container), 'anthropic');
    click(queryButton(container, 'Continue'));

    expect(container.querySelector('#settings-model-provider-id')).toBeNull();
    expect(container.textContent).toContain('Provider · anthropic');
  });

  it('shows provider API key entry when the selected provider supports API keys', async () => {
    const { container } = renderPage('settings-providers');
    await flushAsyncWork();

    updateSelectValue(queryProviderPicker(container), 'anthropic');
    click(queryButton(container, 'Continue'));
    await flushAsyncWork();

    expect(container.textContent).toContain('Provider · anthropic');
    expect(queryInput(container, '#settings-provider-api-key-modal')).toBeInstanceOf(HTMLInputElement);
  });

  it('runs telemetry database maintenance from settings', async () => {
    Object.assign(window as { neonPilotDesktop?: unknown }, {
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({ isElectron: true }),
        readDesktopAppPreferences: vi.fn().mockResolvedValue({
          available: true,
          supportsStartOnSystemStart: true,
          autoInstallUpdates: false,
          updatePath: 'stable',
          startOnSystemStart: false,
          keyboardShortcuts: {},
          update: { supported: false, status: 'idle', currentVersion: '0.0.0' },
        }),
        updateDesktopAppPreferences: vi.fn(),
      },
    });

    const { container } = renderPage('settings-desktop');
    await flushAsyncWork();

    const button = queryButtonByLabel(container, 'Clean up diagnostics index');
    await act(async () => {
      button.click();
    });
    await flushAsyncWork();

    expect(maintainTelemetryDbMock).toHaveBeenCalledWith();
    expect(container.textContent).toContain('Pruned 1 app activity rows and 2 trace rows');
  });

  it('does not render the vision model selector in general conversation settings', async () => {
    const { container } = renderPage();
    await flushAsyncWork();

    const visionSelect = container.querySelector<HTMLSelectElement>('#settings-vision-model');
    expect(visionSelect).toBeNull();
    expect(container.textContent).not.toContain('Required before inspecting uploaded images with the current model.');
  });
});
