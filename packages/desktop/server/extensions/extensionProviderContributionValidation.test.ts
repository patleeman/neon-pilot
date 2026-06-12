import { describe, expect, it } from 'vitest';

import {
  validateConversationConnectionProviderContributions,
  validateDynamicProviderContributions,
  validateRuntimeProviderContributions,
  validateTurnContextProviderContributions,
} from './extensionProviderContributionValidation';

describe('extensionProviderContributionValidation', () => {
  it('validates provider contribution groups', () => {
    expect(
      validateTurnContextProviderContributions([{ id: 'ctx', handler: 'load', title: 'Context', priority: 1, scope: ['global'] }]),
    ).toBeUndefined();
    expect(
      validateConversationConnectionProviderContributions([
        { id: 'connections', action: 'load', title: 'Connections', kind: 'state', surfaces: ['composerShelf', 'cli'], priority: 1 },
      ]),
    ).toBeUndefined();
    expect(validateRuntimeProviderContributions([{ id: 'runtime', handler: 'load', title: 'Runtime' }])).toBeUndefined();
    expect(
      validateDynamicProviderContributions({ skillProviders: [{ id: 'skills', handler: 'load', title: 'Skills', priority: 1 }] }, [
        'skillProviders',
      ]),
    ).toBeUndefined();
  });

  it('preserves provider validation errors', () => {
    expect(() => validateTurnContextProviderContributions([{ id: 'ctx', handler: 'load', priority: 1.5 }])).toThrow(
      'Extension manifest contributes.turnContextProviders[0].priority must be an integer.',
    );
    expect(() => validateTurnContextProviderContributions([{ id: 'ctx', handler: 'load', scope: ['bad'] }])).toThrow(
      'Extension manifest contributes.turnContextProviders[0].scope[0] must be one of: global, workspace, conversation.',
    );
    expect(() => validateConversationConnectionProviderContributions([{ id: 'connections', action: 'load', kind: 'bad' }])).toThrow(
      'Extension manifest contributes.conversationConnectionProviders[0].kind must be one of: activity, state, asset, context, integration, surface.',
    );
    expect(() =>
      validateConversationConnectionProviderContributions([{ id: 'connections', action: 'load', surfaces: ['bad'] }]),
    ).toThrow(
      'Extension manifest contributes.conversationConnectionProviders[0].surfaces[0] must be one of: activityShelf, composerShelf, rightRail, workbench, sidebar, cli.',
    );
    expect(() => validateRuntimeProviderContributions([{ id: 'runtime', handler: 'load' }])).toThrow(
      'Extension manifest contributes.runtimeProviders[0].title must be a non-empty string.',
    );
    expect(() =>
      validateDynamicProviderContributions({ toolProviders: [{ id: 'tools', handler: 'load', priority: 1.5 }] }, ['toolProviders']),
    ).toThrow('Extension manifest contributes.toolProviders[0].priority must be an integer.');
  });
});
