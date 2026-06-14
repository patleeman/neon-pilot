import { describe, expect, it } from 'vitest';

import { hasInstallArtifacts } from './frontend';

describe('hasInstallArtifacts', () => {
  it('returns true for partial installs that still need cleanup', () => {
    expect(
      hasInstallArtifacts({
        installed: false,
        pluginInstalled: true,
        marketplaceEntryInstalled: true,
        marketplaceName: 'neon-pilot-local',
        marketplaceRoot: '/tmp/marketplace',
        marketplacePath: '/tmp/marketplace/.agents/plugins/marketplace.json',
        pluginPath: '/tmp/marketplace/plugins/neon-pilot',
        installedVersion: '0.1.1',
        codex: {
          checked: true,
          marketplaceRegistered: true,
          pluginInstalled: false,
          pluginEnabled: false,
          mcp: { checked: true, registered: false, tools: [] },
        },
      }),
    ).toBe(true);
  });

  it('returns false when nothing is installed anywhere', () => {
    expect(
      hasInstallArtifacts({
        installed: false,
        pluginInstalled: false,
        marketplaceEntryInstalled: false,
        marketplaceName: 'neon-pilot-local',
        marketplaceRoot: '',
        marketplacePath: '',
        pluginPath: '',
        installedVersion: null,
        codex: {
          checked: true,
          marketplaceRegistered: false,
          pluginInstalled: false,
          pluginEnabled: false,
          mcp: { checked: true, registered: false, tools: [] },
        },
      }),
    ).toBe(false);
  });
});
