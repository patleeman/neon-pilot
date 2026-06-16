import { api } from '../client/api';
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  ARCHIVED_SESSION_IDS_STORAGE_KEY,
  OPEN_SESSION_IDS_STORAGE_KEY,
  PINNED_SESSION_IDS_STORAGE_KEY,
} from '../local/localSettings';

export const CONVERSATION_LAYOUT_CHANGED_EVENT = 'pa:conversation-layout-changed';

// Grace period (ms) after a local write during which remote re-syncs are skipped.
// Prevents the race where a server fetch returns stale data before our persist lands.
const LOCAL_WRITE_GRACE_MS = 3000;
let lastLocalWriteAt = 0;

export function isWithinLocalWriteGrace(): boolean {
  return Date.now() - lastLocalWriteAt < LOCAL_WRITE_GRACE_MS;
}

/** Reset the grace timer. Exposed for test isolation. */
export function resetLocalWriteGrace(): void {
  lastLocalWriteAt = 0;
}

export type OpenConversationDropPosition = 'before' | 'after';
export type ConversationShelf = 'open' | 'pinned';

export interface ConversationLayout {
  sessionIds: string[];
  pinnedSessionIds: string[];
  archivedSessionIds: string[];
  activeSessionId: string | null;
}

export interface RemoteConversationLayout extends ConversationLayout {
  workspacePaths: string[];
  remoteControlledConversationIds: string[];
  conversationWorkspaceRevision: number;
  conversationWorkspaceUpdatedAt: string | null;
  conversationWorkspaceMigratedAt: string | null;
}

type ConversationWorkspaceOperation = Parameters<typeof api.updateConversationWorkspace>[0];

interface ConversationLayoutInput {
  sessionIds?: Iterable<unknown>;
  pinnedSessionIds?: Iterable<unknown>;
  archivedSessionIds?: Iterable<unknown>;
  activeSessionId?: unknown;
}

type RemoteConversationLayoutInput = ConversationLayoutInput & {
  activeConversationId?: unknown;
  workspacePaths?: Iterable<unknown>;
  remoteControlledConversationIds?: Iterable<unknown>;
  conversationWorkspaceRevision?: unknown;
  conversationWorkspaceUpdatedAt?: unknown;
  conversationWorkspaceMigratedAt?: unknown;
};

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

function normalizeConversationLayout(input: ConversationLayoutInput): ConversationLayout {
  const pinnedSessionIds = normalizeSessionIds(input.pinnedSessionIds ?? []);
  const pinnedIdSet = new Set(pinnedSessionIds);
  const sessionIds = normalizeSessionIds(input.sessionIds ?? []).filter((id) => !pinnedIdSet.has(id));
  const workspaceIdSet = new Set([...sessionIds, ...pinnedSessionIds]);
  const archivedSessionIds = normalizeSessionIds(input.archivedSessionIds ?? []).filter((id) => !workspaceIdSet.has(id));
  const activeSessionId = normalizeSessionId(input.activeSessionId);

  return {
    sessionIds,
    pinnedSessionIds,
    archivedSessionIds,
    activeSessionId: activeSessionId && workspaceIdSet.has(activeSessionId) ? activeSessionId : null,
  };
}

function mergeConversationLayout(current: ConversationLayout, input: ConversationLayoutInput): ConversationLayout {
  return normalizeConversationLayout({
    sessionIds: input.sessionIds ?? current.sessionIds,
    pinnedSessionIds: input.pinnedSessionIds ?? current.pinnedSessionIds,
    archivedSessionIds: input.archivedSessionIds ?? current.archivedSessionIds,
    activeSessionId: input.activeSessionId !== undefined ? input.activeSessionId : current.activeSessionId,
  });
}

function listWorkspaceSessionIds(layout: ConversationLayout): string[] {
  return [...layout.pinnedSessionIds, ...layout.sessionIds];
}

