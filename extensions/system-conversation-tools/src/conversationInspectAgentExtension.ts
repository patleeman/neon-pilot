import type { ExtensionAPI } from '@neon-pilot/extensions';
import {
  CONVERSATION_INSPECT_ACTION_VALUES,
  CONVERSATION_INSPECT_BLOCK_TYPE_VALUES,
  CONVERSATION_INSPECT_ORDER_VALUES,
  CONVERSATION_INSPECT_ROLE_VALUES,
  CONVERSATION_INSPECT_SCOPE_VALUES,
  CONVERSATION_INSPECT_SEARCH_MODE_VALUES,
  executeConversationInspect,
  persistTraceContextPointerInspect,
  querySessionSuggestedPointerIds,
  readConversationSessionsCapability,
} from '@neon-pilot/extensions/backend/conversations';

export const ConversationInspectToolParams = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: CONVERSATION_INSPECT_ACTION_VALUES,
      description: `Action to perform. Valid values: ${CONVERSATION_INSPECT_ACTION_VALUES.join(', ')}.`,
    },
    conversationId: { type: 'string', description: 'Required conversation id for query, outline, read_window, and diff actions.' },
    scope: { type: 'string', description: `List scope. Valid values: ${CONVERSATION_INSPECT_SCOPE_VALUES.join(', ')}.` },
    cwd: { type: 'string', description: 'Optional cwd filter for list actions.' },
    query: {
      type: 'string',
      description: 'Query string for list/search actions. List matches metadata; search matches visible transcript text.',
    },
    includeCurrent: { type: 'boolean', description: 'Whether list should include the current conversation. Defaults to false.' },
    types: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: `Optional structural transcript block types to include. Valid values: ${CONVERSATION_INSPECT_BLOCK_TYPE_VALUES.join(
        ', ',
      )}. Use roles for user/assistant filtering.`,
      minItems: 1,
    },
    roles: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: `Optional conversational roles to include. Valid values: ${CONVERSATION_INSPECT_ROLE_VALUES.join(
        ', ',
      )}. assistant maps to text blocks; tool maps to tool_use blocks.`,
      minItems: 1,
    },
    tools: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'Optional tool names to match for tool_use/error blocks.',
      minItems: 1,
    },
    text: { type: 'string', description: 'Case-insensitive transcript text filter.' },
    searchMode: {
      type: 'string',
      description: `How query/text matching works. Valid values: ${CONVERSATION_INSPECT_SEARCH_MODE_VALUES.join(
        ', ',
      )}. Default phrase; allTerms/anyTerm split on whitespace.`,
    },
    afterBlockId: { type: 'string', description: 'Only include transcript blocks after this block id.' },
    beforeBlockId: { type: 'string', description: 'Only include transcript blocks before this block id.' },
    aroundBlockId: { type: 'string', description: 'Restrict query results to a context window around this block id.' },
    knownSignature: { type: 'string', description: 'Last seen conversation signature for diff checks.' },
    order: { type: 'string', description: `Block order for query results. Valid values: ${CONVERSATION_INSPECT_ORDER_VALUES.join(', ')}.` },
    limit: { type: 'number', minimum: 1, maximum: 200, description: 'Maximum items to return.' },
    window: { type: 'number', minimum: 1, maximum: 50, description: 'Context window size for aroundBlockId queries.' },
    includeAroundMatches: {
      type: 'boolean',
      description: 'When searching or querying with filters, include surrounding context blocks around each match using window.',
    },
    maxCharactersPerBlock: { type: 'number', minimum: 1, maximum: 20000, description: 'Character cap per returned block.' },
    maxSnippetCharacters: { type: 'number', minimum: 1, maximum: 2000, description: 'Character cap per returned search snippet.' },
  },
  required: ['action'],
} as const;

interface WorkerConversationInspectSessionSnapshotEntry {
  id: string;
  title: string;
  cwd: string;
  file: string;
  timestamp: string;
  lastActivityAt?: string;
  isLive: boolean;
  isRunning: boolean;
  isArchived: boolean;
  messageCount: number;
}

interface ConversationInspectToolContext {
  sessionManager: { getSessionId(): string };
  conversations?: {
    getWorkspace?: () => Promise<unknown>;
  };
}

function readWorkspaceConversationIds(workspace: unknown): { openIds: Set<string>; pinnedIds: Set<string>; archivedIds: Set<string> } {
  const readIds = (key: string) =>
    new Set(
      workspace && typeof workspace === 'object' && Array.isArray((workspace as Record<string, unknown>)[key])
        ? ((workspace as Record<string, unknown>)[key] as unknown[]).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [],
    );
  return {
    openIds: readIds('openConversationIds'),
    pinnedIds: readIds('pinnedConversationIds'),
    archivedIds: readIds('archivedConversationIds'),
  };
}

