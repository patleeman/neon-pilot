import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { describe, expect, it, vi } from 'vitest';

import {
  createExtensionBackendServerContextFromSnapshot,
  createExtensionHostServerContextSnapshot,
  resolveExtensionBackendServerContext,
} from './extensionHostServerContext.js';

describe('extension host server context snapshots', () => {
  it('captures route context values without carrying functions', () => {
    const desktopRootLayout = resolveDesktopRootLayout({ root: '/custom-desktop-root' });
    const snapshot = createExtensionHostServerContextSnapshot({
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getSettingsFile: () => '/agent/settings.json',
      getAuthFile: () => '/agent/auth.json',
      getStateRoot: () => '/state',
      getDesktopRootLayout: () => desktopRootLayout,
      materializeWebRuntimeConfig: vi.fn(),
    });

    expect(snapshot).toEqual({
      runtimeScope: 'shared',
      repoRoot: '/repo',
      agentDir: '/agent',
      settingsFile: '/agent/settings.json',
      authFile: '/agent/auth.json',
      stateRoot: '/state',
      desktopRootLayout,
    });
  });

  it('omits desktopRootLayout when getDesktopRootLayout is absent', () => {
    const snapshot = createExtensionHostServerContextSnapshot({
      getRuntimeScope: () => 'shared',
      materializeWebRuntimeConfig: vi.fn(),
    });

    expect(snapshot?.desktopRootLayout).toBeUndefined();
  });

  it('reconstructs the minimal backend server context from a snapshot', () => {
    const desktopRootLayout = resolveDesktopRootLayout({ root: '/custom-desktop-root' });
    const context = createExtensionBackendServerContextFromSnapshot({
      runtimeScope: 'shared',
      repoRoot: '/repo',
      settingsFile: '/agent/settings.json',
      authFile: '/agent/auth.json',
      stateRoot: '/state',
      desktopRootLayout,
    });

    expect(context?.getRuntimeScope()).toBe('shared');
    expect(context?.getRepoRoot?.()).toBe('/repo');
    expect(context?.getSettingsFile?.()).toBe('/agent/settings.json');
    expect(context?.getAuthFile?.()).toBe('/agent/auth.json');
    expect(context?.getStateRoot?.()).toBe('/state');
    expect(context?.getDesktopRootLayout?.()).toEqual(desktopRootLayout);
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

  it('reconstructs getDesktopRootLayout from its snapshot field', () => {
    const desktopRootLayout = resolveDesktopRootLayout({ root: '/reconstructed-root' });
    const context = createExtensionBackendServerContextFromSnapshot({
      runtimeScope: 'shared',
      desktopRootLayout,
    });

    expect(context?.getDesktopRootLayout?.()).toEqual(desktopRootLayout);
    expect(context?.getDesktopRootLayout?.().root).toBe('/reconstructed-root');
  });

  it('omits getDesktopRootLayout when desktopRootLayout is not in snapshot', () => {
    const context = createExtensionBackendServerContextFromSnapshot({
      runtimeScope: 'shared',
    });

    expect(context?.getDesktopRootLayout).toBeUndefined();
  });

  it('resolves settingsFile from desktopRootLayout when settingsFile is absent but layout is present', () => {
    const desktopRootLayout = resolveDesktopRootLayout({ root: '/layout-settings-root' });
    const context = createExtensionBackendServerContextFromSnapshot({
      runtimeScope: 'shared',
      desktopRootLayout,
    });

    expect(context?.getSettingsFile?.()).toBe('/layout-settings-root/system/runtime/settings.json');
    expect(context?.getDesktopRootLayout?.()).toEqual(desktopRootLayout);
  });

  it('falls back to legacy getRuntimeSettingsFilePath when neither settingsFile nor desktopRootLayout is present', () => {
    const context = createExtensionBackendServerContextFromSnapshot({
      runtimeScope: 'shared',
      stateRoot: '/legacy-state',
    });

    expect(context?.getSettingsFile?.()).toBe('/legacy-state/neon-pilot-runtime/settings.json');
  });
});
