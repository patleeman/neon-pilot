// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppEventsContext, INITIAL_APP_EVENT_VERSIONS } from '../app/contexts';
import { api } from '../client/api';
import { INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS } from '../conversation/conversationEventVersions';
import { ExtensionRegistryProvider, useExtensionRegistry } from './useExtensionRegistry';

vi.mock('../client/api', () => ({
  api: {
    extensionInstallations: vi.fn(),
    extensionRegistry: vi.fn(),
    extensionCriticalRegistry: vi.fn(),
    extensionRoutes: vi.fn(),
    extensionSurfaces: vi.fn(),
    settings: vi.fn(),
  },
}));

const extensionRegistryWrapper = ({ children }: { children: ReactNode }) => (
  <ExtensionRegistryProvider>{children}</ExtensionRegistryProvider>
);

function mockExtensionRegistryState({
  extensions = [],
  routes = [],
  surfaces = [],
  settings = {},
}: {
  extensions?: unknown[];
  routes?: unknown[];
  surfaces?: unknown[];
  settings?: Record<string, unknown>;
}) {
  vi.mocked(api.extensionRegistry).mockResolvedValue({ extensions, routes, surfaces, settings } as never);
  vi.mocked(api.extensionCriticalRegistry).mockResolvedValue({ extensions, routes, surfaces, settings } as never);
}

