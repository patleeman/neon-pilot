// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatSettingsModelOptionValue,
  readSettingsSectionIdFromContext,
  readSettingsSectionIdFromHash,
  readSettingsSectionIdFromPathname,
  resolveSettingsModelOption,
  scrollSettingsSectionIntoView,
} from './SettingsPage';

const MODELS = [
  {
    id: 'deepseek-v4-flash',
    provider: 'ds4',
    name: 'DeepSeek V4 Flash',
    context: 400_000,
    input: ['text'],
    supportedServiceTiers: [],
  },
  {
    id: 'deepseek-v4-flash',
    provider: 'opencode-go',
    name: 'DeepSeek V4 Flash',
    context: 400_000,
    input: ['text'],
    supportedServiceTiers: [],
  },
  {
    id: 'gpt-5.4',
    provider: 'openai-codex',
    name: 'GPT-5.4',
    context: 200_000,
    input: ['text', 'image'],
    supportedServiceTiers: ['auto', 'priority'],
  },
] as const;

describe('settings model selection', () => {
  it('qualifies option values when two providers expose the same model id', () => {
    expect(formatSettingsModelOptionValue(MODELS[0], MODELS)).toBe('ds4/deepseek-v4-flash');
    expect(formatSettingsModelOptionValue(MODELS[1], MODELS)).toBe('opencode-go/deepseek-v4-flash');
    expect(formatSettingsModelOptionValue(MODELS[2], MODELS)).toBe('gpt-5.4');
  });

  it('resolves provider-qualified selected models without falling back to the first duplicate id', () => {
    expect(resolveSettingsModelOption(MODELS, 'opencode-go/deepseek-v4-flash')?.provider).toBe('opencode-go');
    expect(resolveSettingsModelOption(MODELS, 'ds4/deepseek-v4-flash')?.provider).toBe('ds4');
    expect(resolveSettingsModelOption(MODELS, 'deepseek-v4-flash')).toBeNull();
  });
});

describe('settings hash section parsing', () => {
  it('ignores malformed percent-encoded hashes', () => {
    expect(readSettingsSectionIdFromHash('#%E0%A4%A')).toBe('');
  });

  it('decodes valid section hashes', () => {
    expect(readSettingsSectionIdFromHash('#settings-providers')).toBe('settings-providers');
    expect(readSettingsSectionIdFromHash('#extension%3Asystem-settings')).toBe('extension:system-settings');
  });

  it('maps direct settings routes to their concrete section ids', () => {
    expect(readSettingsSectionIdFromPathname('/settings/appearance')).toBe('settings-appearance');
    expect(readSettingsSectionIdFromPathname('/settings/appearance/')).toBe('settings-appearance');
    expect(readSettingsSectionIdFromPathname('/settings/conversation')).toBe('settings-conversation');
    expect(readSettingsSectionIdFromPathname('/settings/conversation/')).toBe('settings-conversation');
    expect(readSettingsSectionIdFromPathname('/settings/providers')).toBe('settings-providers');
    expect(readSettingsSectionIdFromPathname('/settings/providers/')).toBe('settings-providers');
    expect(readSettingsSectionIdFromPathname('/settings/workspace')).toBe('settings-workspace');
    expect(readSettingsSectionIdFromPathname('/settings/workspace/')).toBe('settings-workspace');
    expect(readSettingsSectionIdFromPathname('/settings/commands')).toBe('settings-commands');
    expect(readSettingsSectionIdFromPathname('/settings/commands/')).toBe('settings-commands');
    expect(readSettingsSectionIdFromPathname('/settings/security')).toBe('settings-security');
    expect(readSettingsSectionIdFromPathname('/settings/security/')).toBe('settings-security');
    expect(readSettingsSectionIdFromPathname('/settings/extensions')).toBe('settings-extensions');
    expect(readSettingsSectionIdFromPathname('/settings/extensions/')).toBe('settings-extensions');
    expect(readSettingsSectionIdFromPathname('/settings/extensions/system-reply-actions')).toBe('settings-extension-system-reply-actions');
    expect(readSettingsSectionIdFromPathname('/settings/extensions/system%3Alocal')).toBe('settings-extension-system-local');
    expect(readSettingsSectionIdFromPathname('/settings/desktop')).toBe('settings-desktop');
    expect(readSettingsSectionIdFromPathname('/settings')).toBe('');
  });

  it('prefers the concrete browser pathname over the matched extension surface route', () => {
    expect(
      readSettingsSectionIdFromContext(
        { pathname: '/settings/extensions', hash: '', search: '' },
        { pathname: '/settings/extensions/system-reply-actions', hash: '' },
      ),
    ).toBe('settings-extension-system-reply-actions');
    expect(
      readSettingsSectionIdFromContext(
        { pathname: '/settings/extensions', hash: '', search: '' },
        { pathname: '/settings/extensions/system-reply-actions', hash: '#settings-extensions' },
      ),
    ).toBe('settings-extension-system-reply-actions');
  });
});

describe('settings section scrolling', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('scrolls the concrete nested settings anchor into view', () => {
    const container = document.createElement('div');
    const section = document.createElement('section');
    const scrollIntoView = vi.fn();
    section.id = 'extension:system-settings';
    section.scrollIntoView = scrollIntoView;
    container.appendChild(section);
    document.body.appendChild(container);

    scrollSettingsSectionIntoView(container, 'extension:system-settings');

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('uses container scrolling when the DOM environment has no scrollIntoView', () => {
    const container = document.createElement('div');
    const section = document.createElement('section');
    const scrollTo = vi.fn();
    section.id = 'settings-conversation';
    section.getBoundingClientRect = () =>
      ({
        top: 120,
        bottom: 160,
        left: 0,
        right: 0,
        width: 100,
        height: 40,
        x: 0,
        y: 120,
        toJSON: () => ({}),
      }) as DOMRect;
    container.getBoundingClientRect = () =>
      ({
        top: 20,
        bottom: 420,
        left: 0,
        right: 0,
        width: 100,
        height: 400,
        x: 0,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    container.scrollTop = 10;
    container.scrollTo = scrollTo;
    container.appendChild(section);
    document.body.appendChild(container);

    scrollSettingsSectionIntoView(container, 'settings-conversation');

    expect(scrollTo).toHaveBeenCalledWith({ top: 94 });
  });

  it('falls back to the container top when the anchor is not rendered', () => {
    const container = document.createElement('div');
    const scrollTo = vi.fn();
    container.scrollTo = scrollTo;
    document.body.appendChild(container);

    scrollSettingsSectionIntoView(container, 'settings-extension-missing');

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});

describe('windowed settings navigation', () => {
  it('renders nested settings routes as child rows without marking the parent active', () => {
    const source = readFileSync(join(process.cwd(), 'extensions/system-settings/src/SettingsPage.tsx'), 'utf8');

    expect(source).toContain('active={item.id === effectiveActiveQuickLinkId}');
    expect(source).toContain('depth={1}');
    expect(source).not.toContain('active={item.id === activeRootSectionId}');
  });
});
