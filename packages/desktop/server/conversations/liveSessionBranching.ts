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

function appendForkedConversationWorkspaceMetadata(input: {
  sourceSessionFile: string;
  childSessionFile: string;
  fallbackCwd: string;
}): void {
  const sourceMeta = readConversationSessionMetaByFilePath(input.sourceSessionFile);
  const cwd = sourceMeta?.cwd ?? input.fallbackCwd;
  const workspaceCwd =
    sourceMeta && Object.prototype.hasOwnProperty.call(sourceMeta, 'workspaceCwd')
      ? sourceMeta.workspaceCwd
      : isNeutralChatWorkspaceCwd({ cwd, runtimeDir: getPiAgentRuntimeDir() })
        ? null
        : cwd;
  appendConversationWorkspaceMetadata({
    sessionFile: input.childSessionFile,
    cwd,
    workspaceCwd,
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
  options: LiveSessionLoaderOptions & { preserveSource?: boolean; beforeEntry?: boolean; branchKind?: LiveSessionForkKind },
  callbacks: LiveSessionBranchCallbacks,
): Promise<LiveSessionBranchResult> {
  const startedAtMs = performance.now();
  const { preserveSource, beforeEntry, branchKind, ...loaderOptions } = options;
  const topologyKind: LiveSessionForkKind = branchKind ?? (beforeEntry ? 'rewind' : 'fork');

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

  if (beforeEntry && !sourceEntry.parentId) {
    const defaultsStartedAtMs = performance.now();
    const created = await callbacks.createSession(entry.cwd, {
      ...loaderOptions,
      initialModel: loaderOptions.initialModel === undefined ? (entry.session.model?.id ?? null) : loaderOptions.initialModel,
      initialThinkingLevel:
        loaderOptions.initialThinkingLevel === undefined ? (entry.session.thinkingLevel ?? null) : loaderOptions.initialThinkingLevel,
      initialServiceTier:
        loaderOptions.initialServiceTier === undefined
          ? await callbacks.resolveDefaultServiceTier(entry)
          : loaderOptions.initialServiceTier,
    });
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
      fallbackCwd: entry.cwd,
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

  const targetEntryId = beforeEntry ? sourceEntry.parentId : entryId;
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
    fallbackCwd: entry.cwd,
  });
  const metadataAppendedAtMs = performance.now();

  const resumed = await callbacks.resumeSession(forkedSessionFile, {
    ...loaderOptions,
    cwdOverride: entry.cwd,
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
