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
  return buildWorkspacePickerPaths({
    currentCwd: input.draftCwdValue,
    savedWorkspacePaths: input.savedWorkspacePaths,
  });
}

export function buildWorkspacePickerPaths(input: {
  currentCwd: string | null | undefined;
  pinnedWorkspacePaths?: readonly string[] | null;
  savedWorkspacePaths?: readonly string[] | null;
  openWorkspacePaths?: readonly string[] | null;
}): string[] {
  return normalizeWorkspacePaths([
    input.currentCwd,
    ...(input.pinnedWorkspacePaths ?? []),
    ...(input.savedWorkspacePaths ?? []),
    ...(input.openWorkspacePaths ?? []),
  ]);
}
