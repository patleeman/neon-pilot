import type { AppEventTopic } from '../shared/appEvents.js';

export interface DesktopConversationWorkspaceUpdateInput {
  sessionIds?: string[];
  pinnedSessionIds?: string[];
  archivedSessionIds?: string[];
  lockedConversationIds?: string[];
  activeConversationId?: string | null;
  workspacePaths?: string[];
  remoteControlledConversationIds?: string[];
  conversationWorkspaceMigrated?: boolean | null;
}

export type DesktopConversationWorkspaceOperationInput =
  | { operation: 'open'; sessionId: string; active?: boolean | null }
  | { operation: 'close'; sessionId: string }
  | { operation: 'pin'; sessionId: string }
  | { operation: 'unpin'; sessionId: string; open?: boolean | null }
  | { operation: 'archive'; sessionId: string; archived?: boolean | null }
  | { operation: 'restore'; sessionId: string }
  | { operation: 'lock'; sessionId: string; locked?: boolean | null }
  | { operation: 'unlock'; sessionId: string }
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
  lockedConversationIds: string[];
  activeConversationId: string | null;
}

export type DesktopConversationPlacement = 'closed' | 'open' | 'pinned' | 'archived';

export function validateDesktopConversationWorkspaceUpdate(input: unknown): asserts input is DesktopConversationWorkspaceUpdateInput {
  if (!input || typeof input !== 'object') {
    throw new Error('conversation workspace update must be an object');
  }
  const update = input as DesktopConversationWorkspaceUpdateInput;
  const {
    sessionIds,
    pinnedSessionIds,
    archivedSessionIds,
    lockedConversationIds,
    activeConversationId,
    workspacePaths,
    remoteControlledConversationIds,
    conversationWorkspaceMigrated,
  } = update;

  if (sessionIds !== undefined && !Array.isArray(sessionIds)) {
    throw new Error('sessionIds must be an array when provided');
  }

  if (pinnedSessionIds !== undefined && !Array.isArray(pinnedSessionIds)) {
    throw new Error('pinnedSessionIds must be an array when provided');
  }

  if (archivedSessionIds !== undefined && !Array.isArray(archivedSessionIds)) {
    throw new Error('archivedSessionIds must be an array when provided');
  }

  if (lockedConversationIds !== undefined && !Array.isArray(lockedConversationIds)) {
    throw new Error('lockedConversationIds must be an array when provided');
  }

  if (activeConversationId !== undefined && activeConversationId !== null && typeof activeConversationId !== 'string') {
    throw new Error('activeConversationId must be a string or null when provided');
  }

  if (workspacePaths !== undefined && !Array.isArray(workspacePaths)) {
    throw new Error('workspacePaths must be an array when provided');
  }

  if (remoteControlledConversationIds !== undefined && !Array.isArray(remoteControlledConversationIds)) {
    throw new Error('remoteControlledConversationIds must be an array when provided');
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
    lockedConversationIds === undefined &&
    activeConversationId === undefined &&
    workspacePaths === undefined &&
    remoteControlledConversationIds === undefined &&
    conversationWorkspaceMigrated === undefined
  ) {
    throw new Error(
      'sessionIds, pinnedSessionIds, archivedSessionIds, lockedConversationIds, activeConversationId, workspacePaths, remoteControlledConversationIds, or conversationWorkspaceMigrated required',
    );
  }
}

export function desktopConversationWorkspaceInvalidationTopics(input: DesktopConversationWorkspaceUpdateInput): AppEventTopic[] {
  const topics: AppEventTopic[] = [];
  if (
    input.sessionIds !== undefined ||
    input.pinnedSessionIds !== undefined ||
    input.archivedSessionIds !== undefined ||
    input.lockedConversationIds !== undefined ||
    input.activeConversationId !== undefined ||
    input.remoteControlledConversationIds !== undefined
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
  lockedConversationIds?: Iterable<unknown>;
  activeConversationId?: unknown;
}): DesktopConversationWorkspaceLayout {
  const placements = buildDesktopConversationPlacements(input);
  const pinnedSessionIds = normalizeSessionIds(input.pinnedSessionIds ?? []).filter((id) => placements.get(id) === 'pinned');
  const sessionIds = normalizeSessionIds(input.sessionIds ?? []).filter((id) => placements.get(id) === 'open');
  const workspaceIdSet = new Set([...sessionIds, ...pinnedSessionIds]);
  const archivedSessionIds = normalizeSessionIds(input.archivedSessionIds ?? []).filter((id) => placements.get(id) === 'archived');
  const activeConversationId = normalizeSessionId(input.activeConversationId);
  return {
    sessionIds,
    pinnedSessionIds,
    archivedSessionIds,
    lockedConversationIds: normalizeSessionIds(input.lockedConversationIds ?? []),
    activeConversationId: activeConversationId && workspaceIdSet.has(activeConversationId) ? activeConversationId : null,
  };
}

