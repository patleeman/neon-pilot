import type { MethodHandler } from '../codexJsonRpcServer.js';

export const account = {
  /** `account/read` — report that PA manages model auth outside Codex. */
  read: (async () => ({
    account: { type: 'apiKey' },
    requiresOpenaiAuth: false,
  })) as MethodHandler,

  /** `account/rateLimits/read` — PA does not expose Codex quota buckets; return a harmless unlimited snapshot. */
  rateLimitsRead: (async () => ({
    rateLimits: {
      limitId: 'neon-pilot',
      limitName: 'Neon Pilot',
      primary: { usedPercent: 0, windowDurationMins: null, resetsAt: null },
      secondary: null,
      credits: { hasCredits: true, unlimited: true, balance: null },
      planType: null,
      rateLimitReachedType: null,
    },
    rateLimitsByLimitId: null,
  })) as MethodHandler,
};
