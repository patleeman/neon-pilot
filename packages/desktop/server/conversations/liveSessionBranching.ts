import { type AgentSession, SessionManager } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir } from '@neon-pilot/core';

import {
  appendChildConversationTopologyEntry,
  appendConversationOffshootMetadata,
  appendConversationWorkspaceMetadata,
  appendParentConversationBacklinkEntry,
  readConversationSessionMetaByFilePath,
} from './conversationTranscriptOps.js';
import type { LiveSessionLoaderOptions } from './liveSessionLoader.js';
import { isNeutralChatWorkspaceCwd } from './sessionWorkspaceMetadata.js';

export interface LiveSessionBranchHost {
  sessionId: string;
  cwd: string;
  session: AgentSession;
}

export interface LiveSessionBranchCallbacks {
  createSession: (
    cwd: string,
    options: LiveSessionLoaderOptions,
  ) => Promise<{ id: string; sessionFile: string; perf?: Record<string, number> }>;
  reserveSession?: (cwd: string) => { id: string; sessionFile: string; perf?: Record<string, number> };
  resumeSession: (
    sessionFile: string,
    options: LiveSessionLoaderOptions & { cwdOverride?: string },
  ) => Promise<{ id: string; perf?: Record<string, number> }>;
  destroySession: (sessionId: string) => void;
  resolveDefaultServiceTier: (
    entry: LiveSessionBranchHost,
  ) => LiveSessionLoaderOptions['initialServiceTier'] | Promise<LiveSessionLoaderOptions['initialServiceTier']>;
}

type LiveSessionBranchResult = { newSessionId: string; sessionFile: string; perf?: Record<string, number> };
type LiveSessionForkKind = 'fork' | 'rewind';

function readEntryRole(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as { type?: unknown; message?: { role?: unknown } };
  return candidate.type === 'message' && typeof candidate.message?.role === 'string' ? candidate.message.role : null;
}

function readEntryParentId(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return null;
  const parentId = (entry as { parentId?: unknown }).parentId;
  return typeof parentId === 'string' && parentId.trim().length > 0 ? parentId : null;
}

function findNearestUserAncestorId(sourceManager: SessionManager, entry: unknown): string | null {
  let parentId = readEntryParentId(entry);
  const seen = new Set<string>();
  while (parentId) {
    if (seen.has(parentId)) return null;
    seen.add(parentId);
    const parent = sourceManager.getEntry(parentId);
    if (!parent) return null;
    if (readEntryRole(parent) === 'user') return parentId;
    parentId = readEntryParentId(parent);
  }
  return null;
}

function branchTargetHasVisibleMessage(sourceManager: SessionManager, targetEntryId: string | null): boolean {
  let currentId = targetEntryId;
  const seen = new Set<string>();
  while (currentId) {
    if (seen.has(currentId)) return false;
    seen.add(currentId);
    const current = sourceManager.getEntry(currentId);
    if (!current) return false;
    if (readEntryRole(current)) return true;
    currentId = readEntryParentId(current);
  }
  return false;
}

function resolveBeforeEntryTargetId(sourceManager: SessionManager, sourceEntry: unknown): string | null {
  if (readEntryRole(sourceEntry) === 'assistant') {
    const userId = findNearestUserAncestorId(sourceManager, sourceEntry);
    const userEntry = userId ? sourceManager.getEntry(userId) : null;
    return readEntryParentId(userEntry);
  }
  return readEntryParentId(sourceEntry);
}

function resolveForkedConversationWorkspaceMetadata(input: { sourceSessionFile: string; fallbackCwd: string }): {
  cwd: string;
  workspaceCwd: string | null;
} {
  const sourceMeta = readConversationSessionMetaByFilePath(input.sourceSessionFile);
  const cwd = sourceMeta?.cwd ?? input.fallbackCwd;
  const workspaceCwd =
    sourceMeta && Object.prototype.hasOwnProperty.call(sourceMeta, 'workspaceCwd')
      ? (sourceMeta.workspaceCwd ?? null)
      : isNeutralChatWorkspaceCwd({ cwd, runtimeDir: getPiAgentRuntimeDir() })
        ? null
        : cwd;
  return { cwd, workspaceCwd };
}