describe('useExtensionRegistry', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes component-backed extension chrome from manifests', async () => {
    mockExtensionRegistryState({
      extensions: [
        {
          id: 'test-extension',
          name: 'Test Extension',
          enabled: true,
          status: 'enabled',
          manifest: {
            schemaVersion: 2,
            id: 'test-extension',
            name: 'Test Extension',
            frontend: { entry: 'dist/frontend.js', styles: [] },
            contributes: {
              conversationHeaderElements: [
                {
                  id: 'header-indicator',
                  component: 'HeaderIndicator',
                  label: 'Header indicator',
                },
              ],
              statusBarItems: [
                {
                  id: 'git-status',
                  label: 'Git status',
                  component: 'GitStatusIndicator',
                  alignment: 'right',
                  priority: 100,
                },
              ],
              composerControls: [
                {
                  id: 'model-preferences',
                  component: 'ModelPreferencesComposerControl',
                  title: 'Model preferences',
                  slot: 'preferences',
                  priority: 100,
                },
              ],
              composerInputTools: [
                {
                  id: 'draw',
                  component: 'DrawButton',
                  title: 'Draw',
                  when: '!streamIsStreaming',
                  priority: 25,
                },
              ],
              activityTreeItemElements: [
                {
                  id: 'thread-color-dot',
                  component: 'ThreadColorDot',
                  slot: 'leading',
                  priority: 10,
                },
              ],
              activityTreeItemStyles: [
                {
                  id: 'thread-color-style',
                  provider: 'getThreadColorStyle',
                  priority: 20,
                },
              ],
            },
          },
        },
      ],
    });

    const { result } = renderHook(() => useExtensionRegistry(), { wrapper: extensionRegistryWrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.extensions).toEqual([
      expect.objectContaining({
        id: 'test-extension',
        enabled: true,
        manifest: expect.objectContaining({ id: 'test-extension' }),
      }),
    ]);
    expect(result.current.conversationHeaderElements).toEqual([
      {
        extensionId: 'test-extension',
        id: 'header-indicator',
        component: 'HeaderIndicator',
        label: 'Header indicator',
        frontendEntry: 'dist/frontend.js',
      },
    ]);
    expect(result.current.statusBarItems).toEqual([
      {
        extensionId: 'test-extension',
        id: 'git-status',
        label: 'Git status',
        component: 'GitStatusIndicator',
        alignment: 'right',
        priority: 100,
        frontendEntry: 'dist/frontend.js',
      },
    ]);
    expect(result.current.composerControls).toEqual([
      {
        extensionId: 'test-extension',
        id: 'model-preferences',
        component: 'ModelPreferencesComposerControl',
        title: 'Model preferences',
        slot: 'preferences',
        priority: 100,
        frontendEntry: 'dist/frontend.js',
      },
    ]);
    expect(result.current.composerButtons).toEqual([]);
    expect(result.current.composerInputTools).toEqual([
      {
        extensionId: 'test-extension',
        id: 'draw',
        component: 'DrawButton',
        title: 'Draw',
        when: '!streamIsStreaming',
        priority: 25,
        frontendEntry: 'dist/frontend.js',
      },
    ]);
    expect(result.current.activityTreeItemElements).toEqual([
      {
        extensionId: 'test-extension',
        id: 'thread-color-dot',
        component: 'ThreadColorDot',
        slot: 'leading',
        priority: 10,
        frontendEntry: 'dist/frontend.js',
      },
    ]);
    expect(result.current.activityTreeItemStyles).toEqual([
      {
        extensionId: 'test-extension',
        id: 'thread-color-style',
        provider: 'getThreadColorStyle',
        priority: 20,
      },
    ]);
  });

  it('shares one registry load across multiple consumers under the provider', async () => {
    mockExtensionRegistryState({
      extensions: [
        {
          id: 'shared-extension',
          name: 'Shared Extension',
          enabled: true,
          status: 'enabled',
          manifest: { schemaVersion: 2, id: 'shared-extension', name: 'Shared Extension' },
        },
      ],
    });

    const useTwoRegistryConsumers = () => {
      const first = useExtensionRegistry();
      const second = useExtensionRegistry();
      return { first, second };
    };

    const { result } = renderHook(() => useTwoRegistryConsumers(), { wrapper: extensionRegistryWrapper });

    await waitFor(() => expect(result.current.first.loading).toBe(false));
    expect(result.current.first.extensions.map((entry) => entry.id)).toEqual(['shared-extension']);
    expect(result.current.second.extensions.map((entry) => entry.id)).toEqual(['shared-extension']);
    expect(api.extensionRegistry).toHaveBeenCalledTimes(1);
    expect(api.extensionCriticalRegistry).toHaveBeenCalledTimes(1);
    expect(api.extensionInstallations).not.toHaveBeenCalled();
    expect(api.extensionRoutes).not.toHaveBeenCalled();
    expect(api.extensionSurfaces).not.toHaveBeenCalled();
    expect(api.settings).not.toHaveBeenCalled();
  });

  it('expands selection action picker items from extension settings', async () => {
    mockExtensionRegistryState({
      extensions: [
        {
          id: 'reply-extension',
          name: 'Reply Actions',
          enabled: true,
          status: 'enabled',
          manifest: {
            schemaVersion: 2,
            id: 'reply-extension',
            name: 'Reply Actions',
            contributes: {
              selectionActions: [
                {
                  id: 'emoji-picker-item',
                  title: 'Emoji reply',
                  action: 'composer.replyToSelection',
                  kinds: ['text', 'transcriptRange'],
                  icon: '👍',
                  priority: 100,
                  args: { draftText: '👍 Agree' },
                  settingItems: {
                    key: 'reply-extension.items',
                    idPrefix: 'emoji-picker-item',
                    argsKey: 'draftText',
                    icon: 'firstToken',
                  },
                },
              ],
            },
          },
        },
      ],
      settings: {
        'reply-extension.items': '🚀 Ship it, 🧭 Reorient',
      },
    });

    const { result } = renderHook(() => useExtensionRegistry(), { wrapper: extensionRegistryWrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selectionActions).toEqual([
      expect.objectContaining({
        id: 'emoji-picker-item-1',
        title: '🚀 Ship it',
        icon: '🚀',
        args: { draftText: '🚀 Ship it' },
      }),
      expect.objectContaining({
        id: 'emoji-picker-item-2',
        title: '🧭 Reorient',
        icon: '🧭',
        args: { draftText: '🧭 Reorient' },
      }),
    ]);
  });

  it('removes setting-expanded selection actions when the setting is empty', async () => {
    mockExtensionRegistryState({
      extensions: [
        {
          id: 'reply-extension',
          name: 'Reply Actions',
          enabled: true,
          status: 'enabled',
          manifest: {
            schemaVersion: 2,
            id: 'reply-extension',
            name: 'Reply Actions',
            contributes: {
              selectionActions: [
                {
                  id: 'emoji-picker-item',
                  title: 'Emoji reply',
                  action: 'composer.replyToSelection',
                  kinds: ['text', 'transcriptRange'],
                  icon: '👍',
                  priority: 100,
                  args: { draftText: '👍 Agree' },
                  settingItems: {
                    key: 'reply-extension.items',
                    idPrefix: 'emoji-picker-item',
                    argsKey: 'draftText',
                    icon: 'firstToken',
                  },
                },
              ],
            },
          },
        },
        {
          id: 'other-extension',
          name: 'Other Extension',
          enabled: true,
          status: 'enabled',
          manifest: {
            schemaVersion: 2,
            id: 'other-extension',
            name: 'Other Extension',
            contributes: {
              selectionActions: [
                {
                  id: 'other-action',
                  title: 'Other action',
                  action: 'other.action',
                  kinds: ['text'],
                  icon: 'O',
                  priority: 10,
                },
              ],
            },
          },
        },
      ],
      settings: {
        'reply-extension.items': ' , ; ',
      },
    });

    const { result } = renderHook(() => useExtensionRegistry(), { wrapper: extensionRegistryWrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selectionActions).toEqual([
      expect.objectContaining({
        extensionId: 'other-extension',
        id: 'other-action',
      }),
    ]);
  });

  it('keeps disabled extensions visible but removes their active contributions', async () => {
    mockExtensionRegistryState({
      extensions: [
        {
          id: 'disabled-extension',
          name: 'Disabled Extension',
          enabled: false,
          status: 'disabled',
          manifest: {
            schemaVersion: 2,
            id: 'disabled-extension',
            name: 'Disabled Extension',
            frontend: { entry: 'dist/frontend.js', styles: [] },
            contributes: {
              composerButtons: [{ id: 'disabled-button', component: 'DisabledButton', placement: 'actions' }],
              statusBarItems: [{ id: 'disabled-status', label: 'Disabled status', component: 'DisabledStatus', alignment: 'right' }],
            },
          },
        },
      ],
      routes: [{ route: '/disabled', extensionId: 'disabled-extension', surfaceId: 'disabled-page', packageType: 'system' }],
      surfaces: [
        {
          extensionId: 'disabled-extension',
          packageType: 'system',
          id: 'disabled-nav',
          placement: 'left',
          kind: 'navItem',
          route: '/disabled',
          label: 'Disabled',
        },
      ],
    });

    const { result } = renderHook(() => useExtensionRegistry(), { wrapper: extensionRegistryWrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.extensions.map((entry) => entry.id)).toEqual(['disabled-extension']);
    expect(result.current.routes).toEqual([]);
    expect(result.current.surfaces).toEqual([]);
    expect(result.current.composerButtons).toEqual([]);
    expect(result.current.statusBarItems).toEqual([]);
  });

  it('reloads when the extensions app topic is invalidated', async () => {
    let extensionsVersion = 0;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AppEventsContext.Provider
        value={{
          versions: { ...INITIAL_APP_EVENT_VERSIONS, extensions: extensionsVersion },
          conversationVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS,
        }}
      >
        <ExtensionRegistryProvider>{children}</ExtensionRegistryProvider>
      </AppEventsContext.Provider>
    );

    const firstRegistryState = {
      extensions: [
        {
          id: 'test-extension',
          name: 'Test Extension',
          enabled: true,
          status: 'enabled',
          manifest: { schemaVersion: 2, id: 'test-extension', name: 'Test Extension' },
        },
      ],
      routes: [],
      surfaces: [],
      settings: {},
    } as never;
    const secondRegistryState = {
      extensions: [
        {
          id: 'next-extension',
          name: 'Next Extension',
          enabled: true,
          status: 'enabled',
          manifest: { schemaVersion: 2, id: 'next-extension', name: 'Next Extension' },
        },
      ],
      routes: [],
      surfaces: [],
      settings: {},
    } as never;
    vi.mocked(api.extensionCriticalRegistry).mockResolvedValueOnce(firstRegistryState).mockResolvedValueOnce(secondRegistryState);
    vi.mocked(api.extensionRegistry)
      .mockResolvedValueOnce({
        extensions: [
          {
            id: 'test-extension',
            name: 'Test Extension',
            enabled: true,
            status: 'enabled',
            manifest: { schemaVersion: 2, id: 'test-extension', name: 'Test Extension' },
          },
        ],
        routes: [],
        surfaces: [],
        settings: {},
      } as never)
      .mockResolvedValueOnce({
        extensions: [
          {
            id: 'next-extension',
            name: 'Next Extension',
            enabled: true,
            status: 'enabled',
            manifest: { schemaVersion: 2, id: 'next-extension', name: 'Next Extension' },
          },
        ],
        routes: [],
        surfaces: [],
        settings: {},
      } as never);

    const { result, rerender } = renderHook(() => useExtensionRegistry(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.extensions.map((entry) => entry.id)).toEqual(['test-extension']);

    extensionsVersion = 1;
    rerender();

    await waitFor(() => expect(result.current.extensions.map((entry) => entry.id)).toEqual(['next-extension']));
    expect(api.extensionRegistry).toHaveBeenCalledTimes(2);
    expect(api.extensionCriticalRegistry).toHaveBeenCalledTimes(2);
  });

  it('keeps registry arrays defined when the extension API is unavailable', async () => {
    const originalExtensionRegistry = api.extensionRegistry;
    const originalExtensionCriticalRegistry = api.extensionCriticalRegistry;
    (api as unknown as { extensionRegistry?: unknown }).extensionRegistry = undefined;
    (api as unknown as { extensionCriticalRegistry?: unknown }).extensionCriticalRegistry = undefined;

    try {
      const { result } = renderHook(() => useExtensionRegistry(), { wrapper: extensionRegistryWrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.conversationHeaderElements).toEqual([]);
      expect(result.current.conversationDecorators).toEqual([]);
      expect(result.current.activityTreeItemElements).toEqual([]);
      expect(result.current.activityTreeItemStyles).toEqual([]);
      expect(result.current.statusBarItems).toEqual([]);
      expect(result.current.composerButtons).toEqual([]);
      expect(result.current.composerInputTools).toEqual([]);
    } finally {
      (api as unknown as { extensionRegistry: typeof originalExtensionRegistry }).extensionRegistry = originalExtensionRegistry;
      (api as unknown as { extensionCriticalRegistry: typeof originalExtensionCriticalRegistry }).extensionCriticalRegistry =
        originalExtensionCriticalRegistry;
    }
  });
});
