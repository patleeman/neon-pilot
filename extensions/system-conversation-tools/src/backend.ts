import type { ExtensionBackendContext } from '@personal-agent/extensions';
import {
  buildLiveSessionExtensionFactoriesForRuntime,
  buildLiveSessionResourceOptionsForRuntime,
  requestConversationWorkingDirectoryChange,
} from '@personal-agent/extensions/backend/conversations';

import { deferredResume } from '../../system-automations/src/conversationQueueBackend.js';
import { executeAskUserQuestion } from './askUserQuestionAgentExtension.js';
import {
  executeChangeWorkingDirectory,
  type RequestConversationWorkingDirectoryChangeResult,
} from './changeWorkingDirectoryAgentExtension.js';
import { executeConversationInspectTool } from './conversationInspectAgentExtension.js';
import { executeSetConversationTitle } from './conversationTitleAgentExtension.js';
import { CONVERSATION_ACTIONS, type ConversationAction } from './conversationToolSchema.js';

type ConversationContextMenuInput = { conversationId?: string; sessionTitle?: string; cwd?: string };

export async function duplicateConversation(input: ConversationContextMenuInput, ctx: ExtensionBackendContext) {
  ctx.log.info('context menu: duplicate conversation', {
    conversationId: input.conversationId,
    title: input.sessionTitle,
  });
  return { ok: true, conversationId: input.conversationId };
}

export async function copyWorkingDirectory(input: ConversationContextMenuInput, ctx: ExtensionBackendContext) {
  ctx.log.info('context menu: copy working directory', {
    conversationId: input.conversationId,
    title: input.sessionTitle,
  });
  return { ok: true, cwd: input.cwd };
}

export async function copyConversationId(input: ConversationContextMenuInput, ctx: ExtensionBackendContext) {
  ctx.log.info('context menu: copy conversation id', {
    conversationId: input.conversationId,
    title: input.sessionTitle,
  });
  return { ok: true, conversationId: input.conversationId };
}

export async function copyDeeplink(input: ConversationContextMenuInput, ctx: ExtensionBackendContext) {
  ctx.log.info('context menu: copy deeplink', {
    conversationId: input.conversationId,
    title: input.sessionTitle,
  });
  return { ok: true, conversationId: input.conversationId };
}

function readAction(params: unknown): ConversationAction {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('conversation action is required.');
  }
  const action = (params as { action?: unknown }).action;
  if (CONVERSATION_ACTIONS.includes(action as ConversationAction)) {
    return action as ConversationAction;
  }
  throw new Error(`Unsupported conversation action: ${String(action)}`);
}

function payloadWithoutAction(params: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...params };
  delete payload.action;
  return payload;
}

function conversationInspectPayload(params: Record<string, unknown>): Record<string, unknown> {
  const payload = payloadWithoutAction(params);
  if (typeof payload.inspectAction === 'string') {
    payload.action = payload.inspectAction;
  }
  delete payload.inspectAction;
  return payload;
}

export async function conversationTool(input: unknown, ctx: ExtensionBackendContext) {
  const toolCtx = ctx.toolContext;
  const conversationId = toolCtx?.conversationId ?? toolCtx?.sessionId ?? '';

  const sessionManagerCtx = {
    sessionManager: {
      getSessionId: () => conversationId,
      getSessionFile: () => toolCtx?.sessionFile,
      getCwd: () => toolCtx?.cwd,
    },
    cwd: toolCtx?.cwd,
  };

  const action = readAction(input);
  const params = input as Record<string, unknown>;
  const payload = payloadWithoutAction(params);

  switch (action) {
    case 'ask':
      return executeAskUserQuestion(payload, sessionManagerCtx);

    case 'inspect':
      return executeConversationInspectTool(conversationInspectPayload(params), sessionManagerCtx);

    case 'set_title':
      return executeSetConversationTitle(payload, sessionManagerCtx, (title) => ctx.conversations.setTitle(conversationId, title));

    case 'change_working_directory':
      return executeChangeWorkingDirectory(
        payload,
        sessionManagerCtx,
        (changeInput) =>
          requestConversationWorkingDirectoryChange(changeInput, {
            ...buildLiveSessionResourceOptionsForRuntime(),
            extensionFactories: buildLiveSessionExtensionFactoriesForRuntime(),
          }) as Promise<RequestConversationWorkingDirectoryChangeResult>,
      );

    case 'deferred_resume': {
      const { deferredAction, ...resumePayload } = payload;
      const result = await deferredResume({ ...resumePayload, action: deferredAction } as never, {
        profile: ctx.profile,
        toolContext: {
          sessionId: conversationId,
          sessionFile: toolCtx?.sessionFile,
          cwd: toolCtx?.cwd,
        },
      });
      return {
        content: [{ type: 'text' as const, text: (result as { text: string }).text }],
        details: result,
      };
    }
  }
}
