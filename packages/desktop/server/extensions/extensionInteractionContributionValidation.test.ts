import { describe, expect, it } from 'vitest';

import {
  validateContextMenuContributions,
  validateSelectionActionContributions,
  validateSubscriptionContributions,
  validateTranscriptBlockContributions,
} from './extensionInteractionContributionValidation';

describe('extensionInteractionContributionValidation', () => {
  it('validates interaction contribution groups', () => {
    expect(validateContextMenuContributions([{ id: 'menu', title: 'Menu', action: 'act', surface: 'message' }])).toBeUndefined();
    expect(
      validateSelectionActionContributions([{ id: 'sel', title: 'Sel', action: 'act', kinds: ['text'], priority: 1 }]),
    ).toBeUndefined();
    expect(validateTranscriptBlockContributions([{ id: 'block', component: 'Block', schemaVersion: 1 }])).toBeUndefined();
    expect(validateSubscriptionContributions([{ id: 'sub', handler: 'run', source: 'events', debounceMs: 1 }])).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateContextMenuContributions([{ id: 'menu', title: 'Menu', action: 'act', surface: 'bad' }])).toThrow(
      'Extension manifest contributes.contextMenus[0].surface must be one of:',
    );
    expect(() =>
      validateContextMenuContributions([{ id: 'menu', title: 'Menu', action: 'act', surface: 'message', separator: 'yes' }]),
    ).toThrow('Extension manifest contributes.contextMenus[0].separator must be a boolean.');
    expect(() => validateSelectionActionContributions([{ id: 'sel', title: 'Sel', action: 'act', kinds: ['bad'] }])).toThrow(
      'Extension manifest contributes.selectionActions[0].kinds[0] must be one of:',
    );
    expect(() => validateTranscriptBlockContributions([{ id: 'block', component: 'Block', schemaVersion: 1.5 }])).toThrow(
      'Extension manifest contributes.transcriptBlocks[0].schemaVersion must be an integer.',
    );
    expect(() => validateSubscriptionContributions([{ id: 'sub', handler: 'run', source: 'events', debounceMs: 1.5 }])).toThrow(
      'Extension manifest contributes.subscriptions[0].debounceMs must be an integer.',
    );
  });
});
