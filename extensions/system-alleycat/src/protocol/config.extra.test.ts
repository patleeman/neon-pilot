import { describe, expect, it } from 'vitest';

import { config } from './config.js';

describe('system-alleycat config protocol extra coverage', () => {
  it('uses explicit cwd unless it is /root and includes optional layers', async () => {
    const ctx = { runtime: { getRepoRoot: () => '/repo' } } as never;

    await expect(config.read({ cwd: ' /work ', includeLayers: true }, ctx, {} as never)).resolves.toMatchObject({
      config: { cwd: '/work', default_cwd: '/work', model_provider: 'neon-pilot', sandbox: 'danger-full-access' },
      origins: {},
      layers: [],
    });
    await expect(config.read({ cwd: '/root', include_layers: true }, ctx, {} as never)).resolves.toMatchObject({
      config: { cwd: '/repo', default_cwd: '/repo' },
      layers: [],
    });
  });
});
