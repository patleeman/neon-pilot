import { describe, expect, it } from 'vitest';

import { account } from './account.js';
import { REGISTERED_HANDLERS } from './index.js';

describe('system-alleycat account protocol', () => {
  it('registers a Codex-compatible account/rateLimits/read handler', async () => {
    expect(REGISTERED_HANDLERS['account/rateLimits/read']).toBe(account.rateLimitsRead);

    const result = (await account.rateLimitsRead({}, {} as never, {} as never, () => {})) as {
      rateLimits: { limitId: string; primary: { usedPercent: number }; credits: { unlimited: boolean } };
      rateLimitsByLimitId: null;
    };

    expect(result).toMatchObject({
      rateLimits: {
        limitId: 'neon-pilot',
        limitName: 'Neon Pilot',
        primary: { usedPercent: 0 },
        credits: { hasCredits: true, unlimited: true },
      },
      rateLimitsByLimitId: null,
    });
  });
});