function applyArchiveTransitions(current: ConversationLayout, next: ConversationLayout): ConversationLayout {
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

  return normalizeConversationLayout({
    sessionIds: next.sessionIds,
    pinnedSessionIds: next.pinnedSessionIds,
    archivedSessionIds: [...archivedSessionIds],
    activeSessionId: next.activeSessionId,
  });
}

function sameSessionIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}

function sameConversationLayout(left: ConversationLayout, right: ConversationLayout): boolean {
  return (
    sameSessionIds(left.sessionIds, right.sessionIds) &&
    sameSessionIds(left.pinnedSessionIds, right.pinnedSessionIds) &&
    sameSessionIds(left.archivedSessionIds, right.archivedSessionIds) &&
    left.activeSessionId === right.activeSessionId
  );
}

let remoteLayoutPromise: Promise<RemoteConversationLayout> | null = null;
let remoteLayoutCache: RemoteConversationLayout | null = null;
let remoteLayoutCacheAt = 0;
let conversationLayoutProjection: ConversationLayout | null = null;

function normalizeRemoteConversationLayout(input: RemoteConversationLayoutInput): RemoteConversationLayout {
  const layout = normalizeConversationLayout({
    sessionIds: input.sessionIds,
    pinnedSessionIds: input.pinnedSessionIds,
    archivedSessionIds: input.archivedSessionIds,
    activeSessionId: input.activeSessionId ?? input.activeConversationId,
  });
  return {
    ...layout,
    workspacePaths: normalizeSessionIds(input.workspacePaths ?? []),
    remoteControlledConversationIds: normalizeSessionIds(input.remoteControlledConversationIds ?? []),
    conversationWorkspaceRevision:
      typeof input.conversationWorkspaceRevision === 'number' && Number.isFinite(input.conversationWorkspaceRevision)
        ? Math.max(0, Math.floor(input.conversationWorkspaceRevision))
        : 0,
    conversationWorkspaceUpdatedAt: typeof input.conversationWorkspaceUpdatedAt === 'string' ? input.conversationWorkspaceUpdatedAt : null,
    conversationWorkspaceMigratedAt: typeof input.conversationWorkspaceMigratedAt === 'string' ? input.conversationWorkspaceMigratedAt : null,
  };
}

function isRemoteConversationLayoutPayload(value: unknown): value is Parameters<typeof normalizeRemoteConversationLayout>[0] {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    sessionIds?: unknown;
    pinnedSessionIds?: unknown;
    archivedSessionIds?: unknown;
  };
  return Array.isArray(candidate.sessionIds) && Array.isArray(candidate.pinnedSessionIds) && Array.isArray(candidate.archivedSessionIds);
}

export function resetRemoteConversationLayoutCache(): void {
  remoteLayoutPromise = null;
  remoteLayoutCache = null;
  remoteLayoutCacheAt = 0;
  conversationLayoutProjection = null;
}

function hasConversationWorkspaceIds(layout: Pick<ConversationLayout, 'sessionIds' | 'pinnedSessionIds' | 'archivedSessionIds'>): boolean {
  return layout.sessionIds.length > 0 || layout.pinnedSessionIds.length > 0 || layout.archivedSessionIds.length > 0;
}

