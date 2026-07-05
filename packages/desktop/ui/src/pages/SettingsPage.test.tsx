import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatDefaultCwdSaveError, SettingsPage } from '../../../../../extensions/system-settings/src/SettingsPage';
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

const systemSettingsSourcePath = (relativePath: string) =>
  fileURLToPath(new URL(`../../../../../extensions/system-settings/src/${relativePath}`, import.meta.url));

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
  pathname: string,
  sectionIds?: React.ComponentProps<typeof SettingsPage>['sectionIds'],
  context?: React.ComponentProps<typeof SettingsPage>['context'],
): string {
  return renderToString(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/settings/*" element={<SettingsPage sectionIds={sectionIds} context={context} />} />
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

    expect(html).toContain('>Appearance</h1>');
    expect(html).not.toContain('>Settings</h1>');
    expect(html).not.toContain('aria-label="Settings sections"');
    expect(html).toContain('Theme');
    expect(html).not.toContain('AGENTS.md files');
    expect(html).not.toContain('Image Probe');
    expect(html).not.toContain('Knowledge base');
    expect(html).not.toContain('/Users/patrick/.local/state/neon-pilot/knowledge-base/repo');
    expect(html).not.toContain('In sync · Last synced');
    expect(html).not.toContain('Runtime services');
    expect(html).not.toContain('Operational overview');
    expect(html).not.toContain('Web UI');
    expect(html).not.toContain('Daemon');
    expect(html).not.toContain('Loading daemon settings');
    expect(html).not.toContain('Installed extensions, imported plugin packages, instruction files, skills, tools, and extension settings.');
    expect(html).not.toContain('Append extra AGENTS.md-style files to the runtime prompt.');
    expect(html).not.toContain('Indexed root');
    expect(html).not.toContain('aria-label="Choose indexed root"');
    expect(html).not.toContain('Repo root');
    expect(html).not.toContain('↻ Refresh');
  });

  it('renders the same settings shell for legacy query routes', () => {
    const html = renderPage('/settings?page=system-daemon');

    expect(html).toContain('>Appearance</h1>');
    expect(html).not.toContain('>Settings</h1>');
    expect(html).not.toContain('Runtime services');
    expect(html).not.toContain('Operational overview');
    expect(html).not.toContain('Restart daemon');
    expect(html).toContain('Theme');
    expect(html).not.toContain('Related Views');
  });

  it('renders native windowed settings chrome without the stable app page shell', () => {
    const html = renderPage('/settings', undefined, { shellPresentation: 'windowed', pathname: '/settings', hash: '' });

    expect(html).toContain('class="wos-page-shell settings-page-windowed"');
    expect(html).toContain('data-layout="two-column"');
    expect(html).toContain('class="wos-page-rail settings-page-windowed-nav"');
    expect(html).toContain('class="wos-settings-group settings-page-row-group');
    expect(html).toContain('class="wos-settings-row settings-page-control-row"');
    expect(html).toContain('aria-label="Sections"');
    expect(html).toContain('>Appearance</h1>');
    expect(html).toContain('>Providers</span>');
    expect(html).toContain('Windowed OS');
    expect(html).toContain('aria-label="Windowed OS theme"');
    expect(html).toContain('class="wos-segmented-control"');
    expect(html).toContain('data-accent="settings"');
    expect(html).toContain('>Time</button>');
    expect(html).not.toContain('Theme, accent, and visual defaults.');
    expect(html).not.toContain('Model and transcript defaults for new conversations.');
    expect(html).not.toContain('Connect model providers, save credentials, and add model overrides.');
    expect(html).not.toContain('settings-page-section-title');
    expect(html).not.toContain('Configure Neon Pilot preferences.');
    expect(html).not.toContain('>Preferences</div>');
    expect(html).not.toContain('Preference group');
    expect(html).not.toContain('Extension panel');
    expect(html).not.toContain('panels');
    expect(html).not.toContain('>Selected</span>');
    expect(html).not.toContain('>Settings context</div>');
    expect(html).not.toContain('>Sections</h3>');
    expect(html).not.toContain('wos-page-inspector');
    expect(html).not.toContain('>Providers</h1>');
    expect(html).not.toContain('ui-app-page-shell');
    expect(html).not.toContain('ui-settings-panel settings-page-row-group');
  });

  it('renders a single routed settings page in the windowed settings app', () => {
    const html = renderPage('/settings/providers', undefined, {
      shellPresentation: 'windowed',
      pathname: '/settings/providers',
      hash: '',
    });

    expect(html).toContain('class="wos-page-shell settings-page-windowed"');
    expect(html).toContain('>Providers</h1>');
    expect(html).toContain('Model providers');
    expect(html).toContain('data-active="true"');
    expect(html).not.toContain('>Appearance</h1>');
    expect(html).not.toContain('Theme mode selection');
    expect(html).not.toContain('Windowed OS');
    expect(html).not.toContain('Default project folder');
    expect(html).not.toContain('Command palette actions and keyboard shortcuts');
  });

  it('does not show the isolated windowed OS theme control in stable settings', () => {
    const html = renderPage('/settings', ['settings-appearance']);

    expect(html).toContain('Theme mode selection');
    expect(html).not.toContain('Windowed OS');
    expect(html).not.toContain('aria-label="Windowed OS theme"');
  });

  it('keeps the windowed settings rail on the shared list-row grammar', () => {
    const source = readFileSync(systemSettingsSourcePath('frontend.css'), 'utf8');
    const listRule = source.match(/\.settings-page-windowed-nav \.wos-list \{[^}]+}/)?.[0] ?? '';
    const itemRule = source.match(/\.settings-page-windowed-nav \.wos-list-item \{[^}]+}/)?.[0] ?? '';

    expect(listRule).toContain('border: 1.5px solid var(--wos-line-strong);');
    expect(listRule).toContain('overflow: hidden;');
    expect(itemRule).not.toContain('border: 1.5px solid var(--wos-ink-900);');
    expect(itemRule).toContain('border-top-color: var(--wos-line-muted);');
    expect(itemRule).not.toContain('border-radius: 0.5rem;');
    expect(itemRule).toContain('border-radius: 0;');
    expect(source).toContain('.settings-page-windowed .settings-page-row-group.wos-settings-group');
    expect(source).toContain('.settings-page-windowed .settings-page-control-row.wos-settings-row');
    expect(source).toContain('.settings-page-windowed .settings-page-control-actions .wos-segmented-control');
    expect(source).toContain('.settings-page-windowed .settings-page-control-actions .wos-segmented-control__item');
    expect(source).toContain('.settings-page-windowed .settings-page-control-actions .ui-segmented-control');
    expect(source).toContain('.settings-page-windowed .settings-page-control-actions .ui-segmented-button-active');
    expect(source).toContain('.settings-page-windowed .settings-page-control-actions .ui-swatch-option');
    expect(source).toContain('.settings-page-windowed .settings-page-control-actions .ui-swatch-option-checked');
    expect(source).toContain('.settings-page-windowed .settings-page-app-settings-stack-windowed');
    expect(source).toContain('.settings-page-windowed .settings-page-app-component-stack-windowed');
    expect(source).toContain('.settings-page-windowed .settings-page-app-component-body-windowed');
    expect(source).toContain('.settings-page-windowed .settings-page-app-component-body-windowed > .ui-settings-panel');
    expect(source).toContain('border: 1.5px solid var(--wos-line-strong);');
    expect(source).toContain('background: var(--wos-surface-2);');
  });

  it('keeps windowed extension settings panels out of nested settings groups', () => {
    const source = readFileSync(systemSettingsSourcePath('SettingsPage.tsx'), 'utf8');

    expect(source).toContain("if (shellPresentation === 'windowed') {");
    expect(source).toContain('settings-page-app-settings-stack-windowed');
    expect(source).toContain('settings-page-app-component-stack-windowed');
    expect(source).toContain('settings-page-app-component-body-windowed');
    expect(source).toContain('<SettingsPanelHost registration={registration} shellPresentation={shellPresentation} />');
  });

  it('right-aligns appearance accent choices within the settings action column', () => {
    const html = renderPage('/settings', ['settings-appearance']);

    expect(html).toContain('aria-label="Accent color"');
    expect(html).toContain('class="flex w-full flex-wrap justify-end gap-2"');
  });

  it('right-aligns workspace folder controls within the settings action column', () => {
    const html = renderPage('/settings', ['settings-workspace']);

    expect(html).toContain('Default project folder');
    expect(html).toContain('class="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"');
    expect(html).toContain('aria-label="Choose default working directory"');
  });

  it('formats default project folder save errors without raw local API details', () => {
    expect(
      formatDefaultCwdSaveError(
        new Error('500 Internal Server Error from /api/default-cwd: Directory does not exist: /tmp/does-not-exist-neon-pilot'),
      ),
    ).toBe('That folder does not exist. Choose an existing folder.');

    expect(formatDefaultCwdSaveError(new Error('500 Internal Server Error from /api/default-cwd: boom'))).toBe(
      'The default project folder could not be saved.',
    );
  });

  it('shows a desktop bridge warning instead of hiding desktop connections when preload is unavailable', () => {
    vi.stubGlobal('window', {
      neonPilotDesktop: undefined,
      location: { search: '' },
      sessionStorage: {
        getItem: () => null,
      },
    });
    vi.stubGlobal('document', {
      documentElement: { dataset: {} },
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Electron/31.0.2',
    });

    const html = renderPage('/settings', ['settings-desktop']);

    expect(html).toContain('Desktop');
  });
});
