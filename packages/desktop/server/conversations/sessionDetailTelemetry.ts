export interface SessionDetailTelemetryInput {
  cache: 'hit' | 'miss';
  loader: 'full' | 'fast-tail';
  startedAt: bigint;
  requestedTailBlocks?: number;
  totalBlocks: number;
  blockOffset: number;
  contextUsageIncluded: boolean;
  modificationDetected?: boolean;
}

export interface SessionDetailReadTelemetryLike {
  cache: 'hit' | 'miss';
  loader: 'full' | 'fast-tail';
  durationMs: number;
  requestedTailBlocks?: number;
  totalBlocks: number;
  blockOffset: number;
  contextUsageIncluded: boolean;
  modificationDetected?: boolean;
}

export function buildSessionDetailTelemetry(input: SessionDetailTelemetryInput): SessionDetailReadTelemetryLike {
  return {
    cache: input.cache,
    loader: input.loader,
    durationMs: Number(process.hrtime.bigint() - input.startedAt) / 1_000_000,
    ...(typeof input.requestedTailBlocks === 'number' ? { requestedTailBlocks: input.requestedTailBlocks } : {}),
    totalBlocks: input.totalBlocks,
    blockOffset: input.blockOffset,
    contextUsageIncluded: input.contextUsageIncluded,
    ...(input.modificationDetected ? { modificationDetected: true } : {}),
  };
}

export function buildPromptCacheMissMetadata(input: {
  filePath: string;
  oldSignature: string;
  newSignature: string;
  oldSize: number;
  newSize: number;
  cacheLoader: 'full' | 'fast-tail';
}): Record<string, unknown> {
  return {
    filePath: input.filePath,
    oldSignature: input.oldSignature,
    newSignature: input.newSignature,
    oldSize: input.oldSize,
    newSize: input.newSize,
    oldMtime: Number(input.oldSignature.split(':')[1] ?? 0),
    newMtime: Number(input.newSignature.split(':')[1] ?? 0),
    cacheLoader: input.cacheLoader,
  };
}
