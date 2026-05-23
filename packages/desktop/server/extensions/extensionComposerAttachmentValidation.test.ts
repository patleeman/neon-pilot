import { describe, expect, it } from 'vitest';

import {
  validateActivityTreeItemActionContributions,
  validateComposerAttachmentProviderContributions,
  validateComposerAttachmentRendererContributions,
  validateComposerAttachmentResolverContributions,
} from './extensionComposerAttachmentValidation';

describe('extensionComposerAttachmentValidation', () => {
  it('validates composer attachment contribution groups', () => {
    expect(
      validateComposerAttachmentProviderContributions([{ id: 'provider', title: 'Provider', action: 'act', priority: 1 }]),
    ).toBeUndefined();
    expect(
      validateComposerAttachmentRendererContributions([{ id: 'renderer', type: 'file', component: 'Renderer', priority: 1 }]),
    ).toBeUndefined();
    expect(validateComposerAttachmentResolverContributions([{ id: 'resolver', type: 'file', action: 'resolve' }])).toBeUndefined();
    expect(validateActivityTreeItemActionContributions([{ id: 'action', title: 'Action', action: 'act', priority: 1 }])).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() =>
      validateComposerAttachmentProviderContributions([{ id: 'provider', title: 'Provider', action: 'act', priority: 1.5 }]),
    ).toThrow('Extension manifest contributes.composerAttachmentProviders[0].priority must be an integer.');
    expect(() =>
      validateComposerAttachmentRendererContributions([{ id: 'renderer', type: 'file', component: 'Renderer', priority: 1.5 }]),
    ).toThrow('Extension manifest contributes.composerAttachmentRenderers[0].priority must be an integer.');
    expect(() => validateComposerAttachmentResolverContributions([{ id: 'resolver', type: 'file' }])).toThrow(
      'Extension manifest contributes.composerAttachmentResolvers[0].action must be a non-empty string.',
    );
    expect(() => validateActivityTreeItemActionContributions([{ id: 'action', title: 'Action', action: 'act', priority: 1.5 }])).toThrow(
      'Extension manifest contributes.activityTreeItemActions[0].priority must be an integer.',
    );
  });
});
