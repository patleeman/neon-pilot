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
  delete payload.cli;
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) delete payload[key];
  }
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
    ...(Array.isArray(params.pinnedConversationIds)
      ? { pinnedConversationIds: optionalStringArray(params.pinnedConversationIds) ?? [] }
      : {}),
    ...(Array.isArray(params.archivedConversationIds)
      ? { archivedConversationIds: optionalStringArray(params.archivedConversationIds) ?? [] }
      : {}),
    ...(params.activeConversationId !== undefined ? { activeConversationId: optionalString(params.activeConversationId) ?? null } : {}),
    ...(Array.isArray(params.workspacePaths) ? { workspacePaths: optionalStringArray(params.workspacePaths) ?? [] } : {}),
    ...(Array.isArray(params.remoteControlledConversationIds)
      ? { remoteControlledConversationIds: optionalStringArray(params.remoteControlledConversationIds) ?? [] }
      : {}),
  };
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

async function workspaceOpenUpdate(ctx: ExtensionBackendContext, params: Record<string, unknown>) {
  const operation = requiredString(params, 'operation');
  const ids = uniqueIds(optionalStringArray(params.conversationIds) ?? []);
  const workspace = (await ctx.conversations.getWorkspace()) as {
    openConversationIds?: string[];
    pinnedConversationIds?: string[];
    archivedConversationIds?: string[];
    activeConversationId?: string | null;
  };
  const open = uniqueIds(workspace.openConversationIds ?? []);
  const pinned = uniqueIds(workspace.pinnedConversationIds ?? []);
  const archived = uniqueIds(workspace.archivedConversationIds ?? []);
  const idSet = new Set(ids);
  if (operation !== 'active' && ids.length === 0) throw new Error('At least one conversation id is required.');

  if (operation === 'add') {
    for (const id of ids) if (!open.includes(id) && !pinned.includes(id)) open.push(id);
  } else if (operation === 'remove') {
    const nextOpen = open.filter((id) => !idSet.has(id));
    const nextPinned = pinned.filter((id) => !idSet.has(id));
    return ctx.conversations.updateWorkspace({ openConversationIds: nextOpen, pinnedConversationIds: nextPinned });
  } else if (operation === 'archive') {
    for (const id of ids) if (!archived.includes(id)) archived.push(id);
    return ctx.conversations.updateWorkspace({
      openConversationIds: open.filter((id) => !idSet.has(id)),
      pinnedConversationIds: pinned.filter((id) => !idSet.has(id)),
      archivedConversationIds: archived,
      ...(idSet.has(workspace.activeConversationId ?? '') ? { activeConversationId: null } : {}),
    });
  } else if (operation === 'unarchive') {
    return ctx.conversations.updateWorkspace({ archivedConversationIds: archived.filter((id) => !idSet.has(id)) });
  } else if (operation === 'pin') {
    for (const id of ids) if (!pinned.includes(id)) pinned.push(id);
    return ctx.conversations.updateWorkspace({ openConversationIds: open.filter((id) => !idSet.has(id)), pinnedConversationIds: pinned });
  } else if (operation === 'unpin') {
    for (const id of ids) if (!open.includes(id)) open.push(id);
    return ctx.conversations.updateWorkspace({ openConversationIds: open, pinnedConversationIds: pinned.filter((id) => !idSet.has(id)) });
  } else if (operation === 'active') {
    const activeConversationId = ids[0] ?? null;
    return ctx.conversations.updateWorkspace({ activeConversationId });
  } else {
    throw new Error(`Unsupported open conversation operation: ${operation}`);
  }
  return ctx.conversations.updateWorkspace({ openConversationIds: open, pinnedConversationIds: pinned });
}

function cliCommand(input: Record<string, unknown>): string {
  const cli = input.cli && typeof input.cli === 'object' && !Array.isArray(input.cli) ? (input.cli as Record<string, unknown>) : {};
  return typeof cli.command === 'string' ? cli.command : '';
}

function cliArgs(input: Record<string, unknown>): string[] {
  const cli = input.cli && typeof input.cli === 'object' && !Array.isArray(input.cli) ? (input.cli as Record<string, unknown>) : {};
  // cli.rawArgv has the full argument list including flags; cli.args has only positionals.
  // Prefer rawArgv so flag extraction in normalizeConversationCliInput works correctly.
  if (Array.isArray(cli.rawArgv)) return cli.rawArgv.filter((arg): arg is string => typeof arg === 'string');
  if (Array.isArray(cli.args)) return cli.args.filter((arg): arg is string => typeof arg === 'string');
  return [];
}

