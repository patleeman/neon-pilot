export function createDraftMissionTask(description: string) {
  return { id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 3)}`, description, status: 'pending' as const };
}

export function buildMissionAutoModeInputFromDraft(
  draftMission: { goal?: string },
  currentState: { mission?: { tasks?: Array<{ id: string; description: string; status: string }> } },
) {
  return { mode: 'mission' as const, enabled: true, mission: { goal: draftMission.goal ?? '', tasks: currentState.mission?.tasks ?? [] } };
}

export type GoalModeToggleAction =
  | { kind: 'enable-now'; conversationId: string; objective: string }
  | { kind: 'enable-pending' }
  | { kind: 'disable-now'; conversationId: string }
  | { kind: 'disable-pending' };

export function resolveGoalModeToggleAction(input: {
  conversationId?: string;
  goalEnabled: boolean;
  composerText: string;
}): GoalModeToggleAction {
  if (input.goalEnabled) {
    return input.conversationId ? { kind: 'disable-now', conversationId: input.conversationId } : { kind: 'disable-pending' };
  }

  const objective = input.composerText.trim();
  if (input.conversationId && objective) {
    return { kind: 'enable-now', conversationId: input.conversationId, objective };
  }

  return { kind: 'enable-pending' };
}

export async function applyGoalModeToggleAction(
  action: GoalModeToggleAction,
  updateGoal: (conversationId: string, input: { objective?: string }) => Promise<unknown>,
  setPending: (pending: boolean) => void,
): Promise<void> {
  if (action.kind === 'enable-now') {
    setPending(true);
    try {
      await updateGoal(action.conversationId, { objective: action.objective });
    } catch (error) {
      setPending(false);
      throw error;
    }
    return;
  }

  if (action.kind === 'enable-pending') {
    setPending(true);
    return;
  }

  setPending(false);
  if (action.kind === 'disable-now') {
    await updateGoal(action.conversationId, {});
  }
}
