export interface SessionMetaLike {
  id: string;
  file: string;
  timestamp: string;
  cwd: string;
  cwdSlug: string;
  model: string;
  title: string;
  messageCount: number;
  workspaceCwd?: string | null;
  parentSessionFile?: string;
  parentSessionId?: string;
  parentMessageId?: string;
  offshootKind?: string;
  offshootTimestamp?: string;
  sourceRunId?: string;
}

export interface CachedSessionMetaLike<TMeta extends SessionMetaLike> {
  signature: string;
  meta: TMeta;
}

export interface PersistentSessionIndexEntry<TMeta extends SessionMetaLike = SessionMetaLike> {
  filePath: string;
  signature: string;
  meta: TMeta;
}

export interface PersistentSessionIndexDocument<TMeta extends SessionMetaLike = SessionMetaLike> {
  version: 1;
  sessionsDir: string;
  entries: Array<PersistentSessionIndexEntry<TMeta>>;
}

export function serializePersistentSessionIndex(document: PersistentSessionIndexDocument): string {
  return JSON.stringify(document);
}

export function buildPersistentSessionIndexDocument<TMeta extends SessionMetaLike>(
  sessionsDir: string,
  sessionMetaCache: Map<string, CachedSessionMetaLike<TMeta>>,
): PersistentSessionIndexDocument<TMeta> {
  const entries = [...sessionMetaCache.entries()]
    .map(([filePath, cached]) => ({
      filePath,
      signature: cached.signature,
      meta: cached.meta,
    }))
    .sort((left, right) => (left.filePath < right.filePath ? -1 : left.filePath > right.filePath ? 1 : 0));

  return {
    version: 1,
    sessionsDir,
    entries,
  };
}

export function loadPersistentSessionIndexEntry<TMeta extends SessionMetaLike = SessionMetaLike>(
  value: unknown,
): PersistentSessionIndexEntry<TMeta> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Partial<PersistentSessionIndexEntry<TMeta>>;
  const meta = entry.meta as Partial<TMeta> | undefined;
  if (typeof entry.filePath !== 'string' || typeof entry.signature !== 'string' || !meta) {
    return null;
  }
  if (
    typeof meta.id !== 'string' ||
    typeof meta.timestamp !== 'string' ||
    typeof meta.cwd !== 'string' ||
    typeof meta.cwdSlug !== 'string' ||
    typeof meta.model !== 'string' ||
    typeof meta.title !== 'string' ||
    typeof meta.messageCount !== 'number'
  ) {
    return null;
  }

  const workspaceCwd = Object.prototype.hasOwnProperty.call(meta, 'workspaceCwd')
    ? meta.workspaceCwd === null
      ? null
      : typeof meta.workspaceCwd === 'string' && meta.workspaceCwd.trim().length > 0
        ? meta.workspaceCwd.trim()
        : undefined
    : undefined;

  return {
    filePath: entry.filePath,
    signature: entry.signature,
    meta: {
      id: meta.id,
      file: entry.filePath,
      timestamp: meta.timestamp,
      cwd: meta.cwd,
      cwdSlug: meta.cwdSlug,
      model: meta.model,
      title: meta.title,
      messageCount: meta.messageCount,
      ...(workspaceCwd !== undefined ? { workspaceCwd } : {}),
      ...(typeof meta.parentSessionFile === 'string' && meta.parentSessionFile.trim().length > 0
        ? { parentSessionFile: meta.parentSessionFile.trim() }
        : {}),
      ...(typeof meta.parentSessionId === 'string' && meta.parentSessionId.trim().length > 0
        ? { parentSessionId: meta.parentSessionId.trim() }
        : {}),
      ...(typeof meta.parentMessageId === 'string' && meta.parentMessageId.trim().length > 0
        ? { parentMessageId: meta.parentMessageId.trim() }
        : {}),
      ...(typeof meta.offshootKind === 'string' && meta.offshootKind.trim().length > 0 ? { offshootKind: meta.offshootKind.trim() } : {}),
      ...(typeof meta.offshootTimestamp === 'string' && meta.offshootTimestamp.trim().length > 0
        ? { offshootTimestamp: meta.offshootTimestamp.trim() }
        : {}),
      ...(typeof meta.sourceRunId === 'string' && meta.sourceRunId.trim().length > 0 ? { sourceRunId: meta.sourceRunId.trim() } : {}),
    } as TMeta,
  };
}
