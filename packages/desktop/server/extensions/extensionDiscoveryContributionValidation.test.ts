import { describe, expect, it } from 'vitest';

import {
  validatePromptAssemblyHookContributions,
  validateQuickOpenContributions,
  validateSearchProviderContributions,
} from './extensionDiscoveryContributionValidation';

describe('extensionDiscoveryContributionValidation', () => {
  it('validates discovery contribution groups', () => {
    expect(
      validatePromptAssemblyHookContributions([{ id: 'hook', handler: 'run', phase: 'after-discovery', priority: 1 }]),
    ).toBeUndefined();
    expect(validateQuickOpenContributions([{ id: 'quick', provider: 'load', order: 1 }])).toBeUndefined();
    expect(validateSearchProviderContributions([{ id: 'search', title: 'Search', action: 'search', kinds: ['thread'] }])).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validatePromptAssemblyHookContributions([{ id: 'hook', handler: 'run', phase: 'bad' }])).toThrow(
      'Extension manifest contributes.promptAssemblyHooks[0].phase must be one of:',
    );
    expect(() =>
      validatePromptAssemblyHookContributions([{ id: 'hook', handler: 'run', phase: 'after-discovery', priority: 1.5 }]),
    ).toThrow('Extension manifest contributes.promptAssemblyHooks[0].priority must be an integer.');
    expect(() => validateQuickOpenContributions([{ id: 'quick', provider: 'load', order: 1.5 }])).toThrow(
      'Extension manifest contributes.quickOpen[0].order must be an integer.',
    );
    expect(() => validateSearchProviderContributions([{ id: 'search', title: 'Search', action: 'search', priority: 1.5 }])).toThrow(
      'Extension manifest contributes.searchProviders[0].priority must be an integer.',
    );
  });
});
