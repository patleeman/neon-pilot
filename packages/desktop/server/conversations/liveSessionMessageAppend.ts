import type { AgentSession } from '@earendil-works/pi-coding-agent';

import { buildFallbackTitleFromContent, isPlaceholderConversationTitle } from './liveSessionTitle.js';
import { OVERSIZED_TOOL_OUTPUT_MAX_CHARS, presentTranscriptErrorMessage, truncateOversizedToolOutput } from './toolResultPresentation.js';

export interface LiveSessionMessageAppendHost {
  sessionId: string;
  session: AgentSession;
  title: string;
}

const RELATED_CONVERSATION_POINTERS_CUSTOM_TYPE = 'related_conversation_pointers';
const HIDDEN_CUSTOM_BRANCH_TYPES = new Set(['child_conversation_topology', 'parent_conversation_backlink']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHiddenCustomBranchEntry(entry: unknown): boolean {
  if (!isRecord(entry) || entry.type !== 'custom_message') return false;
  const customType = typeof entry.customType === 'string' ? entry.customType : '';
  return entry.display !== true || HIDDEN_CUSTOM_BRANCH_TYPES.has(customType);
}

function moveLeafToVisibleCustomParent(entry: LiveSessionMessageAppendHost): void {
  const manager = entry.session.sessionManager as
    | {
        getLeafEntry?: () => unknown;
        getEntry?: (id: string) => unknown;
        branch?: (id: string) => void;
        resetLeaf?: () => void;
      }
    | undefined;
  if (typeof manager?.getLeafEntry !== 'function') return;

  let leafEntry = manager.getLeafEntry();
  if (!isHiddenCustomBranchEntry(leafEntry)) return;

  while (isHiddenCustomBranchEntry(leafEntry)) {
    if (!isRecord(leafEntry)) return;
    const parentId = typeof leafEntry.parentId === 'string' && leafEntry.parentId.trim() ? leafEntry.parentId.trim() : null;
    if (!parentId) {
      manager.resetLeaf?.();
      return;
    }
    const parentEntry = typeof manager.getEntry === 'function' ? manager.getEntry(parentId) : null;
    if (!isHiddenCustomBranchEntry(parentEntry)) {
      manager.branch?.(parentId);
      return;
    }
    leafEntry = parentEntry;
  }
}

function hasQueuedPromptContext(entry: LiveSessionMessageAppendHost, customType: string): boolean {
  if (customType !== RELATED_CONVERSATION_POINTERS_CUSTOM_TYPE) {
    return false;
  }

  const messages = Array.isArray(entry.session.state?.messages) ? entry.session.state.messages : [];
  return messages.some((message) => isRecord(message) && message.role === 'custom' && message.customType === customType);
}

function createZeroUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

export async function queueLiveSessionPromptContext(
  entry: LiveSessionMessageAppendHost,
  customType: string,
  content: string,
): Promise<void> {
  const message = content.trim();
  if (!message || hasQueuedPromptContext(entry, customType)) {
    return;
  }

  const customMessage = {
    customType,
    content: message,
    display: false,
    details: undefined,
  };

  if (entry.session.isStreaming) {
    await entry.session.sendCustomMessage(customMessage, {
      deliverAs: 'nextTurn',
    });
    return;
  }

  await entry.session.sendCustomMessage(customMessage);
}

export async function appendDetachedLiveSessionUserMessage<TEntry extends LiveSessionMessageAppendHost>(
  entry: TEntry,
  text: string,
  callbacks: {
    broadcastTitle: (entry: TEntry) => void;
    publishSessionMetaChanged: (sessionId: string) => void;
  },
): Promise<void> {
  if (entry.session.isStreaming) {
    throw new Error(`Session ${entry.sessionId} is currently streaming`);
  }

  const normalizedText = text.trim();
  if (!normalizedText) {
    return;
  }

  const message = {
    role: 'user' as const,
    content: [{ type: 'text' as const, text: normalizedText }],
    timestamp: Date.now(),
  };

  entry.session.state.messages = [...entry.session.state.messages, message];
  entry.session.sessionManager.appendMessage(message);

  if (!entry.session.sessionName?.trim() && isPlaceholderConversationTitle(entry.title)) {
    const fallbackTitle = buildFallbackTitleFromContent(message.content);
    if (fallbackTitle) {
      entry.title = fallbackTitle;
      callbacks.broadcastTitle(entry);
    }
  }

  callbacks.publishSessionMetaChanged(entry.sessionId);
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!isRecord(part)) return '';
      return typeof part.text === 'string' ? part.text : '';
    })
    .join('')
    .trim();
}

