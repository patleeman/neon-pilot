import { describe, expect, it } from 'vitest';

import { normalizeRequiredProviderOAuthLoginId, shouldCloseProviderOAuthSubscription } from './localApiProviderOAuthSubscription';

describe('localApiProviderOAuthSubscription', () => {
  it('normalizes required login ids', () => {
    expect(normalizeRequiredProviderOAuthLoginId(' login ')).toBe('login');
    expect(() => normalizeRequiredProviderOAuthLoginId('  ')).toThrow('loginId required');
  });

  it('closes subscriptions for terminal states only', () => {
    expect(shouldCloseProviderOAuthSubscription({ status: 'completed' })).toBe(true);
    expect(shouldCloseProviderOAuthSubscription({ status: 'failed' })).toBe(true);
    expect(shouldCloseProviderOAuthSubscription({ status: 'cancelled' })).toBe(true);
    expect(shouldCloseProviderOAuthSubscription({ status: 'pending' })).toBe(false);
    expect(shouldCloseProviderOAuthSubscription({})).toBe(false);
    expect(shouldCloseProviderOAuthSubscription(null)).toBe(false);
  });
});
