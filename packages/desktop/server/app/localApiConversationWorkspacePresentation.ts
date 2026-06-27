import { type DesktopConversationPlacement, projectDesktopConversationPlacements } from './localApiConversationWorkspace.js';

export interface SavedConversationWorkspaceLike {
  openConversationIds: string[];
  pinnedConversationIds: string[];
  archivedConversationIds: string[];
  lockedConversationIds: string[];
  activeConversationId?: string | null;
  workspacePaths: string[];
  remoteControlledConversationIds: string[];
  conversationWorkspaceRevision: number;
  conversationWorkspaceUpdatedAt: string | null;
  conversationWorkspaceMigratedAt: string | null;
}

export function buildDesktopConversationWorkspaceResponse(saved: SavedConversationWorkspaceLike): {
  sessionIds: string[];
  pinnedSessionIds: string[];
  archivedSessionIds: string[];
  lockedConversationIds: string[];
  conversationPlacements: Record<string, DesktopConversationPlacement>;
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
    lockedConversationIds: saved.lockedConversationIds,
    conversationPlacements: projectDesktopConversationPlacements({
      sessionIds: saved.openConversationIds,
      pinnedSessionIds: saved.pinnedConversationIds,
      archivedSessionIds: saved.archivedConversationIds,
      lockedConversationIds: saved.lockedConversationIds,
      activeConversationId: saved.activeConversationId ?? null,
    }),
    activeConversationId: saved.activeConversationId ?? null,
    workspacePaths: saved.workspacePaths,
    remoteControlledConversationIds: saved.remoteControlledConversationIds,
    conversationWorkspaceRevision: saved.conversationWorkspaceRevision,
    conversationWorkspaceUpdatedAt: saved.conversationWorkspaceUpdatedAt,
    conversationWorkspaceMigratedAt: saved.conversationWorkspaceMigratedAt,
  };
}