async function readWorkspaceConversationState(ctx?: ConversationInspectToolContext) {
  if (typeof ctx?.conversations?.getWorkspace !== 'function') {
    return undefined;
  }
  try {
    return readWorkspaceConversationIds(await ctx.conversations.getWorkspace());
  } catch {
    return undefined;
  }
}

async function buildWorkerConversationInspectSessionSnapshot(
  conversationId?: string,
  ctx?: ConversationInspectToolContext,
): Promise<WorkerConversationInspectSessionSnapshotEntry[] | undefined> {
  try {
    const [sessions, workspace] = await Promise.all([readConversationSessionsCapability(), readWorkspaceConversationState(ctx)]);
    return sessions
      .filter((session) => !conversationId || session.id === conversationId)
      .map((session) => {
        const visibleInWorkspace = Boolean(
          workspace && !workspace.archivedIds.has(session.id) && (workspace.openIds.has(session.id) || workspace.pinnedIds.has(session.id)),
        );
        return {
          id: session.id,
          title: session.title,
          cwd: session.cwd,
          file: session.file,
          timestamp: session.timestamp,
          ...(session.lastActivityAt ? { lastActivityAt: session.lastActivityAt } : {}),
          isLive: Boolean(session.isLive) || visibleInWorkspace,
          isRunning: Boolean(session.isRunning),
          isArchived: Boolean(workspace?.archivedIds.has(session.id)),
          messageCount: session.messageCount,
        };
      });
  } catch {
    return undefined;
  }
}

function hasSuggestedConversationId(suggestedIds: unknown, conversationId: string): boolean {
  if (suggestedIds instanceof Set) return suggestedIds.has(conversationId);
  if (Array.isArray(suggestedIds)) return suggestedIds.includes(conversationId);
  if (suggestedIds && typeof suggestedIds === 'object' && typeof (suggestedIds as { has?: unknown }).has === 'function') {
    return Boolean((suggestedIds as { has: (id: string) => boolean }).has(conversationId));
  }
  return false;
}

async function trackContextPointerInspect(currentSessionId: string, targetConversationId: string): Promise<void> {
  try {
    const suggestedIds = await querySessionSuggestedPointerIds(currentSessionId);
    await persistTraceContextPointerInspect({
      sessionId: currentSessionId,
      inspectedConversationId: targetConversationId,
      wasSuggested: hasSuggestedConversationId(suggestedIds, targetConversationId),
    });
  } catch {
    // Telemetry should never break the read-only inspect tool.
  }
}

export async function executeConversationInspectTool(params: Record<string, unknown>, ctx: ConversationInspectToolContext) {
  const workerParams: Record<string, unknown> = { ...params };
  delete workerParams.action;
  const currentSessionId = ctx.sessionManager.getSessionId();
  const targetConversationId = typeof params.conversationId === 'string' ? params.conversationId.trim() : '';

  if (params.action === 'list' || params.action === 'search') {
    workerParams.currentConversationId = currentSessionId;
    const sessionSnapshot = await buildWorkerConversationInspectSessionSnapshot(undefined, ctx);
    if (sessionSnapshot !== undefined) {
      workerParams.sessionSnapshot = sessionSnapshot;
    }
  } else if (targetConversationId) {
    const sessionSnapshot = await buildWorkerConversationInspectSessionSnapshot(targetConversationId, ctx);
    if (sessionSnapshot !== undefined) {
      workerParams.sessionSnapshot = sessionSnapshot;
    }
  }

  const { action, result, text } = await executeConversationInspect(params.action as string, workerParams);

  if (targetConversationId && currentSessionId) {
    void trackContextPointerInspect(currentSessionId, targetConversationId);
  }

  return {
    content: [{ type: 'text' as const, text }],
    details: {
      action,
      ...(result as Record<string, unknown>),
    },
  };
}

export function createConversationInspectAgentExtension(): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    pi.registerTool({
      name: 'conversation_inspect',
      label: 'Conversation Inspect',
      description: 'List other conversations and query their visible transcript blocks.',
      promptSnippet: 'Inspect other conversations through read-only transcript queries.',
      promptGuidelines: [
        'read-only cross-conversation inspection: list first, then query/outline/read_window/diff with conversationId; hidden reasoning is not available.',
      ],
      parameters: ConversationInspectToolParams,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        return executeConversationInspectTool(params, ctx);
      },
    });
  };
}
