import { describe, expect, it } from 'vitest';

import { GOAL_STATE_CUSTOM_TYPE, normalizeGoalStatus, normalizeTaskStatus, readGoalFromEntries } from './sessionGoalState';

describe('sessionGoalState', () => {
  it('normalizes goal and task statuses', () => {
    expect(normalizeGoalStatus('active')).toBe('active');
    expect(normalizeGoalStatus('weird')).toBe('complete');
    expect(normalizeTaskStatus('blocked')).toBe('blocked');
    expect(normalizeTaskStatus('weird')).toBe('pending');
  });

  it('reads the latest active goal entry and normalizes tasks', () => {
    expect(
      readGoalFromEntries([
        { type: 'custom', customType: GOAL_STATE_CUSTOM_TYPE, data: { objective: 'old', status: 'active' } },
        {
          type: 'custom',
          customType: GOAL_STATE_CUSTOM_TYPE,
          data: {
            objective: ' ship it ',
            status: 'paused',
            tasks: [
              { id: '1', description: 'one', status: 'done' },
              { id: '2', description: 'two', status: 'bad' },
              { id: 3, description: 'bad' },
            ],
            stopReason: 'waiting',
            startedAt: 'then',
            updatedAt: 'now',
          },
        },
      ]),
    ).toEqual({
      objective: ' ship it ',
      status: 'paused',
      tasks: [
        { id: '1', description: 'one', status: 'done' },
        { id: '2', description: 'two', status: 'pending' },
      ],
      stopReason: 'waiting',
      startedAt: 'then',
      updatedAt: 'now',
    });
  });

  it('returns null for complete or invalid goals', () => {
    expect(
      readGoalFromEntries([{ type: 'custom', customType: GOAL_STATE_CUSTOM_TYPE, data: { objective: 'done', status: 'complete' } }]),
    ).toBeNull();
    expect(
      readGoalFromEntries([{ type: 'custom', customType: GOAL_STATE_CUSTOM_TYPE, data: { objective: '   ', status: 'active' } }]),
    ).toBeNull();
    expect(readGoalFromEntries([{ type: 'message', data: { objective: 'ignored', status: 'active' } }])).toBeNull();
  });
});