type ParsedCliArgs = { positionals: string[]; flags: Record<string, string | boolean | string[]> };

function parseCliArgs(args: readonly string[]): ParsedCliArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean | string[]> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (!arg.startsWith('--') || arg === '--') {
      positionals.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const key = rawKey?.trim();
    if (!key) continue;
    const next = args[index + 1];
    const value = inlineValue ?? (next && !next.startsWith('--') ? next : true);
    if (value === next) index += 1;

    const previous = flags[key];
    if (previous === undefined) {
      flags[key] = value;
    } else if (Array.isArray(previous)) {
      previous.push(String(value));
    } else {
      flags[key] = [String(previous), String(value)];
    }
  }

  return { positionals, flags };
}

function flagString(flags: ParsedCliArgs['flags'], key: string): string | undefined {
  const value = flags[key];
  if (Array.isArray(value)) return value.at(-1);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function flagStringArray(flags: ParsedCliArgs['flags'], key: string): string[] | undefined {
  const value = flags[key];
  if (Array.isArray(value)) return value.map((entry) => entry.trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim())
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  return undefined;
}

function flagToolNames(flags: ParsedCliArgs['flags']): string[] | undefined {
  const names = [...(flagStringArray(flags, 'tool') ?? []), ...(flagStringArray(flags, 'tools') ?? [])];
  return names.length > 0 ? names : undefined;
}

function flagNumber(flags: ParsedCliArgs['flags'], key: string): number | undefined {
  const value = flagString(flags, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function flagBoolean(flags: ParsedCliArgs['flags'], key: string): boolean | undefined {
  const value = flags[key];
  if (value === undefined) return undefined;
  if (value === true) return true;
  if (typeof value !== 'string') return undefined;
  if (['1', 'true', 'yes'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no'].includes(value.toLowerCase())) return false;
  return undefined;
}

function parseDurationMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)?$/i.exec(value.trim());
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unit = (match[2] ?? 'ms').toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_536_000_000,
  };
  return amount * multipliers[unit];
}

function normalizeConversationCliInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input as Record<string, unknown>;
  const body = input as Record<string, unknown>;
  const command = cliCommand(body);
  const { positionals, flags } = parseCliArgs(cliArgs(body));
  if (!command) return body;
  const text = flagString(flags, 'text') ?? flagString(flags, 'prompt') ?? positionals.slice(1).join(' ');
  const promptText = flagString(flags, 'text') ?? flagString(flags, 'prompt') ?? positionals.join(' ');
  const baseInspect = {
    ...body,
    action: 'inspect',
    query: flagString(flags, 'query'),
    scope: flagString(flags, 'scope'),
    limit: flagNumber(flags, 'limit'),
    order: flagString(flags, 'order'),
    includeCurrent: flagBoolean(flags, 'include-current'),
  };
  if (command === 'conversations list')
    return { ...baseInspect, inspectAction: 'list', query: flagString(flags, 'query') ?? (positionals.join(' ') || undefined) };
  if (command === 'conversations search')
    return { ...baseInspect, inspectAction: 'search', query: flagString(flags, 'query') ?? positionals.join(' ') };
  if (command === 'conversations activity')
    return {
      ...body,
      action: 'activity',
      conversationId: positionals[0],
      active: flagBoolean(flags, 'active'),
      visibility: flagString(flags, 'visibility'),
    };
  if (command === 'conversations connections')
    return {
      ...body,
      action: 'connections',
      conversationId: positionals[0],
      active: flagBoolean(flags, 'active'),
      kind: flagString(flags, 'kind'),
      surface: flagString(flags, 'surface'),
      visibility: flagString(flags, 'visibility'),
    };
  if (command === 'conversations inspect') {
    const inspectAction = positionals[1] ?? flagString(flags, 'action') ?? 'outline';
    return {
      ...baseInspect,
      inspectAction: inspectAction === 'transcript' ? 'query' : inspectAction,
      conversationId: positionals[0],
    };
  }
  if (command === 'conversations transcript read')
    return {
      ...baseInspect,
      inspectAction: 'query',
      conversationId: positionals[0],
    };
  if (command === 'conversations create')
    return {
      ...body,
      action: 'create',
      title: flagString(flags, 'title') ?? (positionals.join(' ') || undefined),
      cwd: flagString(flags, 'cwd'),
      live: flagBoolean(flags, 'live'),
      initialPrompt: flagString(flags, 'initial-prompt') ?? flagString(flags, 'prompt'),
      model: flagString(flags, 'model'),
      thinkingLevel: flagString(flags, 'thinking-level'),
      serviceTier: flagString(flags, 'service-tier'),
      allowedToolNames: flagToolNames(flags),
    };
  if (command === 'ask')
    return {
      ...body,
      action: 'create_and_run',
      title: flagString(flags, 'title'),
      cwd: flagString(flags, 'cwd'),
      text: promptText,
      model: flagString(flags, 'model'),
      thinkingLevel: flagString(flags, 'thinking-level'),
      serviceTier: flagString(flags, 'service-tier'),
      allowedToolNames: flagToolNames(flags),
      timeoutMs: flagNumber(flags, 'timeout-ms') ?? flagNumber(flags, 'timeout'),
      follow: flagBoolean(flags, 'follow'),
      format: flagString(flags, 'format'),
      cancelOnInterrupt: flagBoolean(flags, 'cancel-on-interrupt'),
    };
  if (command === 'conversations title')
    return {
      ...body,
      action: 'set_title',
      conversationId: positionals[0],
      title: flagString(flags, 'title') ?? positionals.slice(1).join(' '),
    };
  if (command === 'conversations cwd')
    return {
      ...body,
      action: 'change_working_directory',
      conversationId: positionals[0],
      cwd: flagString(flags, 'cwd') ?? positionals[1],
      continuePrompt: flagString(flags, 'continue-prompt'),
    };
  if (command === 'conversations ensure-live')
    return { ...body, action: 'ensure_live', conversationId: positionals[0], cwd: flagString(flags, 'cwd') };
  if (command === 'conversations send')
    return { ...body, action: 'send_message', conversationId: positionals[0], text, steer: flagBoolean(flags, 'steer') };
  if (command === 'conversations run-turn')
    return {
      ...body,
      action: 'run_turn',
      conversationId: positionals[0],
      text,
      steer: flagBoolean(flags, 'steer'),
      cwd: flagString(flags, 'cwd'),
      timeoutMs: flagNumber(flags, 'timeout-ms') ?? flagNumber(flags, 'timeout'),
      follow: flagBoolean(flags, 'follow'),
      format: flagString(flags, 'format'),
      cancelOnInterrupt: flagBoolean(flags, 'cancel-on-interrupt'),
    };
  if (command === 'conversations abort') return { ...body, action: 'abort', conversationId: positionals[0] };
  if (command === 'conversations compact')
    return { ...body, action: 'compact', conversationId: positionals[0], customInstructions: flagString(flags, 'instructions') };
  if (command === 'conversations fork')
    return {
      ...body,
      action: 'fork',
      conversationId: positionals[0],
      title: flagString(flags, 'title'),
      cwd: flagString(flags, 'cwd'),
      targetCwd: flagString(flags, 'target-cwd'),
    };
  if (command === 'conversations tools')
    return {
      ...body,
      action: 'set_active_tools',
      conversationId: positionals[0],
      toolNames: flagStringArray(flags, 'tool') ?? positionals.slice(1),
    };
  if (command === 'conversations rollback')
    return {
      ...body,
      action: 'rollback',
      conversationId: positionals[0],
      count: flagNumber(flags, 'count') ?? (positionals[1] ? Number(positionals[1]) : undefined),
    };
  if (command === 'conversations workspace') return { ...body, action: 'workspace_get' };
  if (command === 'conversations workspace update')
    return {
      ...body,
      action: 'workspace_update',
      openConversationIds: flagStringArray(flags, 'open'),
      pinnedConversationIds: flagStringArray(flags, 'pinned'),
      archivedConversationIds: flagStringArray(flags, 'archived'),
      activeConversationId: flagString(flags, 'active'),
      workspacePaths: flagStringArray(flags, 'workspace-path'),
      remoteControlledConversationIds: flagStringArray(flags, 'remote-controlled'),
    };
  if (command === 'conversations open list') return { ...body, action: 'workspace_get' };
  if (command === 'conversations open add')
    return { ...body, action: 'workspace_open_update', operation: 'add', conversationIds: flagStringArray(flags, 'id') ?? positionals };
  if (command === 'conversations open remove')
    return { ...body, action: 'workspace_open_update', operation: 'remove', conversationIds: flagStringArray(flags, 'id') ?? positionals };
  if (command === 'conversations open pin')
    return { ...body, action: 'workspace_open_update', operation: 'pin', conversationIds: flagStringArray(flags, 'id') ?? positionals };
  if (command === 'conversations open unpin')
    return { ...body, action: 'workspace_open_update', operation: 'unpin', conversationIds: flagStringArray(flags, 'id') ?? positionals };
  if (command === 'conversations open active')
    return {
      ...body,
      action: 'workspace_open_update',
      operation: 'active',
      conversationIds: positionals[0] ? [positionals[0]] : undefined,
    };
  if (command === 'conversations archive')
    return { ...body, action: 'workspace_open_update', operation: 'archive', conversationIds: flagStringArray(flags, 'id') ?? positionals };
  if (command === 'conversations unarchive')
    return {
      ...body,
      action: 'workspace_open_update',
      operation: 'unarchive',
      conversationIds: flagStringArray(flags, 'id') ?? positionals,
    };
  if (command === 'conversations delete')
    return { ...body, action: 'delete', conversationIds: flagStringArray(flags, 'id') ?? positionals };
  if (command === 'conversations retention prune')
    return {
      ...body,
      action: 'retention_prune',
      olderThanMs: parseDurationMs(flagString(flags, 'older-than') ?? positionals[0]),
      archivedOnly: flagBoolean(flags, 'archived-only'),
      dryRun: flagBoolean(flags, 'dry-run'),
    };
  if (command === 'conversations transcript append')
    return {
      ...body,
      action: 'append_transcript_block',
      conversationId: positionals[0],
      blockType: flagString(flags, 'type') ?? positionals[1],
      blockId: flagString(flags, 'block-id'),
      title: flagString(flags, 'title'),
      data: flagString(flags, 'data') ? JSON.parse(flagString(flags, 'data') as string) : undefined,
    };
  if (command === 'conversations transcript update')
    return {
      ...body,
      action: 'update_transcript_block',
      conversationId: positionals[0],
      blockId: positionals[1] ?? flagString(flags, 'block-id'),
      blockType: flagString(flags, 'type') ?? positionals[2],
      title: flagString(flags, 'title'),
      data: flagString(flags, 'data') ? JSON.parse(flagString(flags, 'data') as string) : undefined,
    };
  return body;
}

function toolResult(action: string, details: unknown) {
  return {
    content: [{ type: 'text' as const, text: `${action} complete.` }],
    details,
  };
}

function conversationRunTurnEventText(event: unknown): string {
  const record = event && typeof event === 'object' && !Array.isArray(event) ? (event as Record<string, unknown>) : {};
  if (record.type === 'text_delta' && typeof record.delta === 'string') return record.delta;
  const assistantMessageEvent =
    record.assistantMessageEvent && typeof record.assistantMessageEvent === 'object' && !Array.isArray(record.assistantMessageEvent)
      ? (record.assistantMessageEvent as Record<string, unknown>)
      : {};
  if (assistantMessageEvent.type === 'text_delta' && typeof assistantMessageEvent.delta === 'string') return assistantMessageEvent.delta;
  return '';
}

function emitConversationRunTurnCliEvent(ctx: ExtensionBackendContext, event: unknown): void {
  const text = conversationRunTurnEventText(event);
  ctx.toolContext?.onUpdate?.({
    content: text ? [{ type: 'text', text }] : [],
    details: { event },
  });
}

async function createAndRunConversation(ctx: ExtensionBackendContext, payload: Record<string, unknown>) {
  const createResult = (await ctx.conversations.create({
    ...conversationCreateInput({ ...payload, live: true }),
  })) as Record<string, unknown>;
  const conversationId = optionalString(createResult.conversationId) ?? optionalString(createResult.id);
  if (!conversationId) throw new Error('Created conversation did not return a conversation id.');
  const turnResult = await ctx.conversations.runTurn(conversationId, requiredString(payload, 'text'), {
    ...conversationSendOptions(payload),
    ...(optionalString(payload.cwd) ? { cwd: optionalString(payload.cwd) } : {}),
    ...(optionalPositiveNumber(payload.timeoutMs) ? { timeoutMs: optionalPositiveNumber(payload.timeoutMs) } : {}),
    ...(payload.follow === true || optionalString(payload.format) === 'jsonl'
      ? { onEvent: (event: unknown) => emitConversationRunTurnCliEvent(ctx, event) }
      : {}),
  });
  return {
    ...createResult,
    conversationId,
    turn: turnResult,
    text: typeof (turnResult as { text?: unknown }).text === 'string' ? (turnResult as { text: string }).text : undefined,
  };
}

export async function conversationTool(input: unknown, ctx: ExtensionBackendContext) {
  input = normalizeConversationCliInput(input);
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

    case 'activity':
      return toolResult(
        action,
        await ctx.conversations.activity(requiredString(payload, 'conversationId'), {
          ...(payload.active !== undefined ? { active: payload.active === true } : {}),
          ...(optionalString(payload.visibility)
            ? { visibility: optionalString(payload.visibility) as 'primary' | 'system' | 'hidden' | 'visible' | 'all' }
            : {}),
        }),
      );

    case 'connections':
      return toolResult(
        action,
        await ctx.conversations.connections(requiredString(payload, 'conversationId'), {
          ...(payload.active !== undefined ? { active: payload.active === true } : {}),
          ...(optionalString(payload.kind)
            ? { kind: optionalString(payload.kind) as 'activity' | 'state' | 'asset' | 'context' | 'integration' | 'surface' | 'all' }
            : {}),
          ...(optionalString(payload.surface)
            ? {
                surface: optionalString(payload.surface) as
                  | 'activityShelf'
                  | 'composerShelf'
                  | 'rightRail'
                  | 'workbench'
                  | 'sidebar'
                  | 'cli'
                  | 'all',
              }
            : {}),
          ...(optionalString(payload.visibility)
            ? { visibility: optionalString(payload.visibility) as 'primary' | 'system' | 'hidden' | 'visible' | 'all' }
            : {}),
        }),
      );

    case 'inspect':
      return executeConversationInspectTool(conversationInspectPayload(params), { ...sessionManagerCtx, conversations: ctx.conversations });

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

    case 'create_and_run': {
      const result = await createAndRunConversation(ctx, payload);
      return {
        content: [{ type: 'text' as const, text: optionalString(result.text) ?? 'ask complete.' }],
        details: result,
      };
    }

    case 'ensure_live':
      return toolResult(
        action,
        await ctx.conversations.ensureLive(
          requiredString(payload, 'conversationId'),
          optionalString(payload.cwd) ? { cwd: optionalString(payload.cwd) } : undefined,
        ),
      );

    case 'send_message':
      return toolResult(
        action,
        await ctx.conversations.sendMessage(
          requiredString(payload, 'conversationId'),
          requiredString(payload, 'text'),
          conversationSendOptions(payload),
        ),
      );

    case 'run_turn':
      return toolResult(
        action,
        await ctx.conversations.runTurn(requiredString(payload, 'conversationId'), requiredString(payload, 'text'), {
          ...conversationSendOptions(payload),
          ...(optionalString(payload.cwd) ? { cwd: optionalString(payload.cwd) } : {}),
          ...(optionalPositiveNumber(payload.timeoutMs) ? { timeoutMs: optionalPositiveNumber(payload.timeoutMs) } : {}),
          ...(payload.follow === true || optionalString(payload.format) === 'jsonl'
            ? { onEvent: (event: unknown) => emitConversationRunTurnCliEvent(ctx, event) }
            : {}),
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

    case 'workspace_open_update':
      return toolResult(action, await workspaceOpenUpdate(ctx, payload));

    case 'delete':
      return toolResult(action, await ctx.conversations.delete({ conversationIds: optionalStringArray(payload.conversationIds) ?? [] }));

    case 'retention_prune': {
      const olderThanMs = optionalPositiveNumber(payload.olderThanMs);
      if (!olderThanMs) throw new Error('olderThanMs is required.');
      return toolResult(
        action,
        await ctx.conversations.prune({ olderThanMs, archivedOnly: payload.archivedOnly === true, dryRun: payload.dryRun === true }),
      );
    }

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
  return executeConversationInspectTool(input as Record<string, unknown>, { ...sessionManagerCtx, conversations: ctx.conversations });
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
