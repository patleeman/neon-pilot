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
            transcriptRenderers: [{ id: 'checkpoint-card', tool: 'checkpoint', component: 'CheckpointCard' }],
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
        transcriptRenderers: [expect.objectContaining({ id: 'checkpoint-card' })],
      }),
    );
    expect(response.extensions[0]?.manifest.contributes).not.toHaveProperty('tools');
    expect(response.extensions[0]?.manifest).not.toHaveProperty('backend');
    expect(response.extensions[0]?.permissions).toEqual([]);
  });

  it('keeps transcript renderer extensions in the critical registry', () => {
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
          id: 'checkpoint-renderer',
          name: 'Checkpoint Renderer',
          packageType: 'system',
          frontend: { entry: 'frontend.js' },
          contributes: {
            transcriptRenderers: [{ id: 'checkpoint-card', tool: 'checkpoint', component: 'CheckpointCard' }],
          },
        },
      ],
      routes: [],
      surfaces: [],
      views: [],
    } as never);

    expect(response.extensions.map((extension) => extension.id)).toEqual(['checkpoint-renderer']);
    expect(response.extensions[0]?.manifest.contributes?.transcriptRenderers).toEqual([
      expect.objectContaining({ id: 'checkpoint-card' }),
    ]);
    expect(response.routes).toHaveLength(0);
    expect(response.surfaces).toHaveLength(0);
  });
});
