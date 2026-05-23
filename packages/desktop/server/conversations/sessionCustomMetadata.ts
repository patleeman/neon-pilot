export type ConversationOffshootKind = 'fork' | 'rewind' | 'subagent' | 'duplicate' | 'side';

export interface ConversationWorkspaceMetadata {
  cwd?: string;
  workspaceCwd?: string | null;
}

export interface ConversationOffshootMetadata {
  kind?: ConversationOffshootKind;
  detached?: boolean;
  timestamp?: string;
  parentSessionFile?: string;
  parentSessionId?: string;
  parentMessageId?: string;
  sourceRunId?: string;
}

export interface CustomEntryLike {
  customType?: string;
  timestamp?: string;
  data?: unknown;
}

export function normalizeOptionalPath(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function normalizeWorkspaceCwdValue(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function readConversationWorkspaceMetadata(
  line: CustomEntryLike,
  workspaceMetadataCustomType: string,
): ConversationWorkspaceMetadata | null {
  if (line.customType !== workspaceMetadataCustomType || !line.data || typeof line.data !== 'object') {
    return null;
  }

  const data = line.data as Record<string, unknown>;
  const cwd = typeof data.cwd === 'string' && data.cwd.trim().length > 0 ? data.cwd.trim() : undefined;
  const workspaceCwd = normalizeWorkspaceCwdValue(data.workspaceCwd);

  if (cwd === undefined && workspaceCwd === undefined) {
    return null;
  }

  return {
    ...(cwd !== undefined ? { cwd } : {}),
    ...(workspaceCwd !== undefined ? { workspaceCwd } : {}),
  };
}

export function readConversationOffshootMetadata(
  line: CustomEntryLike,
  offshootMetadataCustomType: string,
): ConversationOffshootMetadata | null {
  if (line.customType !== offshootMetadataCustomType || !line.data || typeof line.data !== 'object') {
    return null;
  }

  const data = line.data as Record<string, unknown>;
  if (data.detached === true) {
    return { detached: true };
  }

  const kind = typeof data.kind === 'string' ? data.kind.trim() : '';
  if (!['fork', 'rewind', 'subagent', 'duplicate', 'side'].includes(kind)) {
    return null;
  }

  const parentSessionFile = typeof data.parentSessionFile === 'string' ? normalizeOptionalPath(data.parentSessionFile) : undefined;
  const parentSessionId = typeof data.parentSessionId === 'string' && data.parentSessionId.trim() ? data.parentSessionId.trim() : undefined;
  const parentMessageId = typeof data.parentMessageId === 'string' && data.parentMessageId.trim() ? data.parentMessageId.trim() : undefined;
  const sourceRunId = typeof data.sourceRunId === 'string' && data.sourceRunId.trim() ? data.sourceRunId.trim() : undefined;
  return {
    kind: kind as ConversationOffshootKind,
    ...(typeof line.timestamp === 'string' && line.timestamp.trim() ? { timestamp: line.timestamp.trim() } : {}),
    ...(parentSessionFile ? { parentSessionFile } : {}),
    ...(parentSessionId ? { parentSessionId } : {}),
    ...(parentMessageId ? { parentMessageId } : {}),
    ...(sourceRunId ? { sourceRunId } : {}),
  };
}
