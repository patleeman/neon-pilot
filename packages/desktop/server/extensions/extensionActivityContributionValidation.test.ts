import { describe, expect, it } from 'vitest';

import {
  validateActivityTreeItemElementContributions,
  validateActivityTreeItemStyleContributions,
  validateStatusBarItemContributions,
  validateThreadHeaderActionContributions,
} from './extensionActivityContributionValidation';

describe('extensionActivityContributionValidation', () => {
  it('validates thread, status, and activity contribution groups', () => {
    expect(validateThreadHeaderActionContributions([{ id: 'thread', component: 'Thread', priority: 1 }])).toBeUndefined();
    expect(validateStatusBarItemContributions([{ id: 'status', label: 'Status', alignment: 'left', priority: 1 }])).toBeUndefined();
    expect(
      validateActivityTreeItemElementContributions([{ id: 'activity', component: 'Activity', slot: 'trailing', priority: 1 }]),
    ).toBeUndefined();
    expect(validateActivityTreeItemStyleContributions([{ id: 'style', provider: 'style', priority: 1 }])).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateThreadHeaderActionContributions([{ id: 'thread', component: 'Thread', priority: 1.5 }])).toThrow(
      'Extension manifest contributes.threadHeaderActions[0].priority must be an integer.',
    );
    expect(() => validateStatusBarItemContributions([{ id: 'status', label: 'Status', alignment: 'center' }])).toThrow(
      'Extension manifest contributes.statusBarItems[0].alignment must be one of: left, right.',
    );
    expect(() => validateActivityTreeItemElementContributions([{ id: 'activity', component: 'Activity', slot: 'bad' }])).toThrow(
      'Extension manifest contributes.activityTreeItemElements[0].slot must be one of:',
    );
    expect(() => validateActivityTreeItemStyleContributions([{ id: 'style', provider: 'style', priority: 1.5 }])).toThrow(
      'Extension manifest contributes.activityTreeItemStyles[0].priority must be an integer.',
    );
  });
});
