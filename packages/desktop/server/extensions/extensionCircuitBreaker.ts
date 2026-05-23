export interface ExtensionFailureRecord {
  at: string;
  operation: string;
  error: string;
}

export interface ExtensionQuarantineEntry {
  reason: string;
  at: string;
  failures: number;
}

export interface ExtensionCircuitConfig {
  disabledIds?: string[];
  enabledIds?: string[];
  quarantined?: Record<string, ExtensionQuarantineEntry>;
}

export interface ExtensionStartupGuardCandidate {
  id: string;
  enabled: boolean;
  source: 'runtime' | 'system';
}

export function buildFailureRecord(input: { operation: string; error: string; now: number }): ExtensionFailureRecord {
  return { at: new Date(input.now).toISOString(), operation: input.operation, error: input.error };
}

export function pruneRecentFailureRecords(records: ExtensionFailureRecord[], cutoff: number): ExtensionFailureRecord[] {
  return records.filter((record) => {
    const at = Date.parse(record.at);
    return Number.isFinite(at) && at >= cutoff;
  });
}

export function applyExtensionQuarantine(
  config: ExtensionCircuitConfig,
  input: { extensionId: string; reason: string; at: string; failures: number },
): ExtensionCircuitConfig {
  const disabledIds = new Set(config.disabledIds ?? []);
  const enabledIds = new Set(config.enabledIds ?? []);
  disabledIds.add(input.extensionId);
  enabledIds.delete(input.extensionId);

  return {
    ...config,
    disabledIds: [...disabledIds].sort((left, right) => left.localeCompare(right)),
    enabledIds: [...enabledIds].sort((left, right) => left.localeCompare(right)),
    quarantined: {
      ...(config.quarantined ?? {}),
      [input.extensionId]: { reason: input.reason, at: input.at, failures: input.failures },
    },
  };
}

export function planStartupGuardQuarantines(
  config: ExtensionCircuitConfig,
  candidates: ExtensionStartupGuardCandidate[],
  at: string,
): { config: ExtensionCircuitConfig; disabledIds: string[] } {
  const disabledIds: string[] = [];
  let nextConfig = config;

  for (const candidate of candidates) {
    if (candidate.source !== 'runtime' || !candidate.enabled) continue;
    nextConfig = applyExtensionQuarantine(nextConfig, {
      extensionId: candidate.id,
      reason: 'Disabled by extension safe mode after an unclean startup.',
      at,
      failures: 0,
    });
    disabledIds.push(candidate.id);
  }

  return { config: nextConfig, disabledIds };
}
