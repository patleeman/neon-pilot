import { describe, expect, it } from 'vitest';

import { buildCreateLiveSessionPerf } from './localApiCreateLiveSessionResponse';

describe('localApiCreateLiveSessionResponse', () => {
  it('builds rounded live session perf with capability-prefixed metrics', () => {
    expect(
      buildCreateLiveSessionPerf({
        startedAtMs: 1.2,
        contextReadyAtMs: 4.8,
        createdAtMs: 10.1,
        returnedAtMs: 12.9,
        contextSetupPerf: { contextRuntimeStateMs: 3 },
        capabilityPerf: { bootstrapMs: 7 },
      }),
    ).toEqual({
      contextRuntimeStateMs: 3,
      contextMs: 4,
      createCapabilityMs: 5,
      totalBeforeReturnMs: 12,
      'capability.bootstrapMs': 7,
    });
  });
});
