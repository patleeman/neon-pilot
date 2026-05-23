import { describe, expect, it, vi } from 'vitest';

import {
  applyGoalModeToggleAction,
  buildMissionAutoModeInputFromDraft,
  createDraftMissionTask,
  resolveGoalModeToggleAction,
} from './conversationGoalMode';

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

  it('resolves goal mode toggle actions', () => {
    expect(resolveGoalModeToggleAction({ conversationId: 'conv-1', goalEnabled: false, composerText: ' ship it ' })).toEqual({
      kind: 'enable-now',
      conversationId: 'conv-1',
      objective: 'ship it',
    });
    expect(resolveGoalModeToggleAction({ conversationId: 'conv-1', goalEnabled: true, composerText: 'ignored' })).toEqual({
      kind: 'disable-now',
      conversationId: 'conv-1',
    });
    expect(resolveGoalModeToggleAction({ goalEnabled: false, composerText: 'ship it' })).toEqual({ kind: 'enable-pending' });
    expect(resolveGoalModeToggleAction({ goalEnabled: true, composerText: 'ignored' })).toEqual({ kind: 'disable-pending' });
  });

  it('applies goal mode actions', async () => {
    const updates: unknown[] = [];
    const pending: boolean[] = [];
    const updateGoal = vi.fn(async (conversationId: string, input: { objective?: string }) => updates.push({ conversationId, input }));
    const setPending = (value: boolean) => pending.push(value);

    await applyGoalModeToggleAction({ kind: 'enable-now', conversationId: 'conv-1', objective: 'Ship' }, updateGoal, setPending);
    await applyGoalModeToggleAction({ kind: 'disable-now', conversationId: 'conv-1' }, updateGoal, setPending);
    await applyGoalModeToggleAction({ kind: 'enable-pending' }, updateGoal, setPending);

    expect(pending).toEqual([true, false, true]);
    expect(updates).toEqual([
      { conversationId: 'conv-1', input: { objective: 'Ship' } },
      { conversationId: 'conv-1', input: {} },
    ]);
  });
});
