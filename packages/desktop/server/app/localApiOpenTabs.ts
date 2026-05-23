import type { AppEventTopic } from '../shared/appEvents.js';

export interface DesktopOpenConversationTabsUpdateInput {
  sessionIds?: string[];
  pinnedSessionIds?: string[];
  archivedSessionIds?: string[];
  activeConversationId?: string | null;
  workspacePaths?: string[];
}

export function validateDesktopOpenConversationTabsUpdate(input: DesktopOpenConversationTabsUpdateInput): void {
  const { sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId, workspacePaths } = input;

  if (sessionIds !== undefined && !Array.isArray(sessionIds)) {
    throw new Error('sessionIds must be an array when provided');
  }

  if (pinnedSessionIds !== undefined && !Array.isArray(pinnedSessionIds)) {
    throw new Error('pinnedSessionIds must be an array when provided');
  }

  if (archivedSessionIds !== undefined && !Array.isArray(archivedSessionIds)) {
    throw new Error('archivedSessionIds must be an array when provided');
  }

  if (activeConversationId !== undefined && activeConversationId !== null && typeof activeConversationId !== 'string') {
    throw new Error('activeConversationId must be a string or null when provided');
  }

  if (workspacePaths !== undefined && !Array.isArray(workspacePaths)) {
    throw new Error('workspacePaths must be an array when provided');
  }

  if (
    sessionIds === undefined &&
    pinnedSessionIds === undefined &&
    archivedSessionIds === undefined &&
    activeConversationId === undefined &&
    workspacePaths === undefined
  ) {
    throw new Error('sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId, or workspacePaths required');
  }
}

export function desktopOpenConversationTabsInvalidationTopics(input: DesktopOpenConversationTabsUpdateInput): AppEventTopic[] {
  const topics: AppEventTopic[] = [];
  if (
    input.sessionIds !== undefined ||
    input.pinnedSessionIds !== undefined ||
    input.archivedSessionIds !== undefined ||
    input.activeConversationId !== undefined
  ) {
    topics.push('sessions');
  }
  if (input.workspacePaths !== undefined) {
    topics.push('workspace');
  }
  return topics;
}