export function appendDetachedLiveSessionAssistantError<TEntry extends LiveSessionMessageAppendHost>(
  entry: TEntry,
  input: { promptText: string; errorMessage: string },
  callbacks: {
    broadcastTitle: (entry: TEntry) => void;
    publishSessionMetaChanged: (sessionId: string) => void;
  },
): void {
  if (entry.session.isStreaming) {
    throw new Error(`Session ${entry.sessionId} is currently streaming`);
  }

  const normalizedPrompt = input.promptText.trim();
  const normalizedError =
    presentTranscriptErrorMessage(input.errorMessage.trim()) || 'The model could not start. Configure a model provider, then try again.';
  if (!normalizedPrompt && !normalizedError) {
    return;
  }

  const messages = Array.isArray(entry.session.state?.messages) ? entry.session.state.messages : [];
  const lastUser = [...messages].reverse().find((message) => isRecord(message) && message.role === 'user');
  const shouldAppendUser =
    normalizedPrompt.length > 0 && (!lastUser || extractTextContent((lastUser as { content?: unknown }).content) !== normalizedPrompt);

  if (shouldAppendUser) {
    const userMessage = {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: normalizedPrompt }],
      timestamp: Date.now(),
    };
    entry.session.state.messages = [...entry.session.state.messages, userMessage];
    entry.session.sessionManager?.appendMessage?.(userMessage);

    if (!entry.session.sessionName?.trim() && isPlaceholderConversationTitle(entry.title)) {
      const fallbackTitle = buildFallbackTitleFromContent(userMessage.content);
      if (fallbackTitle) {
        entry.title = fallbackTitle;
        callbacks.broadcastTitle(entry);
      }
    }
  }

  const assistantMessage = {
    role: 'assistant' as const,
    content: [] as Array<{ type: 'text'; text: string }>,
    api: entry.session.model?.api ?? 'unknown',
    provider: entry.session.model?.provider ?? 'unknown',
    model: entry.session.model?.id ?? 'unknown',
    usage: createZeroUsage(),
    stopReason: 'error' as const,
    errorMessage: normalizedError,
    timestamp: Date.now(),
  };
  entry.session.state.messages = [...entry.session.state.messages, assistantMessage];
  entry.session.sessionManager?.appendMessage?.(assistantMessage);
  callbacks.publishSessionMetaChanged(entry.sessionId);
}

export function appendDetachedLiveSessionBashExecution<TEntry extends LiveSessionMessageAppendHost>(
  entry: TEntry,
  command: string,
  result: {
    output?: unknown;
    exitCode?: unknown;
    cancelled?: unknown;
    truncated?: unknown;
    fullOutputPath?: unknown;
  },
  options: { excludeFromContext?: boolean } = {},
): void {
  if (entry.session.isStreaming) {
    throw new Error(`Session ${entry.sessionId} is currently streaming`);
  }

  const normalizedCommand = command.trim();
  if (!normalizedCommand) {
    return;
  }

  const rawOutput = typeof result.output === 'string' ? result.output : '';
  const output = truncateOversizedToolOutput(rawOutput);
  const details = output.truncated
    ? {
        contextHardening: {
          truncated: true,
          originalChars: output.originalChars,
          maxChars: OVERSIZED_TOOL_OUTPUT_MAX_CHARS,
        },
      }
    : undefined;

  const message = {
    role: 'bashExecution' as const,
    command: normalizedCommand,
    output: output.output,
    exitCode: typeof result.exitCode === 'number' ? result.exitCode : undefined,
    cancelled: result.cancelled === true,
    truncated: result.truncated === true || output.truncated,
    timestamp: Date.now(),
    ...(details ? { details } : {}),
    ...(typeof result.fullOutputPath === 'string' && result.fullOutputPath.trim().length > 0
      ? { fullOutputPath: result.fullOutputPath }
      : {}),
    ...(options.excludeFromContext === true ? { excludeFromContext: true } : {}),
  };

  entry.session.state.messages = [...entry.session.state.messages, message];
  entry.session.sessionManager.appendMessage(message);
}

