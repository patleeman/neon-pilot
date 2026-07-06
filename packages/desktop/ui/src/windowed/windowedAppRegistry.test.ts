import { describe, expect, it } from 'vitest';

import type { ExtensionRegistryState } from '../extensions/useExtensionRegistry';
import { accentForTitle, buildWindowedAppRegistry } from './windowedAppRegistry';

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

    expect(apps.map((app) => app.title)).toEqual([
      'Home',
      'Chat',
      'Files',
      'Documents',
      'Browser',
      'Terminal',
      'Automations',
      'Inbox',
      'Activity',
      'Settings',
      'App Manager',
    ]);
    expect(apps.find((app) => app.title === 'Home')).toMatchObject({
      id: 'home',
      route: '/home',
      kind: 'route',
      source: 'core',
      owner: { packageType: 'core' },
      window: { allowMultiple: false, singleton: true },
    });
    expect(apps.find((app) => app.title === 'Documents')).toMatchObject({
      id: 'documents',
      route: '/documents',
      source: 'core',
      owner: { packageType: 'core' },
    });
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
    expect(apps.find((app) => app.title === 'Inbox')).toMatchObject({
      id: 'inbox',
      route: '/inbox',
      source: 'core',
      owner: { packageType: 'core' },
    });
    expect(apps.find((app) => app.title === 'Activity')).toMatchObject({
      id: 'activity',
      route: '/activity',
      source: 'core',
      owner: { packageType: 'core' },
    });
  });

  it('keeps disabled app packages out of the launcher registry', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        { id: 'system-automations', name: 'Automations', enabled: false, contributes: {} },
        { id: 'system-browser', name: 'Browser', enabled: false, contributes: {} },
        { id: 'system-files', name: 'Files', enabled: false, contributes: {} },
        { id: 'system-terminal', name: 'Terminal', enabled: false, contributes: {} },
        { id: 'system-prompt-assembly', name: 'Prompt Assembly', enabled: true, contributes: {} },
      ]),
    );

    expect(apps.map((app) => app.title)).toEqual(['Home', 'Chat', 'Documents', 'Inbox', 'Activity', 'Settings']);
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

    expect(apps.map((app) => app.title)).toEqual(['Home', 'Chat', 'Documents', 'Inbox', 'Activity', 'Settings', 'App Manager']);
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

    expect(apps.map((app) => app.title)).toEqual(['Home', 'Chat', 'Documents', 'Inbox', 'Activity', 'Settings', 'Boards', 'Reports']);
    expect(apps.find((app) => app.title === 'Boards')).toMatchObject({
      source: 'app-package',
      sourcePackageId: 'custom-package',
      owner: { packageId: 'custom-package', packageType: 'extension' },
    });
    expect(apps.some((app) => app.title === 'Board details')).toBe(false);
  });

  it('uses product-safe accents for dynamic app package titles', () => {
    expect(accentForTitle('Drawing Board')).toBe('drawing');
    expect(accentForTitle('Sketches')).toBe('drawing');
    expect(accentForTitle('Automation Lab')).toBe('automations');
    expect(accentForTitle('Extension Manager')).toBe('apps');
    expect(accentForTitle('Terminal Runs')).toBe('telemetry');

    expect(accentForTitle('Preference Builder')).toBe('settings');
    expect(accentForTitle('Provider Tokens')).toBe('settings');
    expect(accentForTitle('Provider Settings')).toBe('settings');
  });

  it('uses declared appearance accent when extension contributes appearance metadata', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        {
          id: 'drawing-app',
          name: 'Drawing App',
          enabled: true,
          contributes: {
            nav: [{ id: 'draw', label: 'Canvas', route: '/canvas' }],
            appearance: { accent: 'drawing' },
          },
        },
      ]),
    );

    const app = apps.find((a) => a.title === 'Canvas');
    expect(app).toBeDefined();
    expect(app!.accent).toBe('drawing');
  });

  it('respects declared appearance aliases and singleton behavior', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        {
          id: 'kanban-ext',
          name: 'Kanban',
          enabled: true,
          contributes: {
            nav: [{ id: 'boards', label: 'Boards', route: '/boards' }],
            appearance: {
              accent: 'apps',
              aliases: ['kanban', 'project boards', 'cards'],
              singleton: false,
              window: { defaultWidth: 960, defaultHeight: 620 },
            },
          },
        },
      ]),
    );

    const app = apps.find((a) => a.title === 'Boards');
    expect(app).toBeDefined();
    expect(app!.accent).toBe('apps');
    expect(app!.aliases).toEqual(['kanban', 'project boards', 'cards']);
    expect(app!.window).toEqual({ allowMultiple: true, singleton: false, defaultWidth: 960, defaultHeight: 620 });
  });

  it('falls back to heuristic accent when appearance has no accent', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        {
          id: 'my-ext',
          name: 'My Ext',
          enabled: true,
          contributes: {
            views: [{ id: 'automation-hub', title: 'Automation Hub', location: 'main', route: '/automation-hub' }],
            appearance: { singleton: false },
          },
        },
      ]),
    );

    const app = apps.find((a) => a.title === 'Automation Hub');
    expect(app).toBeDefined();
    expect(app!.accent).toBe('automations');
    expect(app!.window).toEqual({ allowMultiple: true, singleton: false });
  });

  it('propagates extension manifest description to app registration', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        {
          id: 'knowledge-ext',
          name: 'Knowledge Base',
          enabled: true,
          description: 'Search and manage your team knowledge base.',
          contributes: {
            nav: [{ id: 'knowledge', label: 'Knowledge', route: '/knowledge' }],
          },
        },
        {
          id: 'code-ext',
          name: 'Code Review',
          enabled: true,
          description: 'Review pull requests and manage code patches.',
          contributes: {
            views: [{ id: 'reviews', title: 'Reviews', location: 'main', route: '/reviews' }],
          },
        },
        {
          id: 'no-description-ext',
          name: 'No Desc',
          enabled: true,
          contributes: {
            nav: [{ id: 'simple', label: 'Simple', route: '/simple' }],
          },
        },
      ]),
    );

    const knowledgeApp = apps.find((a) => a.title === 'Knowledge');
    expect(knowledgeApp).toBeDefined();
    expect(knowledgeApp!.description).toBe('Search and manage your team knowledge base.');

    const reviewsApp = apps.find((a) => a.title === 'Reviews');
    expect(reviewsApp).toBeDefined();
    expect(reviewsApp!.description).toBe('Review pull requests and manage code patches.');

    const simpleApp = apps.find((a) => a.title === 'Simple');
    expect(simpleApp).toBeDefined();
    expect(simpleApp!.description).toBeUndefined();
  });

  it('preserves current behavior when appearance is omitted', () => {
    const apps = buildWindowedAppRegistry(
      registry([
        {
          id: 'custom',
          name: 'Custom',
          enabled: true,
          contributes: {
            nav: [{ id: 'todo', label: 'Todo', route: '/todo' }],
          },
        },
      ]),
    );

    const app = apps.find((a) => a.title === 'Todo');
    expect(app).toBeDefined();
    expect(app!.accent).toBe('settings');
    expect(app!.aliases).toBeUndefined();
    expect(app!.window).toEqual({ allowMultiple: false, singleton: true });
  });
});
