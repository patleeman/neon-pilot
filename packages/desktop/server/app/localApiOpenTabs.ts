import type { AppEventTopic } from '../shared/appEvents.js';

export interface DesktopOpenConversationTabsUpdateInput {
  sessionIds?: string[];
  pinnedSessionIds?: string[];
  archivedSessionIds?: string[];
  activeConversationId?: string | null;
  workspacePaths?: string[];
  conversationWorkspaceMigrated?: boolean | null;
}

export type DesktopOpenConversationOperationInput =
  | { operation: 'open'; sessionId: string; active?: boolean | null }
  | { operation: 'close'; sessionId: string }
  | { operation: 'pin'; sessionId: string }
  | { operation: 'unpin'; sessionId: string; open?: boolean | null }
  | { operation: 'archive'; sessionId: string; archived?: boolean | null }
  | { operation: 'restore'; sessionId: string }
  | { operation: 'setActive'; sessionId?: string | null }
  | {
      operation: 'move';
      sessionId: string;
      targetSection: 'open' | 'pinned';
      targetSessionId?: string | null;
      position?: 'before' | 'after' | null;
    };

export interface DesktopConversationWorkspaceLayout {
  sessionIds: string[];
  pinnedSessionIds: string[];
  archivedSessionIds: string[];
  activeConversationId: string | null;
}

