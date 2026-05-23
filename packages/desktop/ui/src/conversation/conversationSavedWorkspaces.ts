import { normalizeWorkspacePaths } from '../local/savedWorkspacePaths';

export function syncSavedWorkspacePathValues(workspacePaths: string[]): string[] {
  return normalizeWorkspacePaths(workspacePaths);
}

export function shouldRefetchSavedWorkspacePaths(draft: boolean): boolean {
  return draft;
}
