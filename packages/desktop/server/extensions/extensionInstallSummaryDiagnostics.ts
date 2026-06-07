export function buildExtensionQuarantineDiagnostic(
  quarantine: { reason: string; failures: number; at: string } | undefined,
): string | null {
  if (!quarantine) return null;
  if (quarantine.failures === 0 && quarantine.reason === 'Disabled by extension safe mode after an unclean startup.') {
    return [
      'Extension disabled by startup safe mode: Neon Pilot found a stale extension startup marker from a previous launch.',
      'No extension-specific failure was recorded, so this was a protective quarantine rather than a circuit-breaker failure.',
      `Recorded at ${quarantine.at}.`,
    ].join(' ');
  }
  return `Extension disabled by circuit breaker: ${quarantine.reason} (${quarantine.failures} failures at ${quarantine.at})`;
}

export function mergeExtensionInstallDiagnostics(input: {
  diagnostics: string[];
  quarantineDiagnostic?: string | null;
  healthError?: string;
}): { diagnostics?: string[]; healthError?: string } {
  const allDiagnostics = [...input.diagnostics, ...(input.quarantineDiagnostic ? [input.quarantineDiagnostic] : [])];
  if (input.healthError) {
    return { healthError: input.healthError, diagnostics: [...allDiagnostics, `Backend health check failed: ${input.healthError}`] };
  }
  return allDiagnostics.length > 0 ? { diagnostics: allDiagnostics } : {};
}
