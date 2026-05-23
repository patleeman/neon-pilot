import { describe, expect, it } from 'vitest';

import {
  validateConversationDecoratorContributions,
  validateConversationHeaderElementContributions,
  validateConversationLifecycleContributions,
} from './extensionConversationContributionValidation';

describe('extensionConversationContributionValidation', () => {
  it('validates conversation contribution groups', () => {
    expect(validateConversationHeaderElementContributions([{ id: 'header', component: 'Header' }])).toBeUndefined();
    expect(
      validateConversationDecoratorContributions([{ id: 'decorator', component: 'Decorator', position: 'subtitle', priority: 1 }]),
    ).toBeUndefined();
    expect(
      validateConversationLifecycleContributions([{ id: 'life', component: 'Life', events: ['before-run'], slot: 'banner', priority: 1 }]),
    ).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateConversationDecoratorContributions([{ id: 'decorator', component: 'Decorator', position: 'bad' }])).toThrow(
      'Extension manifest contributes.conversationDecorators[0].position must be one of: before-title, after-title, subtitle.',
    );
    expect(() =>
      validateConversationDecoratorContributions([{ id: 'decorator', component: 'Decorator', position: 'subtitle', priority: 1.5 }]),
    ).toThrow('Extension manifest contributes.conversationDecorators[0].priority must be an integer.');
    expect(() => validateConversationLifecycleContributions([{ id: 'life', component: 'Life', events: ['bad'] }])).toThrow(
      'Extension manifest contributes.conversationLifecycle[0].events[0] must be one of:',
    );
    expect(() =>
      validateConversationLifecycleContributions([{ id: 'life', component: 'Life', events: ['before-run'], slot: 'bad' }]),
    ).toThrow('Extension manifest contributes.conversationLifecycle[0].slot must be one of: banner, inline.');
  });
});
