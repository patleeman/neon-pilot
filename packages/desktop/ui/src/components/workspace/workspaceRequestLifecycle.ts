export interface WorkspaceDirectoryRequestLifecycle {
  generation: number;
  latestRequestIds: Map<string, number>;
}

export function createWorkspaceDirectoryRequestLifecycle(): WorkspaceDirectoryRequestLifecycle {
  return { generation: 0, latestRequestIds: new Map() };
}

export function resetWorkspaceDirectoryRequestLifecycle(lifecycle: WorkspaceDirectoryRequestLifecycle): void {
  lifecycle.generation += 1;
  lifecycle.latestRequestIds.clear();
}

export function beginWorkspaceDirectoryRequest(
  lifecycle: WorkspaceDirectoryRequestLifecycle,
  path: string,
): {
  generation: number;
  path: string;
  requestId: number;
} {
  const requestId = (lifecycle.latestRequestIds.get(path) ?? 0) + 1;
  lifecycle.latestRequestIds.set(path, requestId);
  return { generation: lifecycle.generation, path, requestId };
}

export function invalidateWorkspaceDirectoryRequest(lifecycle: WorkspaceDirectoryRequestLifecycle, path: string): void {
  lifecycle.latestRequestIds.set(path, (lifecycle.latestRequestIds.get(path) ?? 0) + 1);
}

export function isWorkspaceDirectoryRequestCurrent(
  lifecycle: WorkspaceDirectoryRequestLifecycle,
  request: { generation: number; path: string; requestId: number },
): boolean {
  return lifecycle.generation === request.generation && lifecycle.latestRequestIds.get(request.path) === request.requestId;
}
