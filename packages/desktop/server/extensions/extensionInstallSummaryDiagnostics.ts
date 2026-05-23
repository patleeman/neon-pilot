export function buildExtensionQuarantineDiagnostic(
  quarantine: { reason: string; failures: number; at: string } | undefined,
): string | null {
  return quarantine
    ? `Extension disabled by circuit breaker: ${quarantine.reason} (${quarantine.failures} failures at ${quarantine.at})`
    : null;
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
