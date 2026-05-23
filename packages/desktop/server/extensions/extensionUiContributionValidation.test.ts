import { describe, expect, it } from 'vitest';

import {
  validateComposerButtonContributions,
  validateComposerControlContributions,
  validateComposerInputToolContributions,
  validateComposerShelfContributions,
  validateMessageActionContributions,
  validateNewConversationPanelContributions,
  validateToolbarActionContributions,
  validateTopBarElementContributions,
} from './extensionUiContributionValidation';

describe('extensionUiContributionValidation', () => {
  it('validates UI contribution groups', () => {
    expect(validateTopBarElementContributions([{ id: 'top', component: 'Top' }])).toBeUndefined();
    expect(validateMessageActionContributions([{ id: 'msg', title: 'Msg', action: 'act', priority: 1 }])).toBeUndefined();
    expect(validateComposerShelfContributions([{ id: 'shelf', component: 'Shelf', placement: 'top' }])).toBeUndefined();
    expect(validateNewConversationPanelContributions([{ id: 'panel', component: 'Panel', priority: 1 }])).toBeUndefined();
    expect(validateComposerControlContributions([{ id: 'control', component: 'Control', slot: 'actions', priority: 1 }])).toBeUndefined();
    expect(validateComposerButtonContributions([{ id: 'button', component: 'Button', priority: 1 }])).toBeUndefined();
    expect(validateComposerInputToolContributions([{ id: 'tool', component: 'Tool', priority: 1 }])).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateMessageActionContributions([{ id: 'msg', title: 'Msg', action: 'act', priority: 1.5 }])).toThrow(
      'Extension manifest contributes.messageActions[0].priority must be an integer.',
    );
    expect(() => validateComposerShelfContributions([{ id: 'shelf', component: 'Shelf', placement: 'middle' }])).toThrow(
      'Extension manifest contributes.composerShelves[0].placement must be one of: top, bottom.',
    );
    expect(() => validateComposerControlContributions([{ id: 'control', component: 'Control', slot: 'bad' }])).toThrow(
      'Extension manifest contributes.composerControls[0].slot must be one of: leading, preferences, actions.',
    );
    expect(() => validateToolbarActionContributions([{ id: 'tb', title: 'TB', icon: 'bad', action: 'act' }])).toThrow(
      'Extension manifest contributes.toolbarActions[0].icon must be one of:',
    );
  });
});
