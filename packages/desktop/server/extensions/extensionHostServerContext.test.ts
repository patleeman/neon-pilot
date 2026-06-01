import { describe, expect, it, vi } from 'vitest';

import {
  createExtensionBackendServerContextFromSnapshot,
  createExtensionHostServerContextSnapshot,
  resolveExtensionBackendServerContext,
} from './extensionHostServerContext.js';

describe('extension host server context snapshots', () => {
  it('captures route context values without carrying functions', () => {
    const snapshot = createExtensionHostServerContextSnapshot({
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getSettingsFile: () => '/agent/settings.json',
      getAuthFile: () => '/agent/auth.json',
      getStateRoot: () => '/state',
      materializeWebRuntimeConfig: vi.fn(),
    });

    expect(snapshot).toEqual({
      runtimeScope: 'shared',
      repoRoot: '/repo',
      agentDir: '/agent',
      settingsFile: '/agent/settings.json',
      authFile: '/agent/auth.json',
      stateRoot: '/state',
    });
  });

  it('reconstructs the minimal backend server context from a snapshot', () => {
    const context = createExtensionBackendServerContextFromSnapshot({
      runtimeScope: 'shared',
      repoRoot: '/repo',
      settingsFile: '/agent/settings.json',
      authFile: '/agent/auth.json',
      stateRoot: '/state',
    });

    expect(context?.getRuntimeScope()).toBe('shared');
    expect(context?.getRepoRoot?.()).toBe('/repo');
    expect(context?.getSettingsFile?.()).toBe('/agent/settings.json');
    expect(context?.getAuthFile?.()).toBe('/agent/auth.json');
    expect(context?.getStateRoot?.()).toBe('/state');
  });

  it('prefers a live backend server context while keeping snapshot reconstruction centralized', () => {
    const liveContext = { getRuntimeScope: () => 'live' };
    const resolvedLive = resolveExtensionBackendServerContext({
      serverContext: liveContext,
      serverContextSnapshot: { runtimeScope: 'snapshot' },
    });
    const resolvedSnapshot = resolveExtensionBackendServerContext({
      serverContextSnapshot: { runtimeScope: 'snapshot' },
    });

    expect(resolvedLive).toBe(liveContext);
    expect(resolvedSnapshot?.getRuntimeScope()).toBe('snapshot');
  });
});
