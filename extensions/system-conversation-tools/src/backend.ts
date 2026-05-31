import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import {
  buildLiveSessionExtensionFactoriesForRuntime,
  buildLiveSessionResourceOptionsForRuntime,
  requestConversationWorkingDirectoryChange,
} from '@neon-pilot/extensions/backend/conversations';

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

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredString(params: Record<string, unknown>, key: string): string {
  const value = optionalString(params[key]);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

function optionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value > 0 ? value : undefined;
}

function readImages(value: unknown): Array<{ data: string; mimeType: string; name?: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const images = value
    .map((image) => {
      if (!image || typeof image !== 'object' || Array.isArray(image)) return null;
      const data = optionalString((image as { data?: unknown }).data);
      const mimeType = optionalString((image as { mimeType?: unknown }).mimeType);
      if (!data || !mimeType) return null;
      const name = optionalString((image as { name?: unknown }).name);
      return { data, mimeType, ...(name ? { name } : {}) };
    })
    .filter((image): image is { data: string; mimeType: string; name?: string } => Boolean(image));
  return images.length > 0 ? images : undefined;
}

function conversationSendOptions(params: Record<string, unknown>) {
  return {
    ...(typeof params.steer === 'boolean' ? { steer: params.steer } : {}),
    ...(readImages(params.images) ? { images: readImages(params.images) } : {}),
  };
}

function conversationCreateInput(params: Record<string, unknown>) {
  return {
    ...(optionalString(params.title) ? { title: optionalString(params.title) } : {}),
    ...(optionalString(params.cwd) ? { cwd: optionalString(params.cwd) } : {}),
    ...(typeof params.live === 'boolean' ? { live: params.live } : {}),
    ...(optionalString(params.initialPrompt) ? { initialPrompt: optionalString(params.initialPrompt) } : {}),
    ...(optionalString(params.prompt) ? { prompt: optionalString(params.prompt) } : {}),
    ...(optionalString(params.model) ? { model: optionalString(params.model) } : {}),
    ...(optionalString(params.thinkingLevel) ? { thinkingLevel: optionalString(params.thinkingLevel) } : {}),
    ...(optionalString(params.serviceTier) ? { serviceTier: optionalString(params.serviceTier) } : {}),
    ...(optionalStringArray(params.allowedToolNames) ? { allowedToolNames: optionalStringArray(params.allowedToolNames) } : {}),
  };
}

function workspaceUpdateInput(params: Record<string, unknown>) {
  return {
    ...(Array.isArray(params.openConversationIds) ? { openConversationIds: optionalStringArray(params.openConversationIds) ?? [] } : {}),
    ...(Array.isArray(params.pinnedConversationIds) ? { pinnedConversationIds: optionalStringArray(params.pinnedConversationIds) ?? [] } : {}),
    ...(Array.isArray(params.archivedConversationIds) ? { archivedConversationIds: optionalStringArray(params.archivedConversationIds) ?? [] } : {}),
    ...(params.activeConversationId !== undefined ? { activeConversationId: optionalString(params.activeConversationId) ?? null } : {}),
    ...(Array.isArray(params.workspacePaths) ? { workspacePaths: optionalStringArray(params.workspacePaths) ?? [] } : {}),
    ...(Array.isArray(params.remoteControlledConversationIds)
      ? { remoteControlledConversationIds: optionalStringArray(params.remoteControlledConversationIds) ?? [] }
      : {}),
  };
}

