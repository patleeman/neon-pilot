import { normalizeWorkspacePaths } from '../local/savedWorkspacePaths';
import type { SessionMeta } from '../shared/types';
import { isNeutralChatCwdPath } from './conversationCwdPresentation';

export function resolveConversationCurrentCwd(input: {
  draft: boolean;
  draftCwdValue: string;
  liveSessionCwd: string | null | undefined;
  sessionCwd: string | null | undefined;
}): string | null {
  return input.draft ? input.draftCwdValue || null : (input.liveSessionCwd ?? input.sessionCwd ?? null);
}

export function buildAvailableDraftWorkspacePaths(input: {
  draftCwdValue: string;
  savedWorkspacePaths: string[];
  sessions?: readonly Pick<SessionMeta, 'cwd' | 'workspaceCwd'>[] | null;
}): string[] {
  const sessionCwds = (input.sessions ?? [])
    .map((s) => getLocalSessionWorkspaceCwd(s))
    .filter((cwd): cwd is string => cwd !== null && cwd.length > 0);
  const allPaths = normalizeWorkspacePaths([
    ...sessionCwds,
    ...(input.draftCwdValue ? [input.draftCwdValue] : []),
    ...input.savedWorkspacePaths,
  ]);
  return allPaths;
}

export function buildActiveConversationWorkspacePaths(input: {
  currentCwd: string | null | undefined;
  sessions?: readonly Pick<SessionMeta, 'cwd' | 'workspaceCwd'>[] | null;
}): string[] {
  const currentWorkspaceCwd = input.currentCwd && !isNeutralChatCwdPath(input.currentCwd) ? input.currentCwd : null;
  const sessionCwds = (input.sessions ?? [])
    .map((s) => getLocalSessionWorkspaceCwd(s))
    .filter((cwd): cwd is string => cwd !== null && cwd.length > 0);
  return normalizeWorkspacePaths([...(currentWorkspaceCwd ? [currentWorkspaceCwd] : []), ...sessionCwds]);
}

function getLocalSessionWorkspaceCwd(session: Pick<SessionMeta, 'cwd' | 'workspaceCwd'>): string | null {
  if (Object.prototype.hasOwnProperty.call(session, 'workspaceCwd')) {
    const workspaceCwd = session.workspaceCwd ?? null;
    return isNeutralChatCwdPath(workspaceCwd) ? null : workspaceCwd;
  }
  return isNeutralChatCwdPath(session.cwd) ? null : (session.cwd ?? null);
}
