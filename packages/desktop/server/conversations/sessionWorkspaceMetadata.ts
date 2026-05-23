import { join, sep } from 'node:path';

export interface LegacyToolWorkspaceMetadata {
  cwd: string;
  workspaceCwd: string;
}

export interface LegacyToolWorkspaceMessageLike {
  role?: string;
  toolName?: string;
  details?: unknown;
}

export function isNeutralChatWorkspaceCwd(input: { cwd: string; runtimeDir: string }): boolean {
  const normalized = input.cwd.trim();
  if (!normalized) {
    return false;
  }

  const chatWorkspacesRoot = join(input.runtimeDir, 'chat-workspaces');
  return normalized === chatWorkspacesRoot || normalized.startsWith(`${chatWorkspacesRoot}${sep}`);
}

export function readLegacyToolWorkspaceMetadata(message: LegacyToolWorkspaceMessageLike): LegacyToolWorkspaceMetadata | null {
  if (message.role !== 'toolResult') {
    return null;
  }
  const toolName = message.toolName;
  if (toolName !== 'change_working_directory' && toolName !== 'conversation') {
    return null;
  }

  const details = message.details;
  if (!details || typeof details !== 'object') {
    return null;
  }

  const data = details as Record<string, unknown>;
  const action = typeof data.action === 'string' ? data.action.trim() : '';
  const queued = data.queued === true;
  const cwd = typeof data.cwd === 'string' && data.cwd.trim().length > 0 ? data.cwd.trim() : '';
  if (action !== 'queue' || !queued || !cwd) {
    return null;
  }

  return { cwd, workspaceCwd: cwd };
}
