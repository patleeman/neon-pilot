export interface SavedOpenConversationTabsLike {
  openConversationIds: string[];
  pinnedConversationIds: string[];
  archivedConversationIds: string[];
  activeConversationId?: string | null;
  workspacePaths: string[];
  remoteControlledConversationIds: string[];
  conversationWorkspaceRevision: number;
  conversationWorkspaceUpdatedAt: string | null;
  conversationWorkspaceMigratedAt: string | null;
}

export function buildDesktopOpenConversationTabsResponse(saved: SavedOpenConversationTabsLike): {
  sessionIds: string[];
  pinnedSessionIds: string[];
  archivedSessionIds: string[];
  activeConversationId: string | null;
  workspacePaths: string[];
  remoteControlledConversationIds: string[];
  conversationWorkspaceRevision: number;
  conversationWorkspaceUpdatedAt: string | null;
  conversationWorkspaceMigratedAt: string | null;
} {
  return {
    sessionIds: saved.openConversationIds,
    pinnedSessionIds: saved.pinnedConversationIds,
    archivedSessionIds: saved.archivedConversationIds,
    activeConversationId: saved.activeConversationId ?? null,
    workspacePaths: saved.workspacePaths,
    remoteControlledConversationIds: saved.remoteControlledConversationIds,
    conversationWorkspaceRevision: saved.conversationWorkspaceRevision,
    conversationWorkspaceUpdatedAt: saved.conversationWorkspaceUpdatedAt,
    conversationWorkspaceMigratedAt: saved.conversationWorkspaceMigratedAt,
  };
}
