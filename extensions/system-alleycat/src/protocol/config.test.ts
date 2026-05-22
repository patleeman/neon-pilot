import { describe, expect, it } from 'vitest';

import { config } from './config.js';

describe('alleycat config protocol', () => {
  it('reads effective config using explicit cwd and optional layers', async () => {
    await expect(config.read({ cwd: ' /repo ', includeLayers: true }, {} as never)).resolves.toMatchObject({
      config: {
        cwd: '/repo',
        default_cwd: '/repo',
        model_provider: 'neon-pilot',
        sandbox: 'danger-full-access',
        approval_policy: 'on-failure',
        platform: process.platform,
        version: '0.1.0',
      },
      origins: {},
      layers: [],
    });
  });

  it('falls back to runtime repo root for missing, blank, or /root cwd', async () => {
    const ctx = { runtime: { getRepoRoot: () => '/runtime-repo' } };
    await expect(config.read({ cwd: '/root' }, ctx as never)).resolves.toMatchObject({
      config: { cwd: '/runtime-repo' },
      layers: undefined,
    });
    await expect(config.read({ cwd: '   ', include_layers: true }, ctx as never)).resolves.toMatchObject({
      config: { cwd: '/runtime-repo' },
      layers: [],
    });
  });
});