export function validateDesktopOpenConversationTabsUpdate(input: unknown): asserts input is DesktopOpenConversationTabsUpdateInput {
  if (!input || typeof input !== 'object') {
    throw new Error('open conversation tabs update must be an object');
  }
  const update = input as DesktopOpenConversationTabsUpdateInput;
  const { sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId, workspacePaths, conversationWorkspaceMigrated } = update;

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
    conversationWorkspaceMigrated !== undefined &&
    conversationWorkspaceMigrated !== null &&
    typeof conversationWorkspaceMigrated !== 'boolean'
  ) {
    throw new Error('conversationWorkspaceMigrated must be a boolean when provided');
  }

  if (
    sessionIds === undefined &&
    pinnedSessionIds === undefined &&
    archivedSessionIds === undefined &&
    activeConversationId === undefined &&
    workspacePaths === undefined &&
    conversationWorkspaceMigrated === undefined
  ) {
    throw new Error(
      'sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId, workspacePaths, or conversationWorkspaceMigrated required',
    );
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

function normalizeSessionId(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.startsWith('pending-') ? '' : normalized;
}

function normalizeSessionIds(values: Iterable<unknown>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeSessionId(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

export function normalizeDesktopConversationWorkspaceLayout(input: {
  sessionIds?: Iterable<unknown>;
  pinnedSessionIds?: Iterable<unknown>;
  archivedSessionIds?: Iterable<unknown>;
  activeConversationId?: unknown;
}): DesktopConversationWorkspaceLayout {
  const pinnedSessionIds = normalizeSessionIds(input.pinnedSessionIds ?? []);
  const pinnedIdSet = new Set(pinnedSessionIds);
  const sessionIds = normalizeSessionIds(input.sessionIds ?? []).filter((id) => !pinnedIdSet.has(id));
  const workspaceIdSet = new Set([...sessionIds, ...pinnedSessionIds]);
  const archivedSessionIds = normalizeSessionIds(input.archivedSessionIds ?? []).filter((id) => !workspaceIdSet.has(id));
  const activeConversationId = normalizeSessionId(input.activeConversationId);
  return {
    sessionIds,
    pinnedSessionIds,
    archivedSessionIds,
    activeConversationId: activeConversationId && workspaceIdSet.has(activeConversationId) ? activeConversationId : null,
  };
}

function listWorkspaceSessionIds(layout: DesktopConversationWorkspaceLayout): string[] {
  return [...layout.pinnedSessionIds, ...layout.sessionIds];
}

function applyArchiveTransitions(
  current: DesktopConversationWorkspaceLayout,
  next: DesktopConversationWorkspaceLayout,
): DesktopConversationWorkspaceLayout {
  const currentWorkspaceIdSet = new Set(listWorkspaceSessionIds(current));
  const nextWorkspaceIdSet = new Set(listWorkspaceSessionIds(next));
  const archivedSessionIds = new Set(next.archivedSessionIds);

  for (const sessionId of nextWorkspaceIdSet) {
    archivedSessionIds.delete(sessionId);
  }
  for (const sessionId of currentWorkspaceIdSet) {
    if (!nextWorkspaceIdSet.has(sessionId)) {
      archivedSessionIds.add(sessionId);
    }
  }

  return normalizeDesktopConversationWorkspaceLayout({
    sessionIds: next.sessionIds,
    pinnedSessionIds: next.pinnedSessionIds,
    archivedSessionIds,
    activeConversationId: next.activeConversationId,
  });
}

function moveConversationToSection(
  layout: DesktopConversationWorkspaceLayout,
  sessionId: string,
  targetSection: 'open' | 'pinned',
  targetSessionId?: string | null,
  position: 'before' | 'after' = 'after',
): DesktopConversationWorkspaceLayout {
  const draggedId = normalizeSessionId(sessionId);
  if (!draggedId) {
    return layout;
  }

  const nextSessionIds = layout.sessionIds.filter((id) => id !== draggedId);
  const nextPinnedSessionIds = layout.pinnedSessionIds.filter((id) => id !== draggedId);
  const targetIds = targetSection === 'open' ? nextSessionIds : nextPinnedSessionIds;
  const normalizedTargetId = normalizeSessionId(targetSessionId);
  const targetIndex = normalizedTargetId ? targetIds.indexOf(normalizedTargetId) : -1;

  if (targetIndex === -1) {
    targetIds.push(draggedId);
  } else {
    targetIds.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, draggedId);
  }

  return normalizeDesktopConversationWorkspaceLayout({
    sessionIds: nextSessionIds,
    pinnedSessionIds: nextPinnedSessionIds,
    archivedSessionIds: layout.archivedSessionIds,
    activeConversationId: layout.activeConversationId,
  });
}

export function applyDesktopOpenConversationOperation(
  current: DesktopConversationWorkspaceLayout,
  input: DesktopOpenConversationOperationInput,
): DesktopConversationWorkspaceLayout {
  const layout = normalizeDesktopConversationWorkspaceLayout(current);
  const sessionId = 'sessionId' in input ? normalizeSessionId(input.sessionId) : '';

  switch (input.operation) {
    case 'open': {
      if (!sessionId || layout.pinnedSessionIds.includes(sessionId) || layout.sessionIds.includes(sessionId)) return layout;
      return normalizeDesktopConversationWorkspaceLayout({
        ...layout,
        sessionIds: [...layout.sessionIds, sessionId],
        archivedSessionIds: layout.archivedSessionIds.filter((id) => id !== sessionId),
        activeConversationId: input.active === false ? layout.activeConversationId : sessionId,
      });
    }
    case 'close':
      if (!sessionId || !layout.sessionIds.includes(sessionId)) return layout;
      return applyArchiveTransitions(
        layout,
        normalizeDesktopConversationWorkspaceLayout({
          ...layout,
          sessionIds: layout.sessionIds.filter((id) => id !== sessionId),
        }),
      );
    case 'pin': {
      if (!sessionId) return layout;
      const firstPinnedSessionId = layout.pinnedSessionIds.find((id) => id !== sessionId) ?? null;
      return moveConversationToSection(layout, sessionId, 'pinned', firstPinnedSessionId, 'before');
    }
    case 'unpin': {
      if (!sessionId || !layout.pinnedSessionIds.includes(sessionId)) return layout;
      const nextPinnedSessionIds = layout.pinnedSessionIds.filter((id) => id !== sessionId);
      const nextSessionIds =
        input.open === false || layout.sessionIds.includes(sessionId) ? layout.sessionIds : [...layout.sessionIds, sessionId];
      return applyArchiveTransitions(
        layout,
        normalizeDesktopConversationWorkspaceLayout({
          ...layout,
          sessionIds: nextSessionIds,
          pinnedSessionIds: nextPinnedSessionIds,
        }),
      );
    }
    case 'archive': {
      if (!sessionId) return layout;
      const archived = input.archived ?? true;
      const nextPinnedSessionIds = layout.pinnedSessionIds.filter((id) => id !== sessionId);
      const openWithoutSession = layout.sessionIds.filter((id) => id !== sessionId);
      const archivedWithoutSession = layout.archivedSessionIds.filter((id) => id !== sessionId);
      return normalizeDesktopConversationWorkspaceLayout({
        sessionIds: archived ? openWithoutSession : [...openWithoutSession, sessionId],
        pinnedSessionIds: nextPinnedSessionIds,
        archivedSessionIds: archived ? [...archivedWithoutSession, sessionId] : archivedWithoutSession,
        activeConversationId: layout.activeConversationId,
      });
    }
    case 'restore':
      if (!sessionId) return layout;
      return applyDesktopOpenConversationOperation(layout, { operation: 'archive', sessionId, archived: false });
    case 'setActive':
      return normalizeDesktopConversationWorkspaceLayout({
        ...layout,
        activeConversationId: input.sessionId ?? null,
      });
    case 'move':
      return moveConversationToSection(layout, sessionId, input.targetSection, input.targetSessionId, input.position ?? 'after');
  }
}

export function validateDesktopOpenConversationOperation(input: unknown): asserts input is DesktopOpenConversationOperationInput {
  if (!input || typeof input !== 'object') {
    throw new Error('open conversation operation must be an object');
  }
  const operation = (input as { operation?: unknown }).operation;
  if (
    operation !== 'open' &&
    operation !== 'close' &&
    operation !== 'pin' &&
    operation !== 'unpin' &&
    operation !== 'archive' &&
    operation !== 'restore' &&
    operation !== 'setActive' &&
    operation !== 'move'
  ) {
    throw new Error('operation must be a supported conversation workspace operation');
  }
  if (operation !== 'setActive' && !normalizeSessionId((input as { sessionId?: unknown }).sessionId)) {
    throw new Error('sessionId is required');
  }
  if (operation === 'move') {
    const targetSection = (input as { targetSection?: unknown }).targetSection;
    if (targetSection !== 'open' && targetSection !== 'pinned') {
      throw new Error('targetSection must be open or pinned');
    }
  }
}