export async function appendVisibleLiveSessionCustomMessage<TEntry extends LiveSessionMessageAppendHost>(
  entry: TEntry,
  customType: string,
  content: string,
  details: unknown,
  callbacks: {
    broadcastSnapshot: (entry: TEntry) => void;
    publishSessionMetaChanged: (sessionId: string) => void;
  },
  options: { blockId?: string } = {},
): Promise<string | null> {
  if (entry.session.isStreaming) {
    throw new Error(`Session ${entry.sessionId} is currently streaming`);
  }

  const message = content.trim();
  if (!message) {
    return null;
  }

  const blockId = options.blockId ?? `${customType}:${Date.now()}`;
  const customMessage = {
    customType,
    content: message,
    display: true,
    details: { ...(isRecord(details) ? details : { value: details }), extensionBlockId: blockId },
  };
  moveLeafToVisibleCustomParent(entry);
  await entry.session.sendCustomMessage(customMessage);
  callbacks.broadcastSnapshot(entry);
  callbacks.publishSessionMetaChanged(entry.sessionId);
  return blockId;
}

export function updateVisibleLiveSessionCustomMessage<TEntry extends LiveSessionMessageAppendHost>(
  entry: TEntry,
  blockId: string,
  customType: string,
  content: string,
  details: unknown,
  callbacks: {
    broadcastSnapshot: (entry: TEntry) => void;
    publishSessionMetaChanged: (sessionId: string) => void;
  },
): boolean {
  if (entry.session.isStreaming) {
    throw new Error(`Session ${entry.sessionId} is currently streaming`);
  }

  const message = content.trim();
  if (!message) return false;

  let updated = false;
  entry.session.state.messages = entry.session.state.messages.map((candidate) => {
    if (!isRecord(candidate) || candidate.role !== 'custom' || candidate.customType !== customType) return candidate;
    const candidateDetails = isRecord(candidate.details) ? candidate.details : {};
    if (candidateDetails.extensionBlockId !== blockId) return candidate;
    updated = true;
    return {
      ...candidate,
      content: message,
      details: { ...(isRecord(details) ? details : { value: details }), extensionBlockId: blockId },
      timestamp: Date.now(),
    };
  });

  if (updated) {
    callbacks.broadcastSnapshot(entry);
    callbacks.publishSessionMetaChanged(entry.sessionId);
  }
  return updated;
}

export async function appendParallelImportedLiveSessionMessage<TEntry extends LiveSessionMessageAppendHost>(
  entry: TEntry,
  content: string,
  details: { childConversationId: string; status: 'complete' | 'failed' },
  callbacks: {
    appendDetachedUserMessage: (entry: TEntry, text: string) => Promise<void>;
    broadcastSnapshot: (entry: TEntry) => void;
    publishSessionMetaChanged: (sessionId: string) => void;
  },
): Promise<void> {
  await callbacks.appendDetachedUserMessage(entry, content);

  const customMessage = {
    customType: 'parallel_result',
    content: `Imported parallel response from ${details.childConversationId}.`,
    display: true,
    details,
  };
  await entry.session.sendCustomMessage(customMessage);
  callbacks.broadcastSnapshot(entry);
  callbacks.publishSessionMetaChanged(entry.sessionId);
}