export async function fetchRemoteConversationLayout(
  options: { refresh?: boolean; reason?: string } = {},
): Promise<RemoteConversationLayout> {
  if (!options.refresh && remoteLayoutCache) {
    return remoteLayoutCache;
  }
  if (!options.refresh && remoteLayoutPromise) {
    return remoteLayoutPromise;
  }
  if (options.refresh && isWithinLocalWriteGrace() && remoteLayoutCache) {
    return {
      ...readConversationLayout(),
      workspacePaths: remoteLayoutCache.workspacePaths,
      remoteControlledConversationIds: remoteLayoutCache.remoteControlledConversationIds,
      conversationWorkspaceRevision: remoteLayoutCache.conversationWorkspaceRevision,
      conversationWorkspaceUpdatedAt: remoteLayoutCache.conversationWorkspaceUpdatedAt,
      conversationWorkspaceMigratedAt: remoteLayoutCache.conversationWorkspaceMigratedAt,
    };
  }
  if (options.refresh && remoteLayoutCache && Date.now() - remoteLayoutCacheAt < LOCAL_WRITE_GRACE_MS) {
    return remoteLayoutCache;
  }
  if (options.refresh && remoteLayoutPromise) {
    return remoteLayoutPromise;
  }

  const promise = api.openConversationTabs().then(async (layout) => {
    let normalized = normalizeRemoteConversationLayout(layout);
    const legacyLayout = readLegacyConversationLayout();
    if (!normalized.conversationWorkspaceMigratedAt && !hasConversationWorkspaceIds(normalized) && hasConversationWorkspaceIds(legacyLayout)) {
      const migrated = await api.setOpenConversationTabs(
        legacyLayout.sessionIds,
        legacyLayout.pinnedSessionIds,
        legacyLayout.archivedSessionIds,
        undefined,
        legacyLayout.activeSessionId,
        { conversationWorkspaceMigrated: true },
      );
      normalized = normalizeRemoteConversationLayout(migrated);
      clearLegacyConversationLayout();
    }
    remoteLayoutCache = normalized;
    remoteLayoutCacheAt = Date.now();
    conversationLayoutProjection = normalized;
    return normalized;
  });
  remoteLayoutPromise = promise;
  try {
    return await promise;
  } finally {
    if (remoteLayoutPromise === promise) {
      remoteLayoutPromise = null;
    }
  }
}

function persistConversationLayoutToServer(layout: ConversationLayout): void {
  void api
    .setOpenConversationTabs(layout.sessionIds, layout.pinnedSessionIds, layout.archivedSessionIds, undefined, layout.activeSessionId, {
      conversationWorkspaceMigrated: true,
    })
    .then((saved) => {
      if (!isRemoteConversationLayoutPayload(saved)) {
        return;
      }
      const normalized = normalizeRemoteConversationLayout(saved);
      remoteLayoutCache = normalized;
      remoteLayoutCacheAt = Date.now();
      conversationLayoutProjection = normalized;
      dispatchConversationLayoutChanged(normalized);
      clearLegacyConversationLayout();
    })
    .catch(() => {
      void fetchRemoteConversationLayout({ refresh: true, reason: 'persist-failed' })
        .then((remote) => {
          dispatchConversationLayoutChanged(remote);
        })
        .catch(() => {
          // Keep the in-memory projection until connectivity recovers.
        });
    });
}

function persistConversationOperationToServer(operation: ConversationWorkspaceOperation): void {
  void api
    .updateConversationWorkspace(operation)
    .then((saved) => {
      if (!isRemoteConversationLayoutPayload(saved)) {
        return;
      }
      const normalized = normalizeRemoteConversationLayout(saved);
      remoteLayoutCache = normalized;
      remoteLayoutCacheAt = Date.now();
      conversationLayoutProjection = normalized;
      dispatchConversationLayoutChanged(normalized);
      clearLegacyConversationLayout();
    })
    .catch(() => {
      void fetchRemoteConversationLayout({ refresh: true, reason: `operation-failed:${operation.operation}` })
        .then((remote) => {
          dispatchConversationLayoutChanged(remote);
        })
        .catch(() => {
          // Keep the in-memory projection until connectivity recovers.
        });
    });
}

function readStoredSessionIds(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeSessionIds(parsed);
      }
    }
  } catch {
    // Ignore malformed storage.
  }

  return [];
}

function readLegacyConversationLayout(): ConversationLayout {
  return normalizeConversationLayout({
    sessionIds: readStoredSessionIds(OPEN_SESSION_IDS_STORAGE_KEY),
    pinnedSessionIds: readStoredSessionIds(PINNED_SESSION_IDS_STORAGE_KEY),
    archivedSessionIds: readStoredSessionIds(ARCHIVED_SESSION_IDS_STORAGE_KEY),
    activeSessionId: localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY),
  });
}

