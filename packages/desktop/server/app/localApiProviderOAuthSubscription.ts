export function normalizeRequiredProviderOAuthLoginId(loginId: string): string {
  const normalizedLoginId = loginId.trim();
  if (!normalizedLoginId) {
    throw new Error('loginId required');
  }
  return normalizedLoginId;
}

export function shouldCloseProviderOAuthSubscription(state: unknown): boolean {
  if (!state || typeof state !== 'object' || !('status' in state)) {
    return false;
  }

  const status = typeof state.status === 'string' ? state.status : '';
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
