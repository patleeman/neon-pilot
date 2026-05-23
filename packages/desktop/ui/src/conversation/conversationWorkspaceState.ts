import { normalizeWorkspacePaths } from '../local/savedWorkspacePaths';

export function resolveConversationCurrentCwd(input: {
  draft: boolean;
  draftCwdValue: string;
  liveSessionCwd: string | null | undefined;
  sessionCwd: string | null | undefined;
}): string | null {
  return input.draft ? input.draftCwdValue || null : (input.liveSessionCwd ?? input.sessionCwd ?? null);
}

export function buildAvailableDraftWorkspacePaths(input: { draftCwdValue: string; savedWorkspacePaths: string[] }): string[] {
  return normalizeWorkspacePaths(input.draftCwdValue ? [input.draftCwdValue, ...input.savedWorkspacePaths] : input.savedWorkspacePaths);
}
