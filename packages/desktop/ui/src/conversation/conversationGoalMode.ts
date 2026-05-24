export function createDraftMissionTask(description: string) {
  return { id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 3)}`, description, status: 'pending' as const };
}

export function buildMissionAutoModeInputFromDraft(
  draftMission: { goal?: string },
  currentState: { mission?: { tasks?: Array<{ id: string; description: string; status: string }> } },
) {
  return { mode: 'mission' as const, enabled: true, mission: { goal: draftMission.goal ?? '', tasks: currentState.mission?.tasks ?? [] } };
}
