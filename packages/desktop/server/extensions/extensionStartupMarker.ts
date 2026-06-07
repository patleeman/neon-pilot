export interface ExtensionStartupMarker {
  startedAt: string;
  activeExtensionId?: string;
}

export function buildExtensionStartupMarker(startedAt: string, activeExtensionId?: string): string {
  return `${JSON.stringify(activeExtensionId ? { startedAt, activeExtensionId } : { startedAt }, null, 2)}\n`;
}

export function parseExtensionStartupMarker(raw: string): ExtensionStartupMarker | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (typeof record.startedAt !== 'string') return null;
    return {
      startedAt: record.startedAt,
      ...(typeof record.activeExtensionId === 'string' && record.activeExtensionId.trim()
        ? { activeExtensionId: record.activeExtensionId.trim() }
        : {}),
    };
  } catch {
    return null;
  }
}

export function buildExtensionStartupGuardResult(input: { safeMode: boolean; disabledIds: string[] }): {
  safeMode: boolean;
  disabledIds: string[];
} {
  return { safeMode: input.safeMode, disabledIds: input.disabledIds };
}
