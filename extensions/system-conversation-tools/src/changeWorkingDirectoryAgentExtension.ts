import type { ExtensionAPI } from '@neon-pilot/extensions';
import { resolveExistingConversationDirectory } from '@neon-pilot/extensions/backend/conversations';

export const ChangeWorkingDirectoryToolParams = {
  type: 'object',
  properties: {
    cwd: {
      type: 'string',
      description: 'Target working directory. Relative paths resolve from the current conversation cwd.',
    },
    continuePrompt: {
      type: 'string',
      description: 'Optional prompt to continue automatically in the new working directory after the switch completes.',
    },
  },
  required: ['cwd'],
} as const;

export interface RequestConversationWorkingDirectoryChangeInput {
  conversationId: string;
  cwd: string;
  continuePrompt?: string;
}

export interface RequestConversationWorkingDirectoryChangeResult {
  conversationId: string;
  cwd: string;
  queued: boolean;
  unchanged?: boolean;
}

function isAbsoluteLikeCwd(cwd: string): boolean {
  return /^(?:~(?:\/|$)|\/|[a-zA-Z]:[\\/])/.test(cwd.trim());
}

function readSessionRecordCwd(session: unknown, conversationId: string): string | undefined {
  if (!session || typeof session !== 'object') {
    return undefined;
  }

  const record = session as { id?: unknown; conversationId?: unknown; cwd?: unknown };
  const id = typeof record.id === 'string' ? record.id : typeof record.conversationId === 'string' ? record.conversationId : '';
  if (id !== conversationId) {
    return undefined;
  }

  return typeof record.cwd === 'string' && record.cwd.trim().length > 0 ? record.cwd : undefined;
}

function readSessionList(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object' && Array.isArray((value as { sessions?: unknown }).sessions)) {
    return (value as { sessions: unknown[] }).sessions;
  }

  return undefined;
}

async function readTargetConversationCwd(
  conversationId: string,
  readConversationSessions?: () => Promise<unknown>,
): Promise<string | undefined> {
  if (!readConversationSessions) {
    return undefined;
  }

  const sessions = readSessionList(await readConversationSessions());
  if (!sessions) {
    return undefined;
  }

  for (const session of sessions) {
    const cwd = readSessionRecordCwd(session, conversationId);
    if (cwd) {
      return cwd;
    }
  }

  return undefined;
}

function readRequiredString(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

export async function executeChangeWorkingDirectory(
  params: { conversationId?: string; cwd?: string; continuePrompt?: string },
  ctx: { sessionManager: { getSessionId(): string }; cwd?: string; readConversationSessions?: () => Promise<unknown> },
  requestConversationWorkingDirectoryChange: (
    input: RequestConversationWorkingDirectoryChangeInput,
  ) => Promise<RequestConversationWorkingDirectoryChangeResult>,
) {
  const currentConversationId = ctx.sessionManager.getSessionId()?.trim() ?? '';
  const conversationId =
    typeof params.conversationId === 'string' && params.conversationId.trim().length > 0
      ? params.conversationId.trim()
      : readRequiredString(currentConversationId, 'conversationId');
  const requestedCwd = readRequiredString(params.cwd, 'cwd');
  let baseCwd = ctx.cwd;
  if ((!baseCwd || conversationId !== currentConversationId) && !isAbsoluteLikeCwd(requestedCwd)) {
    baseCwd = await readTargetConversationCwd(conversationId, ctx.readConversationSessions);
    if (!baseCwd) {
      throw new Error(
        `Could not resolve the current working directory for conversation ${conversationId}. Use an absolute path or choose a live conversation.`,
      );
    }
  }
  const nextCwd = await resolveExistingConversationDirectory(requestedCwd, baseCwd);

  const continuePrompt =
    typeof params.continuePrompt === 'string' && params.continuePrompt.trim().length > 0 ? params.continuePrompt.trim() : undefined;

  let result: RequestConversationWorkingDirectoryChangeResult;
  try {
    result = await requestConversationWorkingDirectoryChange({
      conversationId,
      cwd: nextCwd,
      ...(continuePrompt ? { continuePrompt } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === `Session ${conversationId} is not live.`) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Cannot change the working directory because this conversation is not currently live. Start or resume the conversation in the UI, then try again.',
          },
        ],
        details: {
          action: 'unavailable',
          reason: 'session_not_live',
          conversationId,
          cwd: nextCwd,
          queued: false,
        },
      };
    }
    throw error;
  }

  if (result.unchanged) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Already using working directory ${result.cwd}.`,
        },
      ],
      details: {
        action: 'noop',
        conversationId,
        cwd: result.cwd,
        queued: false,
        unchanged: true,
      },
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: continuePrompt
          ? `Queued working directory change to ${result.cwd}. This conversation will move there after this turn and continue automatically.`
          : `Queued working directory change to ${result.cwd}. This conversation will move there after this turn.`,
      },
    ],
    details: {
      action: 'queue',
      conversationId,
      cwd: result.cwd,
      queued: result.queued,
      continuePrompt: Boolean(continuePrompt),
    },
  };
}

export function createChangeWorkingDirectoryAgentExtension(options: {
  requestConversationWorkingDirectoryChange: (
    input: RequestConversationWorkingDirectoryChangeInput,
  ) => Promise<RequestConversationWorkingDirectoryChangeResult>;
}): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    pi.registerTool({
      name: 'change_working_directory',
      label: 'Change Working Directory',
      description:
        'Change the current conversation working directory. The switch happens after the current turn and keeps the same conversation attached to the requested directory.',
      promptSnippet: 'Change the current conversation working directory to target a different repo or folder.',
      promptGuidelines: [
        'Switch to a target repo root before modifying it so its AGENTS.md loads; the change applies after this turn, so stop or use continuePrompt to resume there.',
      ],
      parameters: ChangeWorkingDirectoryToolParams,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        return executeChangeWorkingDirectory(params, ctx, options.requestConversationWorkingDirectoryChange);
      },
    });
  };
}
