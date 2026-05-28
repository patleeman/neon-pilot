import { describe, expect, it } from 'vitest';

import { buildCriticalExtensionRegistryResponse } from './localApiExtensionRegistryPresentation.js';

describe('local API critical extension registry presentation', () => {
  it('preserves static chat and shell UI contributions without runtime state', () => {
    const response = buildCriticalExtensionRegistryResponse({
      extensions: [
        {
          schemaVersion: 2,
          id: 'test-extension',
          name: 'Test Extension',
          packageType: 'system',
          frontend: { entry: 'frontend.js' },
          contributes: {
            nav: [{ id: 'test-nav', title: 'Test', route: '/test', icon: 'app' }],
            messageActions: [{ id: 'copy-message', title: 'Copy', action: 'copy.message' }],
            composerShelves: [{ id: 'todos', component: 'TodoShelf', placement: 'top' }],
            newConversationPanels: [{ id: 'starter', component: 'StarterPanel' }],
            conversationLifecycle: [{ id: 'blocked', component: 'BlockedBanner', events: ['blocked'], slot: 'banner' }],
            statusBarItems: [{ id: 'git', label: 'Git', component: 'GitStatus' }],
            activityTreeItemActions: [{ id: 'pin', title: 'Pin', action: 'thread.pin' }],
            tools: [{ id: 'slow-tool', name: 'slow_tool', action: 'tools.slow', description: 'Slow tool', inputSchema: {} }],
          },
          backend: {
            actions: [{ id: 'copy.message', handler: './backend.js#copyMessage' }],
            services: [{ id: 'watcher', entry: './service.js' }],
          },
        },
      ],
      routes: [{ route: '/test', extensionId: 'test-extension', surfaceId: 'page', packageType: 'system' }],
      surfaces: [],
      views: [],
    } as never);

    expect(response.settings).toEqual({});
    expect(response.extensions[0]?.manifest.contributes).toEqual(
      expect.objectContaining({
        messageActions: [expect.objectContaining({ id: 'copy-message' })],
        composerShelves: [expect.objectContaining({ id: 'todos' })],
        newConversationPanels: [expect.objectContaining({ id: 'starter' })],
        conversationLifecycle: [expect.objectContaining({ id: 'blocked' })],
        statusBarItems: [expect.objectContaining({ id: 'git' })],
        activityTreeItemActions: [expect.objectContaining({ id: 'pin' })],
      }),
    );
    expect(response.extensions[0]?.manifest.contributes).not.toHaveProperty('tools');
    expect(response.extensions[0]?.manifest).not.toHaveProperty('backend');
    expect(response.extensions[0]?.permissions).toEqual([]);
  });

  it('omits extensions that do not contribute startup UI', () => {
    const response = buildCriticalExtensionRegistryResponse({
      extensions: [
        {
          schemaVersion: 2,
          id: 'tool-only',
          name: 'Tool Only',
          packageType: 'system',
          contributes: {
            tools: [{ id: 'slow-tool', name: 'slow_tool', action: 'tools.slow', description: 'Slow tool', inputSchema: {} }],
          },
        },
        {
          schemaVersion: 2,
          id: 'route-owner',
          name: 'Route Owner',
          packageType: 'system',
          frontend: { entry: 'frontend.js' },
          contributes: {
            views: [{ id: 'page', title: 'Page', location: 'main', route: '/page', component: 'Page' }],
          },
        },
      ],
      routes: [{ route: '/page', extensionId: 'route-owner', surfaceId: 'page', packageType: 'system' }],
      surfaces: [],
      views: [
        {
          id: 'page',
          title: 'Page',
          location: 'main',
          route: '/page',
          component: 'Page',
          extensionId: 'route-owner',
          packageType: 'system',
          frontend: { entry: 'frontend.js' },
        },
      ],
    } as never);

    expect(response.extensions.map((extension) => extension.id)).toEqual(['route-owner']);
    expect(response.routes).toHaveLength(1);
    expect(response.surfaces).toHaveLength(1);
  });
});
