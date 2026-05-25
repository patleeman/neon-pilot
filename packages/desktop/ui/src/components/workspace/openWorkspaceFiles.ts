const WORKSPACE_OPEN_FILES_KEY_PREFIX = 'pa:workspace-open-files:';
export const WORKSPACE_OPEN_FILES_CHANGED_EVENT = 'pa:workspace-open-files-changed';
export const MAX_WORKSPACE_OPEN_FILES = 24;

export function workspaceOpenFilesKey(cwd: string, scope?: string | null): string {
  return `${WORKSPACE_OPEN_FILES_KEY_PREFIX}${scope ? `${scope}:` : ''}${cwd}`;
}

export function readWorkspaceOpenFiles(cwd: string | null, scope?: string | null): string[] {
  if (!cwd) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(workspaceOpenFilesKey(cwd, scope)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_WORKSPACE_OPEN_FILES)
      : [];
  } catch {
    return [];
  }
}

export function writeWorkspaceOpenFiles(cwd: string | null, paths: readonly string[], scope?: string | null): void {
  if (!cwd) return;
  const nextPaths = [...new Set(paths)].slice(0, MAX_WORKSPACE_OPEN_FILES);
  try {
    localStorage.setItem(workspaceOpenFilesKey(cwd, scope), JSON.stringify(nextPaths));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(WORKSPACE_OPEN_FILES_CHANGED_EVENT, { detail: { cwd, paths: nextPaths } }));
}

export function addWorkspaceOpenFile(paths: readonly string[], path: string): string[] {
  if (paths.includes(path)) {
    return [...paths];
  }
  return [path, ...paths].slice(0, MAX_WORKSPACE_OPEN_FILES);
}

export function removeWorkspaceOpenFile(paths: readonly string[], path: string): string[] {
  return paths.filter((value) => value !== path);
}
