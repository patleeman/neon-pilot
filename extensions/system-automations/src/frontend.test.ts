import { describe, expect, it } from 'vitest';

import { ownerThreadHint, shouldOpenNewAutomationFromSearch } from './frontend';

describe('system-automations frontend helpers', () => {
  it('opens the new automation dialog from supported search params', () => {
    expect(shouldOpenNewAutomationFromSearch('?action=new')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('new=1')).toBe(true);
    expect(shouldOpenNewAutomationFromSearch('?action=edit')).toBe(false);
  });

  it('keeps owner thread hints free of local filesystem paths', () => {
    const hint = ownerThreadHint({ cwd: '/Users/patrick/workingdir/neon-pilot' });

    expect(hint).toBe('Uses the owner thread working directory.');
    expect(hint).not.toContain('/Users/');
  });
});
