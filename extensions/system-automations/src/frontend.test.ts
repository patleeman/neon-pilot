import { describe, expect, it } from 'vitest';

import { automationRowActionMenuPosition, cronMatches, ownerThreadHint, shouldOpenNewAutomationFromSearch } from './frontend';

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

  it('positions row action menus above bottom-edge triggers', () => {
    expect(automationRowActionMenuPosition({ top: 360, right: 780, bottom: 392 }, { width: 800, height: 420 })).toEqual({
      right: 20,
      bottom: 64,
    });

    expect(automationRowActionMenuPosition({ top: 80, right: 780, bottom: 112 }, { width: 800, height: 420 })).toEqual({
      right: 20,
      top: 116,
    });
  });

  it('matches backend cron day-of-month and day-of-week semantics', () => {
    expect(cronMatches('0 9 1 * 1', new Date(2026, 5, 29, 9, 0, 0))).toBe(true);
    expect(cronMatches('0 9 1 * 1', new Date(2026, 6, 1, 9, 0, 0))).toBe(true);
    expect(cronMatches('0 9 1 * 1', new Date(2026, 5, 30, 9, 0, 0))).toBe(false);
  });
});
