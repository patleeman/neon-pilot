import { describe, expect, it } from 'vitest';

import { buildPromptCacheMissMetadata, buildSessionDetailTelemetry } from './sessionDetailTelemetry';

describe('sessionDetailTelemetry', () => {
  it('builds telemetry with optional fields', () => {
    const telemetry = buildSessionDetailTelemetry({
      cache: 'miss',
      loader: 'fast-tail',
      startedAt: process.hrtime.bigint(),
      requestedTailBlocks: 50,
      totalBlocks: 100,
      blockOffset: 50,
      contextUsageIncluded: false,
      modificationDetected: true,
    });

    expect(telemetry).toMatchObject({
      cache: 'miss',
      loader: 'fast-tail',
      requestedTailBlocks: 50,
      totalBlocks: 100,
      blockOffset: 50,
      contextUsageIncluded: false,
      modificationDetected: true,
    });
    expect(telemetry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('builds prompt cache miss telemetry metadata', () => {
    expect(
      buildPromptCacheMissMetadata({
        filePath: '/sessions/a.jsonl',
        oldSignature: '10:123.5',
        newSignature: '12:456.5',
        oldSize: 10,
        newSize: 12,
        cacheLoader: 'full',
      }),
    ).toEqual({
      filePath: '/sessions/a.jsonl',
      oldSignature: '10:123.5',
      newSignature: '12:456.5',
      oldSize: 10,
      newSize: 12,
      oldMtime: 123.5,
      newMtime: 456.5,
      cacheLoader: 'full',
    });
  });
});