function appendForkedConversationWorkspaceMetadata(input: {
  sourceSessionFile: string;
  childSessionFile: string;
  fallbackCwd: string;
}): void {
  const workspace = resolveForkedConversationWorkspaceMetadata(input);
  appendConversationWorkspaceMetadata({
    sessionFile: input.childSessionFile,
    cwd: workspace.cwd,
    workspaceCwd: workspace.workspaceCwd,
  });
}

export async function branchLiveSession(
  entry: LiveSessionBranchHost,
  entryId: string,
  options: LiveSessionLoaderOptions,
  callbacks: Pick<LiveSessionBranchCallbacks, 'resumeSession'>,
): Promise<LiveSessionBranchResult> {
  const startedAtMs = performance.now();
  // Safe while streaming: Pi only persists completed messages on message_end, so the
  // session file is already a stable snapshot of the conversation before the active turn.
  const sourceSessionFile = entry.session.sessionFile;
  if (!sourceSessionFile) {
    throw new Error('Cannot branch a live session without a session file.');
  }

  const sourceManager = SessionManager.open(sourceSessionFile, undefined, entry.cwd);
  const sourceOpenedAtMs = performance.now();
  if (!sourceManager.getEntry(entryId)) {
    throw new Error(`Session entry not found: ${entryId}`);
  }
  const sourceEntryCheckedAtMs = performance.now();

  const branchedSessionFile = sourceManager.createBranchedSession(entryId);
  if (!branchedSessionFile) {
    throw new Error('Unable to create a branched session file.');
  }
  const branchFileCreatedAtMs = performance.now();

  // Append offshoot metadata BEFORE resumeSession so the SDK loads it as part of
  // the branch chain. If appended after, the SDK's leafId doesn't include the
  // metadata entry and new messages bypass it — orphaning the metadata on reload.
  appendConversationOffshootMetadata({
    sessionFile: branchedSessionFile,
    kind: 'fork',
    parentSessionFile: sourceSessionFile,
    parentSessionId: entry.sessionId,
    parentMessageId: entryId,
  });
  appendParentConversationBacklinkEntry({
    sessionFile: branchedSessionFile,
    kind: 'fork',
    parentSessionFile: sourceSessionFile,
    parentSessionId: entry.sessionId,
    parentMessageId: entryId,
  });
  appendForkedConversationWorkspaceMetadata({
    sourceSessionFile,
    childSessionFile: branchedSessionFile,
    fallbackCwd: entry.cwd,
  });
  const metadataAppendedAtMs = performance.now();

  const resumed = await callbacks.resumeSession(branchedSessionFile, {
    ...options,
    cwdOverride: entry.cwd,
  });
  const resumedAtMs = performance.now();

  // Write the "Forked →" tombstone directly into the source session file
  // so it survives app restarts without scanning other files.
  appendChildConversationTopologyEntry({
    parentSessionFile: sourceSessionFile,
    childSessionId: resumed.id,
    kind: 'fork',
    parentMessageId: entryId,
  });
  const topologyAppendedAtMs = performance.now();

  return {
    newSessionId: resumed.id,
    sessionFile: branchedSessionFile,
    perf: {
      branchSourceOpenMs: Math.round(sourceOpenedAtMs - startedAtMs),
      branchSourceEntryCheckMs: Math.round(sourceEntryCheckedAtMs - sourceOpenedAtMs),
      branchCreateFileMs: Math.round(branchFileCreatedAtMs - sourceEntryCheckedAtMs),
      branchMetadataMs: Math.round(metadataAppendedAtMs - branchFileCreatedAtMs),
      branchResumeMs: Math.round(resumedAtMs - metadataAppendedAtMs),
      branchTopologyMs: Math.round(topologyAppendedAtMs - resumedAtMs),
      branchTotalMs: Math.round(topologyAppendedAtMs - startedAtMs),
    },
  };
}

