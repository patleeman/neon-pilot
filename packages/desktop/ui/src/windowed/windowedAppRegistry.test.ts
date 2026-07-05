import { describe, expect, it } from 'vitest';

import type { ExtensionRegistryState } from '../extensions/useExtensionRegistry';
import { buildWindowedAppRegistry } from './windowedAppRegistry';

function registry(extensions: ExtensionRegistryState['extensions']): ExtensionRegistryState {
  return {
    extensions,
    routes: [],
    surfaces: [],
    topBarElements: [],
    messageActions: [],
    composerShelves: [],
    newConversationPanels: [],
    settingsComponent: null,
    settingsComponents: [],
    composerControls: [],
    composerInputTools: [],
    toolbarActions: [],
    contextMenus: [],
    selectionActions: [],
    threadHeaderActions: [],
    statusBarItems: [],
    conversationHeaderElements: [],
    conversationDecorators: [],
    activityTreeItemElements: [],
    activityTreeItemStyles: [],
    conversationLifecycle: [],
    transcriptBlocks: [],
    composerAttachmentProviders: [],
    composerAttachmentRenderers: [],
    composerAttachmentResolvers: [],
    activityTreeItemActions: [],
    loading: false,
    error: null,
  };
}

describe('windowed app registry', () => {
  it('projects canonical Windowed OS apps as app-facing registrations', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        { id: 'system-browser', name: 'Browser', enabled: true, contributes: {} },
        { id: 'system-files', name: 'Files', enabled: true, contributes: {} },
        { id: 'system-terminal', name: 'Terminal', enabled: true, contributes: {} },
        { id: 'system-automations', name: 'Automations', enabled: true, contributes: {} },
        { id: 'system-extension-manager', name: 'App Manager', enabled: true, contributes: {} },
      ]),
    );

    expect(apps.map((app) => app.title)).toEqual(['Chat', 'Browser', 'Files', 'Terminal', 'Automations', 'App Manager', 'Settings']);
    expect(apps.find((app) => app.title === 'Browser')).toMatchObject({
      id: 'browser',
      kind: 'browser',
      route: '/browser',
      source: 'app-package',
      sourcePackageId: 'system-browser',
      owner: { packageId: 'system-browser', packageType: 'extension' },
    });
    expect(apps.find((app) => app.title === 'Files')).toMatchObject({
      id: 'files',
      kind: 'files',
      route: '/files',
      sourcePackageId: 'system-files',
    });
    expect(apps.find((app) => app.title === 'Terminal')).toMatchObject({
      id: 'terminal',
      kind: 'terminal',
      route: '/terminal',
      sourcePackageId: 'system-terminal',
    });
    expect(apps.find((app) => app.title === 'Automations')).toMatchObject({
      id: 'automations',
      route: '/automations',
      source: 'app-package',
      sourcePackageId: 'system-automations',
      owner: { packageId: 'system-automations', packageType: 'extension' },
      accent: 'automations',
    });
    expect(apps.find((app) => app.title === 'Chat')).toMatchObject({
      id: 'chat',
      source: 'core',
      owner: { packageType: 'core' },
      window: { allowMultiple: true, singleton: false },
    });
  });

  it('keeps disabled app packages out of the launcher registry', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        { id: 'system-automations', name: 'Automations', enabled: false, contributes: {} },
        { id: 'system-browser', name: 'Browser', enabled: false, contributes: {} },
        { id: 'system-files', name: 'Files', enabled: false, contributes: {} },
        { id: 'system-terminal', name: 'Terminal', enabled: false, contributes: {} },
        { id: 'system-skills', name: 'Skills', enabled: true, contributes: {} },
      ]),
    );

    expect(apps.map((app) => app.title)).toEqual(['Chat', 'Skills', 'Settings']);
  });

  it('lets canonical app metadata win over duplicate package nav and view contributions', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        {
          id: 'system-extension-manager',
          name: 'App Manager',
          enabled: true,
          contributes: {
            nav: [{ id: 'extensions-nav', label: 'Extensions', route: '/extensions' }],
            views: [{ id: 'extensions-page', title: 'Extension Manager', location: 'main', route: '/extensions' }],
          },
        },
      ]),
    );

    expect(apps.map((app) => app.title)).toEqual(['Chat', 'App Manager', 'Settings']);
    expect(apps.find((app) => app.route === '/apps')).toMatchObject({
      id: 'app-manager',
      title: 'App Manager',
      accent: 'apps',
      routeAliases: ['/extensions'],
    });
  });

  it('keeps extra top-level package routes as apps without exposing nested pages', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        {
          id: 'custom-package',
          name: 'Custom Package',
          enabled: true,
          contributes: {
            nav: [
              { id: 'boards', label: 'Boards', route: '/boards' },
              { id: 'board-details', label: 'Board details', route: '/boards/details' },
            ],
            views: [{ id: 'reports', title: 'Reports', location: 'main', route: '/reports' }],
          },
        },
      ]),
    );

    expect(apps.map((app) => app.title)).toEqual(['Chat', 'Boards', 'Reports', 'Settings']);
    expect(apps.find((app) => app.title === 'Boards')).toMatchObject({
      source: 'app-package',
      sourcePackageId: 'custom-package',
      owner: { packageId: 'custom-package', packageType: 'extension' },
    });
    expect(apps.some((app) => app.title === 'Board details')).toBe(false);
  });
});
