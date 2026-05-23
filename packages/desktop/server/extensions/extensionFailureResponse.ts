export function buildExtensionFailureResponse(input: { quarantined: boolean; failures: number }): {
  quarantined: boolean;
  failures: number;
} {
  return { quarantined: input.quarantined, failures: input.failures };
}

export function shouldQuarantineExtensionFailure(input: { failureCount: number; threshold: number }): boolean {
  return input.failureCount >= input.threshold;
}
