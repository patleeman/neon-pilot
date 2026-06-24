import { existsSync, statSync } from 'node:fs';

export class DesktopConversationCwdValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesktopConversationCwdValidationError';
  }
}

function normalizeCwdValidationError(error: unknown): never {
  if (error instanceof DesktopConversationCwdValidationError) {
    throw error;
  }

  if (error instanceof Error) {
    const missingMatch = /^Directory does not exist:\s*(.+)$/i.exec(error.message);
    if (missingMatch?.[1]?.trim()) {
      throw new DesktopConversationCwdValidationError(`Choose an existing folder. ${missingMatch[1].trim()} could not be found.`);
    }

    const fileMatch = /^Not a directory:\s*(.+)$/i.exec(error.message);
    if (fileMatch?.[1]?.trim()) {
      throw new DesktopConversationCwdValidationError(`Choose a folder, not a file. ${fileMatch[1].trim()} is not a folder.`);
    }

    if (/^cwd (?:is )?required\.?$/i.test(error.message.trim())) {
      throw new DesktopConversationCwdValidationError('Choose a working directory.');
    }
  }

  throw error;
}

export function resolveDesktopConversationNextCwd(input: {
  cwd?: string | null;
  workspaceCwd?: string | null;
  currentCwd: string;
  runtimeScope: string;
  resolveNeutralChatCwd: (profile: string) => string;
  resolveRequestedCwd: (cwd: string | null | undefined, baseDir?: string) => string | undefined;
}): { nextCwd: string; nextWorkspaceCwd: string | null; movingToNeutralChats: boolean } {
  const movingToNeutralChats = input.workspaceCwd === null;
  let nextCwd: string | undefined;
  try {
    nextCwd = movingToNeutralChats
      ? input.resolveNeutralChatCwd(input.runtimeScope)
      : input.resolveRequestedCwd(input.cwd, input.currentCwd);
  } catch (error) {
    normalizeCwdValidationError(error);
  }
  if (!nextCwd) {
    throw new DesktopConversationCwdValidationError('Choose a working directory.');
  }
  return { nextCwd, nextWorkspaceCwd: movingToNeutralChats ? null : nextCwd, movingToNeutralChats };
}

export function assertDesktopConversationCwdDirectory(cwd: string): void {
  if (!existsSync(cwd)) {
    throw new DesktopConversationCwdValidationError(`Choose an existing folder. ${cwd} could not be found.`);
  }

  if (!statSync(cwd).isDirectory()) {
    throw new DesktopConversationCwdValidationError(`Choose a folder, not a file. ${cwd} is not a folder.`);
  }
}
