export function shouldDispatchInitialLiveSessionPrompt(input: { prompt?: string; imageCount?: number }): boolean {
  return (typeof input.prompt === 'string' && input.prompt.trim().length > 0) || (input.imageCount ?? 0) > 0;
}

export function buildCreateLiveSessionPerf(input: {
  startedAtMs: number;
  contextReadyAtMs: number;
  createdAtMs: number;
  returnedAtMs: number;
  contextSetupPerf?: Record<string, number> | null;
  capabilityPerf?: Record<string, number>;
}): Record<string, number> {
  return {
    ...(input.contextSetupPerf ?? {}),
    contextMs: Math.round(input.contextReadyAtMs - input.startedAtMs),
    createCapabilityMs: Math.round(input.createdAtMs - input.contextReadyAtMs),
    totalBeforeReturnMs: Math.round(input.returnedAtMs - input.startedAtMs),
    ...(input.capabilityPerf
      ? Object.fromEntries(Object.entries(input.capabilityPerf).map(([key, value]) => [`capability.${key}`, value]))
      : {}),
  };
}
