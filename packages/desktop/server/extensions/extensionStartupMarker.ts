export function buildExtensionStartupMarker(startedAt: string): string {
  return `${JSON.stringify({ startedAt }, null, 2)}\n`;
}

export function buildExtensionStartupGuardResult(input: { safeMode: boolean; disabledIds: string[] }): {
  safeMode: boolean;
  disabledIds: string[];
} {
  return { safeMode: input.safeMode, disabledIds: input.disabledIds };
}
