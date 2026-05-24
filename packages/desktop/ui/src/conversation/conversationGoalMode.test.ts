import { describe, expect, it, vi } from 'vitest';

import { buildMissionAutoModeInputFromDraft, createDraftMissionTask } from './conversationGoalMode';

describe('conversationGoalMode', () => {
  it('builds draft mission task and mission auto-mode input', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(createDraftMissionTask('Inspect persistence')).toEqual({
      id: 'user-123-i',
      description: 'Inspect persistence',
      status: 'pending',
    });
    expect(
      buildMissionAutoModeInputFromDraft({ goal: 'Ship' }, { mission: { tasks: [{ id: '1', description: 'Task', status: 'done' }] } }),
    ).toEqual({
      mode: 'mission',
      enabled: true,
      mission: { goal: 'Ship', tasks: [{ id: '1', description: 'Task', status: 'done' }] },
    });
  });
});
