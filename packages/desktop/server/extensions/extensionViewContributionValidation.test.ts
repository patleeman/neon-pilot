import { describe, expect, it } from 'vitest';

import {
  validatePromptReferenceContributions,
  validateThemeContributions,
  validateTranscriptRendererContributions,
  validateViewContributions,
} from './extensionViewContributionValidation';

describe('extensionViewContributionValidation', () => {
  it('validates view-adjacent contribution groups', () => {
    expect(validateViewContributions([{ id: 'view', title: 'View', location: 'main', component: 'View' }])).toBeUndefined();
    expect(validatePromptReferenceContributions([{ id: 'ref', handler: 'resolve' }])).toBeUndefined();
    expect(
      validateTranscriptRendererContributions([{ id: 'renderer', tool: 'tool', component: 'Renderer', standalone: true }]),
    ).toBeUndefined();
    expect(validateThemeContributions([{ id: 'theme', label: 'Theme', appearance: 'dark', tokens: {} }])).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateViewContributions([{ id: 'view', title: 'View', location: 'bad', component: 'View' }])).toThrow(
      'Extension manifest contributes.views[0].location must be one of: main, rightRail, workbench.',
    );
    expect(() =>
      validateViewContributions([{ id: 'view', title: 'View', location: 'main', component: 'View', routeCapabilities: ['bad'] }]),
    ).toThrow('Extension manifest contributes.views[0].routeCapabilities[0] must be one of:');
    expect(() => validatePromptReferenceContributions([{ id: 'ref' }])).toThrow(
      'Extension manifest contributes.promptReferences[0].handler must be a non-empty string.',
    );
    expect(() => validateTranscriptRendererContributions([{ id: 'renderer', tool: 'tool' }])).toThrow(
      'Extension manifest contributes.transcriptRenderers[0].component must be a non-empty string.',
    );
    expect(() =>
      validateTranscriptRendererContributions([{ id: 'renderer', tool: 'tool', component: 'Renderer', standalone: 'yes' }]),
    ).toThrow('Extension manifest contributes.transcriptRenderers[0].standalone must be a boolean.');
    expect(() => validateThemeContributions([{ id: 'theme', label: 'Theme', appearance: 'blue', tokens: {} }])).toThrow(
      'Extension manifest contributes.themes[0].appearance must be one of: light, dark.',
    );
  });
});