export async function forkLiveSession(
  entry: LiveSessionBranchHost,
  entryId: string,
  options: LiveSessionLoaderOptions & {
    preserveSource?: boolean;
    beforeEntry?: boolean;
    branchKind?: LiveSessionForkKind;
    cwdOverride?: string;
  },
  callbacks: LiveSessionBranchCallbacks,
): Promise<LiveSessionBranchResult> {
  const startedAtMs = performance.now();
  const { preserveSource, beforeEntry, branchKind, cwdOverride, ...loaderOptions } = options;
  const topologyKind: LiveSessionForkKind = branchKind ?? (beforeEntry ? 'rewind' : 'fork');
  const childCwd = cwdOverride?.trim() || entry.cwd;

  if (entry.session.isStreaming && !preserveSource) {
    throw new Error('Cannot replace a running conversation while forking. Keep the source conversation open instead.');
  }

  // Safe while streaming: Pi only persists completed messages on message_end, so the
  // session file is already a stable snapshot of the conversation before the active turn.
  const sourceSessionFile = entry.session.sessionFile;
  if (!sourceSessionFile) {
    throw new Error('Cannot fork a live session without a session file.');
  }

  const sourceManager = SessionManager.open(sourceSessionFile, undefined, entry.cwd);
  const sourceOpenedAtMs = performance.now();
  const sourceEntry = sourceManager.getEntry(entryId);
  if (!sourceEntry) {
    throw new Error(`Session entry not found: ${entryId}`);
  }
  const sourceEntryCheckedAtMs = performance.now();

  const beforeEntryTargetId = beforeEntry ? resolveBeforeEntryTargetId(sourceManager, sourceEntry) : null;

  if (beforeEntry && !branchTargetHasVisibleMessage(sourceManager, beforeEntryTargetId)) {
    const defaultsStartedAtMs = performance.now();
    const created =
      callbacks.reserveSession?.(childCwd) ??
      (await callbacks.createSession(childCwd, {
        ...loaderOptions,
        initialModel: loaderOptions.initialModel === undefined ? (entry.session.model?.id ?? null) : loaderOptions.initialModel,
        initialThinkingLevel:
          loaderOptions.initialThinkingLevel === undefined ? (entry.session.thinkingLevel ?? null) : loaderOptions.initialThinkingLevel,
        initialServiceTier:
          loaderOptions.initialServiceTier === undefined
            ? await callbacks.resolveDefaultServiceTier(entry)
            : loaderOptions.initialServiceTier,
      }));
    const createdAtMs = performance.now();

    if (!preserveSource) {
      callbacks.destroySession(entry.sessionId);
    }
    const sourceDestroyedAtMs = performance.now();

    appendConversationOffshootMetadata({
      sessionFile: created.sessionFile,
      kind: topologyKind,
      parentSessionFile: sourceSessionFile,
      parentSessionId: entry.sessionId,
      parentMessageId: entryId,
    });
    appendParentConversationBacklinkEntry({
      sessionFile: created.sessionFile,
      kind: topologyKind,
      parentSessionFile: sourceSessionFile,
      parentSessionId: entry.sessionId,
      parentMessageId: entryId,
    });
    appendForkedConversationWorkspaceMetadata({
      sourceSessionFile,
      childSessionFile: created.sessionFile,
      fallbackCwd: childCwd,
    });
    const metadataAppendedAtMs = performance.now();

    // Write tombstone to source (only when source is kept)
    if (preserveSource) {
      appendChildConversationTopologyEntry({
        parentSessionFile: sourceSessionFile,
        childSessionId: created.id,
        kind: topologyKind,
        parentMessageId: entryId,
      });
    }
    const topologyAppendedAtMs = performance.now();

    return {
      newSessionId: created.id,
      sessionFile: created.sessionFile,
      perf: {
        forkSourceOpenMs: Math.round(sourceOpenedAtMs - startedAtMs),
        forkSourceEntryCheckMs: Math.round(sourceEntryCheckedAtMs - sourceOpenedAtMs),
        forkRootDefaultSetupMs: Math.round(defaultsStartedAtMs - sourceEntryCheckedAtMs),
        forkRootCreateSessionMs: Math.round(createdAtMs - defaultsStartedAtMs),
        forkRootDestroySourceMs: Math.round(sourceDestroyedAtMs - createdAtMs),
        forkMetadataMs: Math.round(metadataAppendedAtMs - sourceDestroyedAtMs),
        forkTopologyMs: Math.round(topologyAppendedAtMs - metadataAppendedAtMs),
        forkTotalMs: Math.round(topologyAppendedAtMs - startedAtMs),
      },
    };
  }

  const targetEntryId = beforeEntry ? beforeEntryTargetId : entryId;
  if (!targetEntryId) {
    throw new Error(`Session entry not found: ${entryId}`);
  }

  const forkedSessionFile = sourceManager.createBranchedSession(targetEntryId);
  if (!forkedSessionFile) {
    throw new Error('Unable to create a forked session file.');
  }
  const branchFileCreatedAtMs = performance.now();

  // Append offshoot metadata BEFORE resumeSession so the SDK loads it as part of
  // the branch chain. If appended after, the SDK's leafId doesn't include the
  // metadata entry and new messages bypass it — orphaning the metadata on reload.
  appendConversationOffshootMetadata({
    sessionFile: forkedSessionFile,
    kind: topologyKind,
    parentSessionFile: sourceSessionFile,
    parentSessionId: entry.sessionId,
    parentMessageId: entryId,
  });
  appendParentConversationBacklinkEntry({
    sessionFile: forkedSessionFile,
    kind: topologyKind,
    parentSessionFile: sourceSessionFile,
    parentSessionId: entry.sessionId,
    parentMessageId: entryId,
  });
  appendForkedConversationWorkspaceMetadata({
    sourceSessionFile,
    childSessionFile: forkedSessionFile,
    fallbackCwd: childCwd,
  });
  const metadataAppendedAtMs = performance.now();

  const resumed = await callbacks.resumeSession(forkedSessionFile, {
    ...loaderOptions,
    cwdOverride: childCwd,
  });
  const resumedAtMs = performance.now();

  // Write tombstone to source (only when source is kept)
  if (preserveSource) {
    appendChildConversationTopologyEntry({
      parentSessionFile: sourceSessionFile,
      childSessionId: resumed.id,
      kind: topologyKind,
      parentMessageId: entryId,
    });
  }
  const topologyAppendedAtMs = performance.now();

  if (!preserveSource) {
    callbacks.destroySession(entry.sessionId);
  }
  const sourceDestroyedAtMs = performance.now();

  return {
    newSessionId: resumed.id,
    sessionFile: forkedSessionFile,
    perf: {
      forkSourceOpenMs: Math.round(sourceOpenedAtMs - startedAtMs),
      forkSourceEntryCheckMs: Math.round(sourceEntryCheckedAtMs - sourceOpenedAtMs),
      forkCreateFileMs: Math.round(branchFileCreatedAtMs - sourceEntryCheckedAtMs),
      forkMetadataMs: Math.round(metadataAppendedAtMs - branchFileCreatedAtMs),
      forkResumeMs: Math.round(resumedAtMs - metadataAppendedAtMs),
      forkTopologyMs: Math.round(topologyAppendedAtMs - resumedAtMs),
      forkDestroySourceMs: Math.round(sourceDestroyedAtMs - topologyAppendedAtMs),
      forkTotalMs: Math.round(sourceDestroyedAtMs - startedAtMs),
    },
  };
}
