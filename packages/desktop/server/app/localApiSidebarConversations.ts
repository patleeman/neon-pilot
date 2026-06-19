import type { SessionMeta } from '../conversations/sessions.js';
import type { SavedUiPreferences } from '../ui/uiPreferences.js';
import { buildDesktopConversationWorkspaceResponse } from './localApiConversationWorkspacePresentation.js';

export interface DesktopSidebarConversationSnapshot {
  sessionIds: string[];
  pinnedSessionIds: string[];
  archivedSessionIds: string[];
  activeConversationId: string | null;
  workspacePaths: string[];
  remoteControlledConversationIds: string[];
  conversationWorkspaceRevision: number;
  conversationWorkspaceUpdatedAt: string | null;
  conversationWorkspaceMigratedAt: string | null;
  sessions: SessionMeta[];
}

function filterKnownIds(ids: readonly string[], knownSessionIds: Set<string>): string[] {
  return ids.filter((id) => knownSessionIds.has(id));
}

export function buildDesktopSidebarConversationSnapshot(input: {
  saved: SavedUiPreferences;
  sessions: SessionMeta[];
}): DesktopSidebarConversationSnapshot {
  const layout = buildDesktopConversationWorkspaceResponse(input.saved);
  const knownSessionIds = new Set(input.sessions.map((session) => session.id));
  const pinnedSessionIds = filterKnownIds(layout.pinnedSessionIds, knownSessionIds);
  const pinnedIdSet = new Set(pinnedSessionIds);
  const sessionIds = filterKnownIds(layout.sessionIds, knownSessionIds).filter((id) => !pinnedIdSet.has(id));
  const workspaceIdSet = new Set([...pinnedSessionIds, ...sessionIds]);
  const archivedSessionIds = filterKnownIds(layout.archivedSessionIds, knownSessionIds).filter((id) => !workspaceIdSet.has(id));
  const activeConversationId =
    layout.activeConversationId && workspaceIdSet.has(layout.activeConversationId) ? layout.activeConversationId : null;

  return {
    ...layout,
    sessionIds,
    pinnedSessionIds,
    archivedSessionIds,
    activeConversationId,
    sessions: input.sessions,
  };
}