function toolResult(action: string, details: unknown) {
  return {
    content: [{ type: 'text' as const, text: `${action} complete.` }],
    details,
  };
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
      return executeSetConversationTitle(payload, sessionManagerCtx, (title) =>
        ctx.conversations.setTitle(optionalString(payload.conversationId) ?? conversationId, title),
      );

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

    case 'create':
      return toolResult(action, await ctx.conversations.create(conversationCreateInput(payload)));

    case 'ensure_live':
      return toolResult(
        action,
        await ctx.conversations.ensureLive(requiredString(payload, 'conversationId'), optionalString(payload.cwd) ? { cwd: optionalString(payload.cwd) } : undefined),
      );

    case 'send_message':
      return toolResult(
        action,
        await ctx.conversations.sendMessage(requiredString(payload, 'conversationId'), requiredString(payload, 'text'), conversationSendOptions(payload)),
      );

    case 'run_turn':
      return toolResult(
        action,
        await ctx.conversations.runTurn(requiredString(payload, 'conversationId'), requiredString(payload, 'text'), {
          ...conversationSendOptions(payload),
          ...(optionalString(payload.cwd) ? { cwd: optionalString(payload.cwd) } : {}),
          ...(optionalPositiveNumber(payload.timeoutMs) ? { timeoutMs: optionalPositiveNumber(payload.timeoutMs) } : {}),
        }),
      );

    case 'abort':
      return toolResult(action, await ctx.conversations.abort(requiredString(payload, 'conversationId')));

    case 'compact':
      return toolResult(
        action,
        await ctx.conversations.compact(requiredString(payload, 'conversationId'), optionalString(payload.customInstructions)),
      );

    case 'fork':
      return toolResult(
        action,
        await ctx.conversations.fork({
          conversationId: requiredString(payload, 'conversationId'),
          ...(optionalString(payload.targetCwd) ? { targetCwd: optionalString(payload.targetCwd) } : {}),
          ...(optionalString(payload.cwd) ? { cwd: optionalString(payload.cwd) } : {}),
          ...(optionalString(payload.title) ? { title: optionalString(payload.title) } : {}),
        }),
      );

    case 'set_active_tools':
      return toolResult(
        action,
        await ctx.conversations.setActiveTools(requiredString(payload, 'conversationId'), optionalStringArray(payload.toolNames) ?? []),
      );

    case 'workspace_get':
      return toolResult(action, await ctx.conversations.getWorkspace());

    case 'workspace_update':
      return toolResult(action, await ctx.conversations.updateWorkspace(workspaceUpdateInput(payload)));

    case 'append_transcript_block':
      return toolResult(
        action,
        await ctx.conversations.appendTranscriptBlock({
          conversationId: requiredString(payload, 'conversationId'),
          blockType: requiredString(payload, 'blockType'),
          data: payload.data,
          ...(optionalString(payload.title) ? { title: optionalString(payload.title) } : {}),
          ...(optionalString(payload.blockId) ? { blockId: optionalString(payload.blockId) } : {}),
        }),
      );

    case 'update_transcript_block':
      return toolResult(
        action,
        await ctx.conversations.updateTranscriptBlock({
          conversationId: requiredString(payload, 'conversationId'),
          blockType: requiredString(payload, 'blockType'),
          blockId: requiredString(payload, 'blockId'),
          data: payload.data,
          ...(optionalString(payload.title) ? { title: optionalString(payload.title) } : {}),
        }),
      );

    case 'rollback':
      return toolResult(
        action,
        await ctx.conversations.rollback(requiredString(payload, 'conversationId'), optionalPositiveNumber(payload.count) ?? 1),
      );
  }
}

function toolSessionManagerCtx(ctx: ExtensionBackendContext) {
  const toolCtx = ctx.toolContext;
  const conversationId = toolCtx?.conversationId ?? toolCtx?.sessionId ?? '';

  return {
    conversationId,
    sessionManagerCtx: {
      sessionManager: {
        getSessionId: () => conversationId,
        getSessionFile: () => toolCtx?.sessionFile,
        getCwd: () => toolCtx?.cwd,
      },
      cwd: toolCtx?.cwd,
    },
  };
}

export async function askUser(input: unknown, ctx: ExtensionBackendContext) {
  const { sessionManagerCtx } = toolSessionManagerCtx(ctx);
  return executeAskUserQuestion(input, sessionManagerCtx);
}

export async function conversationInspect(input: unknown, ctx: ExtensionBackendContext) {
  const { sessionManagerCtx } = toolSessionManagerCtx(ctx);
  return executeConversationInspectTool(input as Record<string, unknown>, sessionManagerCtx);
}

export async function conversationTitle(input: unknown, ctx: ExtensionBackendContext) {
  const { conversationId, sessionManagerCtx } = toolSessionManagerCtx(ctx);
  return executeSetConversationTitle(input as { title?: string }, sessionManagerCtx, (title) =>
    ctx.conversations.setTitle(conversationId, title),
  );
}

export async function conversationCwd(input: unknown, ctx: ExtensionBackendContext) {
  const { sessionManagerCtx } = toolSessionManagerCtx(ctx);
  return executeChangeWorkingDirectory(
    input as { cwd?: string; continuePrompt?: string },
    sessionManagerCtx,
    (changeInput) =>
      requestConversationWorkingDirectoryChange(changeInput, {
        ...buildLiveSessionResourceOptionsForRuntime(),
        extensionFactories: buildLiveSessionExtensionFactoriesForRuntime(),
      }) as Promise<RequestConversationWorkingDirectoryChangeResult>,
  );
}

export async function deferredResumeTool(input: unknown, ctx: ExtensionBackendContext) {
  const toolCtx = ctx.toolContext;
  const conversationId = toolCtx?.conversationId ?? toolCtx?.sessionId ?? '';
  const result = await deferredResume(input as never, {
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
