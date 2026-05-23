export function resolveWorkspaceChangeLabels(input: {
  cwd?: string;
  workspaceCwd?: string | null;
  previousCwd?: string;
  previousWorkspaceCwd?: string | null;
}): { previousLabel: string; nextLabel: string } {
  const cwd = input.cwd?.trim();
  const workspaceCwd = input.workspaceCwd === null ? null : input.workspaceCwd?.trim();
  const previousLabel =
    input.previousWorkspaceCwd === null ? 'Chats' : input.previousCwd?.trim() || input.previousWorkspaceCwd?.trim() || 'previous workspace';
  const nextLabel = input.workspaceCwd === null ? 'Chats' : cwd || workspaceCwd || 'new workspace';
  return { previousLabel, nextLabel };
}

export function buildWorkspaceChangeContent(labels: { previousLabel: string; nextLabel: string }): string {
  return `Working directory changed from ${labels.previousLabel} to ${labels.nextLabel}.`;
}