function clearLegacyConversationLayout(): void {
  try {
    localStorage.removeItem(OPEN_SESSION_IDS_STORAGE_KEY);
    localStorage.removeItem(PINNED_SESSION_IDS_STORAGE_KEY);
    localStorage.removeItem(ARCHIVED_SESSION_IDS_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_ID_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function readConversationLayout(): ConversationLayout {
  if (conversationLayoutProjection) {
    return conversationLayoutProjection;
  }

  return readLegacyConversationLayout();
}

export function readOpenSessionIds(): string[] {
  return readConversationLayout().sessionIds;
}

export function readPinnedSessionIds(): string[] {
  return readConversationLayout().pinnedSessionIds;
}

export function readArchivedSessionIds(): string[] {
  return readConversationLayout().archivedSessionIds;
}

function writeConversationLayout(layout: ConversationLayout, options: { local?: boolean } = {}): ConversationLayout {
  if (options.local) {
    lastLocalWriteAt = Date.now();
  }
  const normalizedLayout = normalizeConversationLayout(layout);
  conversationLayoutProjection = normalizedLayout;
  persistConversationLayoutToServer(normalizedLayout);
  dispatchConversationLayoutChanged(normalizedLayout);

  return normalizedLayout;
}

function writeConversationLayoutFromOperation(
  layout: ConversationLayout,
  operation: ConversationWorkspaceOperation,
  options: { local?: boolean } = {},
): ConversationLayout {
  if (options.local) {
    lastLocalWriteAt = Date.now();
  }
  const normalizedLayout = normalizeConversationLayout(layout);
  conversationLayoutProjection = normalizedLayout;
  persistConversationOperationToServer(operation);
  dispatchConversationLayoutChanged(normalizedLayout);
  return normalizedLayout;
}

function acceptConversationLayoutSnapshot(layout: ConversationLayout): ConversationLayout {
  const normalizedLayout = normalizeConversationLayout(layout);
  conversationLayoutProjection = normalizedLayout;
  dispatchConversationLayoutChanged(normalizedLayout);
  return normalizedLayout;
}

function dispatchConversationLayoutChanged(layout: ConversationLayout): void {
  window.dispatchEvent(
    new CustomEvent(CONVERSATION_LAYOUT_CHANGED_EVENT, {
      detail: layout,
    }),
  );
}

export function replaceConversationLayout(layout: ConversationLayoutInput): ConversationLayout {
  const current = readConversationLayout();
  const merged = mergeConversationLayout(current, layout);
  const next = applyArchiveTransitions(current, merged);
  if (sameConversationLayout(current, next)) {
    return current;
  }

  return writeConversationLayout(next, { local: true });
}

export function applyRemoteConversationLayout(layout: RemoteConversationLayoutInput): ConversationLayout {
  if (layout.workspacePaths !== undefined) {
    remoteLayoutCache = normalizeRemoteConversationLayout(layout);
    remoteLayoutCacheAt = Date.now();
  }

  const current = readConversationLayout();
  const next = normalizeConversationLayout(layout);
  if (sameConversationLayout(current, next)) {
    return current;
  }

  return acceptConversationLayoutSnapshot(next);
}

export function setActiveConversationTab(sessionId: string | null | undefined): ConversationLayout {
  const current = readConversationLayout();
  const normalizedSessionId = normalizeSessionId(sessionId);
  const nextActiveSessionId =
    normalizedSessionId && listWorkspaceSessionIds(current).includes(normalizedSessionId) ? normalizedSessionId : null;
  if (current.activeSessionId === nextActiveSessionId) {
    return current;
  }

  return writeConversationLayoutFromOperation(
    { ...current, activeSessionId: nextActiveSessionId },
    { operation: 'setActive', sessionId: nextActiveSessionId },
    { local: true },
  );
}

export function ensureConversationTabOpen(sessionId: string | null | undefined, options: { active?: boolean } = {}): string[] {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const layout = readConversationLayout();
  if (!normalizedSessionId || layout.pinnedSessionIds.includes(normalizedSessionId) || layout.sessionIds.includes(normalizedSessionId)) {
    return layout.sessionIds;
  }

  return writeConversationLayoutFromOperation(
    {
      ...layout,
      sessionIds: [...layout.sessionIds, normalizedSessionId],
      activeSessionId: options.active === false ? layout.activeSessionId : normalizedSessionId,
    },
    { operation: 'open', sessionId: normalizedSessionId, active: options.active },
    { local: true },
  ).sessionIds;
}

export function openConversationTab(sessionId: string, options: { active?: boolean } = {}): string[] {
  return ensureConversationTabOpen(sessionId, options);
}

export function closeConversationTab(sessionId: string): string[] {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const current = readConversationLayout();
  const nextSessionIds = current.sessionIds.filter((id) => id !== normalizedSessionId);
  if (nextSessionIds.length === current.sessionIds.length) {
    return current.sessionIds;
  }

  return writeConversationLayoutFromOperation(
    applyArchiveTransitions(
      current,
      normalizeConversationLayout({
        ...current,
        sessionIds: nextSessionIds,
      }),
    ),
    { operation: 'close', sessionId: normalizedSessionId },
    { local: true },
  ).sessionIds;
}

export function setConversationArchivedState(sessionId: string, archived: boolean): ConversationLayout {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const current = readConversationLayout();
  if (!normalizedSessionId) {
    return current;
  }

  const nextPinnedSessionIds = current.pinnedSessionIds.filter((id) => id !== normalizedSessionId);
  const openWithoutSession = current.sessionIds.filter((id) => id !== normalizedSessionId);
  const archivedWithoutSession = current.archivedSessionIds.filter((id) => id !== normalizedSessionId);
  const nextSessionIds = archived ? openWithoutSession : [...openWithoutSession, normalizedSessionId];
  const nextArchivedSessionIds = archived ? [...archivedWithoutSession, normalizedSessionId] : archivedWithoutSession;

  return writeConversationLayoutFromOperation(
    {
      sessionIds: nextSessionIds,
      pinnedSessionIds: nextPinnedSessionIds,
      archivedSessionIds: nextArchivedSessionIds,
      activeSessionId: current.activeSessionId && archived && current.activeSessionId === normalizedSessionId ? null : current.activeSessionId,
    },
    { operation: archived ? 'archive' : 'restore', sessionId: normalizedSessionId },
    { local: true },
  );
}

export function reopenMostRecentlyArchivedConversation(): {
  reopenedSessionId: string | null;
  layout: ConversationLayout;
} {
  const current = readConversationLayout();
  const reopenedSessionId = current.archivedSessionIds.at(-1) ?? null;
  if (!reopenedSessionId) {
    return { reopenedSessionId: null, layout: current };
  }

  return {
    reopenedSessionId,
    layout: setConversationArchivedState(reopenedSessionId, false),
  };
}

export function pinConversationTab(sessionId: string): ConversationLayout {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const current = readConversationLayout();
  if (!normalizedSessionId) {
    return current;
  }

  const firstPinnedSessionId = current.pinnedSessionIds.find((id) => id !== normalizedSessionId) ?? null;
  return moveConversationTab(normalizedSessionId, 'pinned', firstPinnedSessionId, 'before');
}

export function unpinConversationTab(sessionId: string, options: { open?: boolean } = {}): ConversationLayout {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const current = readConversationLayout();
  const nextPinnedSessionIds = current.pinnedSessionIds.filter((id) => id !== normalizedSessionId);

  if (nextPinnedSessionIds.length === current.pinnedSessionIds.length) {
    return current;
  }

  const nextSessionIds =
    options.open === false || current.sessionIds.includes(normalizedSessionId)
      ? current.sessionIds
      : [...current.sessionIds, normalizedSessionId];

  return writeConversationLayoutFromOperation(
    applyArchiveTransitions(
      current,
      normalizeConversationLayout({
        ...current,
        sessionIds: nextSessionIds,
        pinnedSessionIds: nextPinnedSessionIds,
      }),
    ),
    { operation: 'unpin', sessionId: normalizedSessionId, open: options.open },
    { local: true },
  );
}

function moveConversationToSection(
  layout: ConversationLayout,
  draggedSessionId: string,
  targetSection: ConversationShelf,
  targetSessionId?: string | null,
  position: OpenConversationDropPosition = 'after',
): ConversationLayout {
  const normalizedLayout = normalizeConversationLayout(layout);
  const draggedId = normalizeSessionId(draggedSessionId);

  if (!draggedId) {
    return normalizedLayout;
  }

  const nextSessionIds = normalizedLayout.sessionIds.filter((id) => id !== draggedId);
  const nextPinnedSessionIds = normalizedLayout.pinnedSessionIds.filter((id) => id !== draggedId);
  const targetIds = targetSection === 'open' ? nextSessionIds : nextPinnedSessionIds;
  const normalizedTargetId = normalizeSessionId(targetSessionId);

  if (!normalizedTargetId) {
    targetIds.push(draggedId);
    return normalizeConversationLayout({
      sessionIds: nextSessionIds,
      pinnedSessionIds: nextPinnedSessionIds,
      archivedSessionIds: normalizedLayout.archivedSessionIds,
      activeSessionId: normalizedLayout.activeSessionId,
    });
  }

  const targetIndex = targetIds.indexOf(normalizedTargetId);
  if (targetIndex === -1) {
    targetIds.push(draggedId);
    return normalizeConversationLayout({
      sessionIds: nextSessionIds,
      pinnedSessionIds: nextPinnedSessionIds,
      archivedSessionIds: normalizedLayout.archivedSessionIds,
      activeSessionId: normalizedLayout.activeSessionId,
    });
  }

  const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
  targetIds.splice(insertIndex, 0, draggedId);
  return normalizeConversationLayout({
    sessionIds: nextSessionIds,
    pinnedSessionIds: nextPinnedSessionIds,
    archivedSessionIds: normalizedLayout.archivedSessionIds,
    activeSessionId: normalizedLayout.activeSessionId,
  });
}

export function moveConversationTab(
  sessionId: string,
  targetSection: ConversationShelf,
  targetSessionId?: string | null,
  position: OpenConversationDropPosition = 'after',
): ConversationLayout {
  const current = readConversationLayout();
  const next = moveConversationToSection(current, sessionId, targetSection, targetSessionId, position);
  if (sameConversationLayout(current, next)) {
    return current;
  }

  return writeConversationLayoutFromOperation(
    next,
    { operation: 'move', sessionId, targetSection, targetSessionId, position },
    { local: true },
  );
}

export function shiftConversationTab(sessionId: string, direction: -1 | 1): ConversationLayout {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) {
    return readConversationLayout();
  }

  const current = readConversationLayout();
  const pinnedIndex = current.pinnedSessionIds.indexOf(normalizedSessionId);
  if (pinnedIndex !== -1) {
    const targetIndex = pinnedIndex + direction;
    const targetSessionId = current.pinnedSessionIds[targetIndex];
    if (!targetSessionId) {
      return current;
    }

    return moveConversationTab(normalizedSessionId, 'pinned', targetSessionId, direction < 0 ? 'before' : 'after');
  }

  const openIndex = current.sessionIds.indexOf(normalizedSessionId);
  if (openIndex === -1) {
    return current;
  }

  const targetSessionId = current.sessionIds[openIndex + direction];
  if (!targetSessionId) {
    return current;
  }

  return moveConversationTab(normalizedSessionId, 'open', targetSessionId, direction < 0 ? 'before' : 'after');
}
