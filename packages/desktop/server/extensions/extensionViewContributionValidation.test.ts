import { describe, expect, it } from 'vitest';

import {
  validatePromptReferenceContributions,
  validateThemeContributions,
  validateTranscriptRendererContributions,
  validateViewContributions,
  validateWebappContributions,
} from './extensionViewContributionValidation';

describe('extensionViewContributionValidation', () => {
  it('validates view-adjacent contribution groups', () => {
    expect(validateViewContributions([{ id: 'view', title: 'View', location: 'main', component: 'View' }])).toBeUndefined();
    expect(validateViewContributions([{ id: 'sidebar', title: 'Sidebar', location: 'sidebar', component: 'Sidebar' }])).toBeUndefined();
    expect(validateWebappContributions([{ id: 'app', title: 'App', entry: 'dist/webapp/index.html' }])).toBeUndefined();
    expect(validateWebappContributions([{ id: 'dev', title: 'Dev', target: 'http://127.0.0.1:4173/' }])).toBeUndefined();
    expect(validatePromptReferenceContributions([{ id: 'ref', handler: 'resolve' }])).toBeUndefined();
    expect(
      validateTranscriptRendererContributions([{ id: 'renderer', tool: 'tool', component: 'Renderer', standalone: true }]),
    ).toBeUndefined();
    expect(validateThemeContributions([{ id: 'theme', label: 'Theme', appearance: 'dark', tokens: {} }])).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateViewContributions([{ id: 'view', title: 'View', location: 'bad', component: 'View' }])).toThrow(
      'Extension manifest contributes.views[0].location must be one of: main, rightRail, workbench, sidebar.',
    );
    expect(() =>
      validateViewContributions([{ id: 'view', title: 'View', location: 'main', component: 'View', routeCapabilities: ['bad'] }]),
    ).toThrow('Extension manifest contributes.views[0].routeCapabilities[0] must be one of:');
    expect(() => validateWebappContributions([{ id: 'app', title: 'App' }])).toThrow(
      'Extension manifest contributes.webapps[0] must declare entry or target.',
    );
    expect(() => validateWebappContributions([{ id: 'Bad_Name', title: 'App', entry: 'dist/webapp/index.html' }])).toThrow(
      'Extension manifest contributes.webapps[0].id must be a lowercase DNS-safe webapp id.',
    );
    expect(() =>
      validateWebappContributions([{ id: 'app', title: 'App', entry: 'dist/webapp/index.html', target: 'http://127.0.0.1:4173/' }]),
    ).toThrow('Extension manifest contributes.webapps[0] must declare either entry or target, not both.');
    expect(() => validateWebappContributions([{ id: 'app', title: 'App', entry: '../index.html' }])).toThrow(
      'Extension manifest contributes.webapps[0].entry must be a package-relative path',
    );
    expect(() => validateWebappContributions([{ id: 'app', title: 'App', target: 'https://example.com/' }])).toThrow(
      'Extension manifest contributes.webapps[0].target must target localhost, 127.0.0.1, or ::1.',
    );
    expect(() =>
      validateWebappContributions([{ id: 'app', title: 'App', entry: 'dist/index.html', portlessName: 'Bad_Name' }]),
    ).toThrow('Extension manifest contributes.webapps[0].portlessName must be a lowercase DNS-safe Portless name.');
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
