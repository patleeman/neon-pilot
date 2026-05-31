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

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

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

describe('SettingsPage', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message?: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('useLayoutEffect does nothing on the server')) {
        return;
      }

      originalConsoleError(message, ...args);
    });

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

    const settingsResult = buildUseApiResult({ 'sample.enabled': true, 'conversation.pinnedToolCalls': true });
    const settingsSchemaResult = buildUseApiResult([
      {
        extensionId: 'sample-extension',
        key: 'sample.enabled',
        type: 'boolean',
        default: true,
        description: 'Sample manifest setting',
        group: 'Sample',
        order: 1,
      },
      {
        extensionId: 'sample-extension',
        key: 'conversation.pinnedToolCalls',
        type: 'boolean',
        default: true,
        description: 'Sample camelCase setting',
        group: 'Sample',
        order: 2,
      },
    ]);

    vi.mocked(useApi).mockImplementation((fetcher, key) => {
      if (fetcher === api.skillFolders) {
        return buildUseApiResult({
          configFile: '/tmp/config.json',
          skillDirs: ['/Users/patrick/Documents/neon-pilot/skills'],
        });
      }

      if (fetcher === api.instructions) {
        return buildUseApiResult({
          configFile: '/tmp/config.json',
          instructionFiles: ['/Users/patrick/Documents/neon-pilot/AGENTS.md'],
        });
      }

      if (fetcher === api.systemPromptTemplate) {
        return buildUseApiResult({
          configFile: '/tmp/config.json',
          template: '# Neon Pilot defaults\n\nPrimary knowledge path: {{ knowledge_root }}\n',
        });
      }

      if (fetcher === api.models) {
        return buildUseApiResult({
          currentModel: 'gpt-5.4',
          currentThinkingLevel: 'medium',
          currentServiceTier: '',
          models: [
            {
              id: 'gpt-5.4',
              provider: 'openai-codex',
              name: 'GPT-5.4',
              context: 200000,
              supportedServiceTiers: ['auto', 'priority'],
            },
            {
              id: 'qwen-reap',
              provider: 'desktop',
              name: 'Qwen REAP',
              context: 262144,
            },
          ],
        });
      }

      if (fetcher === api.modelProviders) {
        return buildUseApiResult({
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
      }

      if (fetcher === api.defaultCwd) {
        return buildUseApiResult({
          currentCwd: '',
          effectiveCwd: '/Users/patrick/workingdir/neon-pilot',
        });
      }

      if (fetcher === api.conversationTitleSettings) {
        return buildUseApiResult({
          enabled: true,
          currentModel: '',
          effectiveModel: 'openai-codex/gpt-5.4',
        });
      }

      if (fetcher === api.transcriptionSettings) {
        return buildUseApiResult({
          settings: { provider: 'local-whisper', model: 'base.en' },
          providers: [],
        });
      }

      if (fetcher === api.settings) {
        return settingsResult;
      }

      if (fetcher === api.settingsSchema) {
        return settingsSchemaResult;
      }

      if (fetcher === api.secrets) {
        return buildUseApiResult({
          backend: 'keychain',
          secrets: [
            {
              extensionId: 'system-exa-search',
              secretId: 'exaApiKey',
              key: 'extension:system-exa-search:exaApiKey',
              label: 'Exa API key',
              env: 'EXA_API_KEY',
              configured: false,
              source: null,
              writable: true,
            },
          ],
        });
      }

      if (fetcher === api.status) {
        return buildUseApiResult({
          profile: 'assistant',
          repoRoot: '/Users/patrick/workingdir/neon-pilot',
          projectCount: 5,
          appRevision: 'abc123',
        });
      }

      if (fetcher === api.telemetryLogs) {
        return buildUseApiResult({
          logDir: '/tmp/pa/logs/telemetry',
          fileCount: 1,
          sizeBytes: 42,
          files: [
            {
              path: '/tmp/pa/logs/telemetry/app-telemetry-2026-05-14.jsonl',
              name: 'app-telemetry-2026-05-14.jsonl',
              sizeBytes: 42,
              modifiedAt: '2026-05-14T00:00:00.000Z',
            },
          ],
        });
      }

      if (fetcher === api.providerAuth) {
        return buildUseApiResult({
          authFile: '/tmp/auth.json',
          providers: [
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
      }

      if (key === 'system-remote-auth') {
        return buildUseApiResult({
          sessions: [],
          pendingPairings: [],
        });
      }

      if (fetcher === api.telegramGatewayToken) {
        return buildUseApiResult({ configured: false });
      }

      if (key === 'knowledge-settings-knowledge-base') {
        return buildUseApiResult({
          repoUrl: 'https://github.com/user/knowledge-base.git',
          branch: 'main',
          configured: true,
          effectiveRoot: '/Users/patrick/Documents/neon-pilot',
          managedRoot: '/Users/patrick/.local/state/neon-pilot/knowledge-base/repo',
          usesManagedRoot: true,
          syncStatus: 'idle',
          lastSyncAt: '2026-04-16T12:00:00.000Z',
          recoveredEntryCount: 1,
          recoveryDir: '/Users/patrick/.local/state/neon-pilot/knowledge-base/recovered',
        });
      }

      throw new Error(`Unexpected SettingsPage useApi call for key ${key ?? '<none>'}`);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the reorganized single-page settings view', () => {
    const html = renderPage('/settings');

    expect(html).toContain('>Settings</h1>');
    expect(html).toContain('aria-label="Settings sections"');
    expect(html.indexOf('href="#settings-appearance"')).toBeLessThan(html.indexOf('href="#settings-conversation"'));
    expect(html.indexOf('href="#settings-conversation"')).toBeLessThan(html.indexOf('href="#settings-workspace"'));
    expect(html.indexOf('href="#settings-workspace"')).toBeLessThan(html.indexOf('href="#settings-commands"'));
    expect(html.indexOf('href="#settings-commands"')).toBeLessThan(html.indexOf('href="#settings-providers"'));
    expect(html).toContain('Theme');
    expect(html).not.toContain('href="#settings-extensions"');
    expect(html).not.toContain('AGENTS.md files');
    expect(html).not.toContain('Image Probe');
    expect(html).not.toContain('Knowledge base');
    expect(html).not.toContain('Sample manifest setting');
    expect(html).not.toContain('Pinned Tool Calls');
    expect(html).not.toContain('pinnedToolCalls');
    expect(html).not.toContain('Injected by');
    expect(html).not.toContain('<span class="font-mono text-primary">sample-extension</span>');
    expect(html).not.toContain('Injected by extension <span');
    expect(html).not.toContain('/Users/patrick/.local/state/neon-pilot/knowledge-base/repo');
    expect(html).not.toContain('In sync · Last synced');
    expect(html).toContain('Default model');
    expect(html).toContain('Provider &amp; model definitions');
    expect(html).not.toContain('Runtime services');
    expect(html).not.toContain('Operational overview');
    expect(html).not.toContain('Web UI');
    expect(html).not.toContain('Daemon');
    expect(html).not.toContain('Loading daemon settings');
    expect(html).toContain('Theme, accent, and visual defaults.');
    expect(html).toContain('Model and behavior defaults for new chats.');
    expect(html).toContain('Default working directory and local context paths.');
    expect(html).not.toContain('Installed extensions, imported plugin packages, instruction files, skills, tools, and extension settings.');
    expect(html).not.toContain('Append extra AGENTS.md-style files to the runtime prompt.');
    expect(html).toContain('Leave blank to use the runtime process cwd.');
    expect(html).not.toContain('Indexed root');
    expect(html).not.toContain('aria-label="Choose indexed root"');
    expect(html).toContain('aria-label="Choose default working directory"');
    expect(html).not.toContain('Repo root');
    expect(html).toContain('Telemetry logs');
    expect(html).toContain('app-telemetry-2026-05-14.jsonl');
    expect(html).not.toContain('↻ Refresh');
  });

  it('renders the same consolidated settings page for legacy query routes', () => {
    const html = renderPage('/settings?page=system-daemon');

    expect(html).toContain('>Settings</h1>');
    expect(html).not.toContain('Runtime services');
    expect(html).not.toContain('Operational overview');
    expect(html).not.toContain('Restart daemon');
    expect(html).toContain('Provider &amp; model definitions');
    expect(html).not.toContain('Related Views');
  });

  it('shows a desktop bridge warning instead of hiding desktop connections when preload is unavailable', () => {
    vi.stubGlobal('window', {
      neonPilotDesktop: undefined,
      location: { search: '?desktop-shell=1' },
      sessionStorage: {
        getItem: () => null,
      },
    });
    vi.stubGlobal('document', {
      documentElement: { dataset: {} },
    });

    const html = renderPage('/settings');

    expect(html).toContain('Desktop');
  });
});
