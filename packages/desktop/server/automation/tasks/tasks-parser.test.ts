import { describe, expect, it } from 'vitest';

import { cronMatches, parseCronExpression } from './tasks-parser.js';

describe('tasks parser', () => {
  it('rejects unsafe cron step values', () => {
    expect(() => parseCronExpression(`*/${Number.MAX_SAFE_INTEGER + 1} * * * *`)).toThrow(
      `Invalid minute step value: ${Number.MAX_SAFE_INTEGER + 1}`,
    );
  });

  it('matches cron expressions using cron day-of-month/day-of-week semantics', () => {
    const expression = parseCronExpression('0 9 15 * 1');

    // Monday on the 8th -> should match day-of-week
    const monday = new Date(2026, 5, 8, 9, 0, 0, 0);
    expect(cronMatches(expression, monday)).toBe(true);

    // Saturday on the 15th -> should match day-of-month
    const saturdayFifteenth = new Date(2026, 7, 15, 9, 0, 0, 0);
    expect(cronMatches(expression, saturdayFifteenth)).toBe(true);

    // Not Monday and not 15th -> no match
    const saturdayOtherDay = new Date(2026, 7, 22, 9, 0, 0, 0);
    expect(cronMatches(expression, saturdayOtherDay)).toBe(false);
  });
});
