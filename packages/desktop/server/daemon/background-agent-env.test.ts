import { describe, expect, it } from 'vitest';

import { attachExtensionHostEnvForTrustedBackgroundAgent } from './background-agent-env.js';

describe('background agent env', () => {
  it('reattaches extension-host RPC env for trusted daemon-spawned agent runners', () => {
    const childEnv = attachExtensionHostEnvForTrustedBackgroundAgent(
      {},
      {
        NEON_PILOT_EXTENSION_HOST_BASE_URL: ' http://127.0.0.1:4321 ',
        NEON_PILOT_EXTENSION_HOST_TOKEN: ' secret ',
      },
    );

    expect(childEnv).toMatchObject({
      NEON_PILOT_EXTENSION_HOST_BASE_URL: 'http://127.0.0.1:4321',
      NEON_PILOT_EXTENSION_HOST_TOKEN: 'secret',
    });
  });

  it('leaves child env unchanged when either RPC value is missing', () => {
    expect(
      attachExtensionHostEnvForTrustedBackgroundAgent({ EXISTING: '1' }, { NEON_PILOT_EXTENSION_HOST_BASE_URL: 'http://127.0.0.1:4321' }),
    ).toEqual({ EXISTING: '1' });
  });
});
