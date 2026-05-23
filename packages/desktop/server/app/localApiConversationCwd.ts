import { existsSync, statSync } from 'node:fs';

export function resolveDesktopConversationNextCwd(input: {
  cwd?: string | null;
  workspaceCwd?: string | null;
  currentCwd: string;
  runtimeScope: string;
  resolveNeutralChatCwd: (profile: string) => string;
  resolveRequestedCwd: (cwd: string | null | undefined, baseDir?: string) => string | undefined;
}): { nextCwd: string; nextWorkspaceCwd: string | null; movingToNeutralChats: boolean } {
  const movingToNeutralChats = input.workspaceCwd === null;
  const nextCwd = movingToNeutralChats
    ? input.resolveNeutralChatCwd(input.runtimeScope)
    : input.resolveRequestedCwd(input.cwd, input.currentCwd);
  if (!nextCwd) {
    throw new Error('cwd required');
  }
  return { nextCwd, nextWorkspaceCwd: movingToNeutralChats ? null : nextCwd, movingToNeutralChats };
}

export function assertDesktopConversationCwdDirectory(cwd: string): void {
  if (!existsSync(cwd)) {
    throw new Error(`Directory does not exist: ${cwd}`);
  }

  if (!statSync(cwd).isDirectory()) {
    throw new Error(`Not a directory: ${cwd}`);
  }
}