export function buildDesktopConversationPlacements(input: {
  sessionIds?: Iterable<unknown>;
  pinnedSessionIds?: Iterable<unknown>;
  archivedSessionIds?: Iterable<unknown>;
}): Map<string, DesktopConversationPlacement> {
  const placements = new Map<string, DesktopConversationPlacement>();
  for (const id of normalizeSessionIds(input.archivedSessionIds ?? [])) {
    placements.set(id, 'archived');
  }
  for (const id of normalizeSessionIds(input.sessionIds ?? [])) {
    placements.set(id, 'open');
  }
  for (const id of normalizeSessionIds(input.pinnedSessionIds ?? [])) {
    placements.set(id, 'pinned');
  }
  return placements;
}

export function projectDesktopConversationPlacements(
  layout: DesktopConversationWorkspaceLayout,
): Record<string, DesktopConversationPlacement> {
  return Object.fromEntries(buildDesktopConversationPlacements(layout));
}

export function readDesktopConversationPlacement(
  layout: DesktopConversationWorkspaceLayout,
  conversationId: string | null | undefined,
): DesktopConversationPlacement {
  const normalizedConversationId = normalizeSessionId(conversationId);
  if (!normalizedConversationId) {
    return 'closed';
  }
  return buildDesktopConversationPlacements(layout).get(normalizedConversationId) ?? 'closed';
}

function listWorkspaceSessionIds(layout: DesktopConversationWorkspaceLayout): string[] {
  return [...layout.pinnedSessionIds, ...layout.sessionIds];
}

export function filterDesktopConversationWorkspaceLayoutBySessionIds(
  layout: DesktopConversationWorkspaceLayout,
  sessionIds: ReadonlySet<string>,
): DesktopConversationWorkspaceLayout {
  const pinnedSessionIds = layout.pinnedSessionIds.filter((id) => sessionIds.has(id));
  const pinnedIdSet = new Set(pinnedSessionIds);
  const openSessionIds = layout.sessionIds.filter((id) => sessionIds.has(id) && !pinnedIdSet.has(id));
  const workspaceIdSet = new Set([...pinnedSessionIds, ...openSessionIds]);
  const archivedSessionIds = layout.archivedSessionIds.filter((id) => sessionIds.has(id) && !workspaceIdSet.has(id));
  const knownLayoutIds = new Set([...workspaceIdSet, ...archivedSessionIds]);
  return normalizeDesktopConversationWorkspaceLayout({
    sessionIds: openSessionIds,
    pinnedSessionIds,
    archivedSessionIds,
    lockedConversationIds: layout.lockedConversationIds.filter((id) => knownLayoutIds.has(id)),
    activeConversationId:
      layout.activeConversationId && workspaceIdSet.has(layout.activeConversationId) ? layout.activeConversationId : null,
  });
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
    lockedConversationIds: next.lockedConversationIds,
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
    lockedConversationIds: layout.lockedConversationIds,
    activeConversationId: layout.activeConversationId,
  });
}

export function applyDesktopConversationWorkspaceOperation(
  current: DesktopConversationWorkspaceLayout,
  input: DesktopConversationWorkspaceOperationInput,
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
        lockedConversationIds: layout.lockedConversationIds,
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
          lockedConversationIds: layout.lockedConversationIds,
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
          lockedConversationIds: layout.lockedConversationIds,
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
        lockedConversationIds: layout.lockedConversationIds,
        activeConversationId: layout.activeConversationId,
      });
    }
    case 'restore':
      if (!sessionId) return layout;
      return applyDesktopConversationWorkspaceOperation(layout, { operation: 'archive', sessionId, archived: false });
    case 'lock': {
      if (!sessionId) return layout;
      const locked = input.locked ?? true;
      const lockedWithoutSession = layout.lockedConversationIds.filter((id) => id !== sessionId);
      return normalizeDesktopConversationWorkspaceLayout({
        ...layout,
        lockedConversationIds: locked ? [...lockedWithoutSession, sessionId] : lockedWithoutSession,
      });
    }
    case 'unlock':
      if (!sessionId) return layout;
      return applyDesktopConversationWorkspaceOperation(layout, { operation: 'lock', sessionId, locked: false });
    case 'setActive':
      return normalizeDesktopConversationWorkspaceLayout({
        ...layout,
        activeConversationId: input.sessionId ?? null,
      });
    case 'move':
      return moveConversationToSection(layout, sessionId, input.targetSection, input.targetSessionId, input.position ?? 'after');
  }
}

export function validateDesktopConversationWorkspaceOperation(input: unknown): asserts input is DesktopConversationWorkspaceOperationInput {
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
    operation !== 'lock' &&
    operation !== 'unlock' &&
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
