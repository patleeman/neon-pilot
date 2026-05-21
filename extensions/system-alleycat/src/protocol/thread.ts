import { resolve } from 'node:path';

import type { MethodHandler } from '../codexJsonRpcServer.js';
import { broadcastToThread, subscribeConnectionToThread, unsubscribeConnectionFromThread } from '../codexJsonRpcServer.js';
import { mutateWorkspace, workspaceList } from './workspaceState.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function epochSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

function defaultCwd(ctx?: { runtime?: { getRepoRoot?: () => string } }): string {
  return ctx?.runtime?.getRepoRoot?.() || process.env.NEON_PILOT_REPO_ROOT || process.cwd();
}

function absoluteCwd(value: unknown, ctx?: { runtime?: { getRepoRoot?: () => string } }): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : defaultCwd(ctx);
  // Kitty's local iSH default is /root. Treat it as "use the paired desktop's default cwd"
  // so a missing mobile cwd selection doesn't create useless /root PA threads.
  if (raw === '/root' || raw === '~' || raw === '~/') return resolve(defaultCwd(ctx));
  return resolve(raw);
}

function isMobileDefaultCwd(value: unknown): boolean {
  return value === '/root' || value === '~' || value === '~/';
}

function isLiveOrRunning(session: Record<string, unknown>): boolean {
  return session.running === true || session.isRunning === true || session.isLive === true;
}

function threadStatus(detail?: Record<string, unknown>) {
  return detail?.running ? { type: 'active', activeFlags: [] } : { type: 'idle' };
}

function toThreadResponse(
  id: string,
  detail?: Record<string, unknown>,
  turns: unknown[] = [],
  ctx?: { runtime?: { getRepoRoot?: () => string } },
) {
  const name = (detail?.title as string) || null;
  const preview = (detail?.preview as string) || name || '';
  const cwd = absoluteCwd(detail?.cwd, ctx);
  const createdAt = epochSeconds(detail?.createdAt ?? detail?.timestamp ?? detail?.lastActivityAt);
  const updatedAt = epochSeconds(detail?.updatedAt ?? detail?.lastActivityAt ?? detail?.timestamp ?? detail?.createdAt);

  return {
    id,
    sessionId: (detail?.sessionId as string) || id,
    forkedFromId: (detail?.forkedFromId as string) || null,
    preview,
    ephemeral: false,
    modelProvider: (detail?.modelProvider as string) || 'neon-pilot',
    createdAt,
    updatedAt,
    status: detail?.status && typeof detail.status === 'object' ? detail.status : threadStatus(detail),
    path: cwd,
    cwd,
    cliVersion: '0.125.0',
    source: 'appServer',
    threadSource: null,
    agentNickname: null,
    agentRole: null,
    gitInfo: detail?.gitInfo ?? null,
    name,
    turns,

    // Legacy PA compatibility field. Upstream Codex clients ignore it.
    title: name ?? '',
  };
}

function threadSessionFields(thread: ReturnType<typeof toThreadResponse>) {
  return {
    model: 'neon-pilot',
    modelProvider: thread.modelProvider,
    serviceTier: null,
    cwd: thread.cwd,
    instructionSources: [],
    approvalPolicy: 'on-failure',
    approvalsReviewer: 'user',
    sandbox: { type: 'dangerFullAccess' },
    permissionProfile: null,
    activePermissionProfile: null,
    reasoningEffort: null,
  };
}

function toThreadSessionResponse(thread: ReturnType<typeof toThreadResponse>) {
  return { thread, ...threadSessionFields(thread) };
}

function tsMs(value: unknown): number {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value > 10_000_000_000 ? value : value * 1000;
  return Date.now();
}

function textContent(text: string) {
  return [{ type: 'text', text, text_elements: [], textElements: [] }];
}

function blockId(block: Record<string, unknown>, fallback: string): string {
  return typeof block.id === 'string' && block.id ? block.id : fallback;
}

function contentItemsFromText(text: unknown): Array<Record<string, unknown>> {
  if (typeof text !== 'string' || !text) return [];
  return [{ type: 'text', text }];
}

function blockToCodexItem(block: Record<string, unknown>, index: number): Record<string, unknown> | null {
  const id = blockId(block, `item-${index}`);
  switch (block.type) {
    case 'user':
      return { id, type: 'userMessage', content: textContent(typeof block.text === 'string' ? block.text : '') };
    case 'text':
      return { id, type: 'agentMessage', text: typeof block.text === 'string' ? block.text : '' };
    case 'thinking':
      return { id, type: 'reasoning', summary: [], content: typeof block.text === 'string' && block.text ? [block.text] : [] };
    case 'summary':
      return { id, type: 'contextCompaction' };
    case 'context':
      return {
        id,
        type: 'hookPrompt',
        fragments: [{ type: 'text', text: typeof block.text === 'string' ? block.text : '', title: block.customType ?? 'context' }],
      };
    case 'tool_use':
      return {
        id: typeof block.toolCallId === 'string' && block.toolCallId ? block.toolCallId : id,
        type: 'dynamicToolCall',
        namespace: 'neon-pilot',
        tool: typeof block.tool === 'string' ? block.tool : 'tool',
        arguments: block.input && typeof block.input === 'object' ? block.input : {},
        status: block.status === 'running' ? 'inProgress' : 'completed',
        contentItems: contentItemsFromText(block.output),
        success: block.error === true ? false : true,
        durationMs: typeof block.durationMs === 'number' ? block.durationMs : null,
      };
    case 'error':
      return {
        id,
        type: 'dynamicToolCall',
        namespace: 'neon-pilot',
        tool: typeof block.tool === 'string' ? block.tool : 'error',
        arguments: {},
        status: 'completed',
        contentItems: contentItemsFromText(block.message),
        success: false,
      };
    case 'image': {
      const path = typeof block.src === 'string' ? block.src : typeof block.alt === 'string' ? block.alt : id;
      return { id, type: 'imageView', path };
    }
    default:
      return null;
  }
}

function readBlocksPayload(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.blocks,
    (record.detail as Record<string, unknown> | undefined)?.blocks,
    (record.sessionDetail as Record<string, unknown> | undefined)?.blocks,
    (record.stream as Record<string, unknown> | undefined)?.blocks,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate))
      return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
  }
  return [];
}

function blocksToTurns(blocks: Record<string, unknown>[]): unknown[] {
  const turns: Array<Record<string, unknown>> = [];
  let current: Record<string, unknown> | null = null;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type === 'user' || current == null) {
      if (current && Array.isArray(current.items) && current.items.length > 0) turns.push(current);
      current = {
        id: `turn-${blockId(block, String(index))}`,
        items: [],
        itemsView: 'full',
        status: 'completed',
        error: null,
        startedAt: Math.floor(tsMs(block.ts) / 1000),
        completedAt: null,
        durationMs: null,
      };
    }
    const item = blockToCodexItem(block, index);
    if (item && current) (current.items as unknown[]).push(item);
  }
  if (current && Array.isArray(current.items) && current.items.length > 0) turns.push(current);
  for (const turn of turns) {
    const lastItem = (turn.items as unknown[]).at(-1) as Record<string, unknown> | undefined;
    const sourceBlock = lastItem
      ? blocks.find((block) => blockId(block, '') === lastItem.id || block.toolCallId === lastItem.id)
      : undefined;
    turn.completedAt = Math.floor(tsMs(sourceBlock?.ts) / 1000);
  }
  return turns;
}

async function readTurns(threadId: string, ctx: Parameters<MethodHandler>[1]): Promise<unknown[]> {
  if (!ctx.conversations.getBlocks) return [];
  const payload = await ctx.conversations.getBlocks(threadId).catch(() => null);
  return blocksToTurns(readBlocksPayload(payload));
}

// ── Goal storage key helper ─────────────────────────────────────────────────

function goalKey(threadId: string): string {
  return `goal-${threadId}`;
}

function metaKey(threadId: string): string {
  return `meta-${threadId}`;
}

function exitCodeFromShellResult(result: unknown): number {
  const record = result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
  return typeof record.exitCode === 'number' && Number.isFinite(record.exitCode) ? Math.trunc(record.exitCode) : 0;
}

// ── Method handlers ─────────────────────────────────────────────────────────

export const thread = {
  /** `thread/start` */
  start: (async (params, ctx, conn, notify) => {
    const p = params as Record<string, unknown> | undefined;
    const created = await ctx.conversations.create({
      cwd: absoluteCwd(p?.cwd, ctx),
      model: p?.model as string | undefined,
      prompt: p?.prompt as string | undefined,
    });
    const meta = await ctx.conversations.getMeta(created.id);
    const detail = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    const threadId = created.id;
    const turns = await readTurns(threadId, ctx);

    subscribeConnectionToThread(threadId, notify, ctx, conn);

    const thread = toThreadResponse(threadId, detail, turns, ctx);
    notify('thread/started', { thread });
    broadcastToThread(threadId, 'thread/status/changed', {
      threadId,
      status: { type: 'idle' },
    });

    return toThreadSessionResponse(thread);
  }) as MethodHandler,

  /** `thread/resume` */
  resume: (async (params, ctx, conn, notify) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const meta = await ctx.conversations.getMeta(threadId).catch(() => null);
    const detail = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    const turns = await readTurns(threadId, ctx);

    subscribeConnectionToThread(threadId, notify, ctx, conn);

    const thread = toThreadResponse(threadId, detail, turns, ctx);
    notify('thread/started', { thread });
    broadcastToThread(threadId, 'thread/status/changed', {
      threadId,
      status: { type: 'idle' },
    });

    return toThreadSessionResponse(thread);
  }) as MethodHandler,

  /** `thread/fork` — fork a thread into a new one with full history */
  fork: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const sourceId = p?.threadId as string | undefined;
    if (!sourceId) throw new Error('threadId is required');

    const result = await ctx.conversations.fork(sourceId, absoluteCwd(p?.cwd, ctx));
    const meta = await ctx.conversations.getMeta(result.id).catch(() => null);
    const detail = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    const thread = toThreadResponse(result.id, { ...detail, forkedFromId: sourceId }, [], ctx);
    return toThreadSessionResponse(thread);
  }) as MethodHandler,

  /** `thread/list` */
  list: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const limit = typeof p?.limit === 'number' ? Math.min(p.limit, 100) : 25;

    const searchTerm = typeof p?.searchTerm === 'string' ? p.searchTerm.trim().toLowerCase() : '';
    const requestedCwds = (() => {
      const cwd = p?.cwd;
      if (typeof cwd === 'string' && cwd.trim()) return isMobileDefaultCwd(cwd) ? null : new Set([absoluteCwd(cwd, ctx)]);
      if (Array.isArray(cwd)) {
        const cwdValues = cwd.filter((item): item is string => typeof item === 'string' && !isMobileDefaultCwd(item));
        return cwdValues.length > 0 ? new Set(cwdValues.map((item) => absoluteCwd(item, ctx))) : null;
      }
      return null;
    })();

    const sessions = await ctx.conversations.list();
    const all = Array.isArray(sessions)
      ? sessions
          .map((s: unknown) => {
            const session = s as Record<string, unknown>;
            const id = String(session.id ?? session.sessionId ?? '');
            if (!id) return null;
            return toThreadResponse(
              id,
              {
                ...session,
                title: (session.title as string) ?? '',
                status: { type: 'idle' },
              },
              [],
              ctx,
            );
          })
          .filter((item): item is ReturnType<typeof toThreadResponse> => item != null)
      : [];

    const filtered = all
      .filter((item) => (requestedCwds ? requestedCwds.has(item.cwd) : true))
      .filter((item) => (searchTerm ? `${item.name ?? ''} ${item.preview ?? ''}`.toLowerCase().includes(searchTerm) : true))
      .sort((a, b) => {
        const key = p?.sortKey === 'created_at' || p?.sortKey === 'createdAt' ? 'createdAt' : 'updatedAt';
        const direction = p?.sortDirection === 'asc' ? 1 : -1;
        return ((a[key] as number) - (b[key] as number)) * direction;
      });

    return { data: filtered.slice(0, limit), nextCursor: null, backwardsCursor: null };
  }) as MethodHandler,

  /** `thread/loaded/list` — list PA threads currently open in the shared conversation workspace */
  loadedList: (async (_params, ctx) => {
    const workspace = await ctx.conversations.getWorkspace?.().catch(() => null);
    if (workspace && typeof workspace === 'object') {
      const openConversationIds = (workspace as Record<string, unknown>).openConversationIds;
      const pinnedConversationIds = (workspace as Record<string, unknown>).pinnedConversationIds;
      const loaded = [
        ...(Array.isArray(pinnedConversationIds) ? pinnedConversationIds : []),
        ...(Array.isArray(openConversationIds) ? openConversationIds : []),
      ]
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .filter((id, index, ids) => ids.indexOf(id) === index);
      return { data: loaded, nextCursor: null };
    }

    const sessions = await ctx.conversations.list();
    const loaded = Array.isArray(sessions)
      ? sessions
          .filter((s: unknown) => {
            const session = s as Record<string, unknown>;
            return isLiveOrRunning(session);
          })
          .map((s: unknown) => (s as Record<string, unknown>).id as string)
          .filter(Boolean)
      : [];
    return { data: loaded, nextCursor: null };
  }) as MethodHandler,

  /** `thread/open` — add a thread to the shared PA workspace without resuming it */
  open: (async (params, ctx) => {
    const threadId = (params as Record<string, unknown> | undefined)?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const nextWorkspace = await mutateWorkspace(ctx, (workspace) => {
      const pinnedConversationIds = workspaceList(workspace, 'pinnedConversationIds');
      const openConversationIds = workspaceList(workspace, 'openConversationIds');
      if (pinnedConversationIds.includes(threadId) || openConversationIds.includes(threadId)) {
        return { activeConversationId: threadId };
      }
      return { openConversationIds: [...openConversationIds, threadId], activeConversationId: threadId };
    });
    return { ok: true, workspace: nextWorkspace };
  }) as MethodHandler,

  /** `thread/close` — remove a thread from the shared PA workspace without archiving it */
  close: (async (params, ctx) => {
    const threadId = (params as Record<string, unknown> | undefined)?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const nextWorkspace = await mutateWorkspace(ctx, (workspace) => {
      const nextActiveConversationId = workspace?.activeConversationId === threadId ? null : workspace?.activeConversationId;
      return {
        openConversationIds: workspaceList(workspace, 'openConversationIds').filter((id) => id !== threadId),
        pinnedConversationIds: workspaceList(workspace, 'pinnedConversationIds').filter((id) => id !== threadId),
        activeConversationId: typeof nextActiveConversationId === 'string' ? nextActiveConversationId : null,
      };
    });
    return { ok: true, workspace: nextWorkspace };
  }) as MethodHandler,

  /** `thread/turns/list` */
  turnsList: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');
    const limit = typeof p?.limit === 'number' && p.limit > 0 ? Math.floor(p.limit) : 20;
    const direction = p?.sortDirection === 'asc' ? 'asc' : 'desc';
    const turns = await readTurns(threadId, ctx);
    const sorted = direction === 'asc' ? turns : [...turns].reverse();
    return { data: sorted.slice(0, limit), nextCursor: null, backwardsCursor: null };
  }) as MethodHandler,

  itemsList: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');
    const turns = await readTurns(threadId, ctx);
    const items = turns.flatMap((turn) =>
      Array.isArray((turn as Record<string, unknown>).items) ? ((turn as Record<string, unknown>).items as unknown[]) : [],
    );
    return { data: items, nextCursor: null, backwardsCursor: null };
  }) as MethodHandler,

  /** `thread/read` */
  read: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const includeTurns = p?.includeTurns !== false;
    const meta = await ctx.conversations.getMeta(threadId).catch(() => null);
    const detail = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};

    const turns: unknown[] = includeTurns ? await readTurns(threadId, ctx) : [];

    // Attach stored metadata
    const storedMeta = await ctx.storage.get<Record<string, unknown>>(metaKey(threadId)).catch(() => null);
    const gitInfo = storedMeta?.gitInfo ?? null;

    return {
      thread: toThreadResponse(threadId, { ...detail, gitInfo }, turns, ctx),
    };
  }) as MethodHandler,

  /** `thread/archive` */
  archive: (async (params, ctx) => {
    const threadId = (params as Record<string, unknown> | undefined)?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');
    const nextWorkspace = await mutateWorkspace(ctx, (workspace) => {
      const archivedConversationIds = workspaceList(workspace, 'archivedConversationIds');
      return {
        openConversationIds: workspaceList(workspace, 'openConversationIds').filter((id) => id !== threadId),
        pinnedConversationIds: workspaceList(workspace, 'pinnedConversationIds').filter((id) => id !== threadId),
        archivedConversationIds: archivedConversationIds.includes(threadId)
          ? archivedConversationIds
          : [...archivedConversationIds, threadId],
        remoteControlledConversationIds: workspaceList(workspace, 'remoteControlledConversationIds').filter((id) => id !== threadId),
        activeConversationId: workspace?.activeConversationId === threadId ? null : workspace?.activeConversationId,
      };
    });
    return { ok: true, workspace: nextWorkspace };
  }) as MethodHandler,

  /** `thread/unarchive` */
  unarchive: (async (params, ctx) => {
    const threadId = (params as Record<string, unknown> | undefined)?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');
    if (ctx.conversations.updateWorkspace) {
      await mutateWorkspace(ctx, (workspace) => ({
        archivedConversationIds: workspaceList(workspace, 'archivedConversationIds').filter((id) => id !== threadId),
      }));
    }
    const meta = await ctx.conversations.getMeta(threadId).catch(() => null);
    const detail = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    return { thread: toThreadResponse(threadId, detail, [], ctx) };
  }) as MethodHandler,

  /** `thread/name/set` */
  nameSet: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    const name = p?.name as string | undefined;
    if (!threadId) throw new Error('threadId is required');
    if (!name) throw new Error('name is required');

    await ctx.conversations.setTitle(threadId, name);
    broadcastToThread(threadId, 'thread/name/updated', { threadId, name });
    return {};
  }) as MethodHandler,

  /** `thread/metadata/update` — patch stored thread metadata */
  metadataUpdate: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const existing = (await ctx.storage.get<Record<string, unknown>>(metaKey(threadId)).catch(() => null)) ?? {};
    const gitInfo = p?.gitInfo as Record<string, unknown> | undefined;
    const merged = { ...existing, ...(gitInfo ? { gitInfo } : {}) };
    await ctx.storage.put(metaKey(threadId), merged);

    return { thread: { id: threadId, gitInfo: merged.gitInfo ?? null } };
  }) as MethodHandler,

  /** `thread/compact/start` — trigger compaction on a thread */
  compactStart: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const options = p?.options as Record<string, unknown> | undefined;
    const customInstructions = options?.customInstructions as string | undefined;
    if (customInstructions?.trim()) {
      throw new Error('thread/compact/start customInstructions are unsupported by Neon Pilot compact.');
    }

    await ctx.conversations.compact(threadId);
    return {};
  }) as MethodHandler,

  /** `thread/unsubscribe` */
  unsubscribe: (async (params, _ctx, conn, notify) => {
    const threadId = (params as Record<string, unknown> | undefined)?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');
    unsubscribeConnectionFromThread(threadId, notify);
    conn.subscribedThreads.delete(threadId);
    return { status: 'unsubscribed' };
  }) as MethodHandler,

  /** `thread/goal/set` — create, replace, or update a thread goal */
  goalSet: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const existing = (await ctx.storage.get<Record<string, unknown>>(goalKey(threadId)).catch(() => null)) ?? {};
    const now = Date.now();

    const objective = p?.objective as string | undefined;
    const status = (p?.status as string) ?? existing.status ?? 'active';

    const goal = {
      threadId,
      objective: objective ?? existing.objective ?? '',
      status: existing.objective && !objective ? (status as string) : 'active',
      tokenBudget: (p?.tokenBudget as number) ?? existing.tokenBudget ?? 0,
      tokensUsed: existing.objective && !objective ? (existing.tokensUsed ?? 0) : 0,
      timeUsedSeconds: existing.objective && !objective ? (existing.timeUsedSeconds ?? 0) : 0,
      createdAt: existing.objective && !objective ? (existing.createdAt ?? now) : now,
      updatedAt: now,
    };

    await ctx.storage.put(goalKey(threadId), goal);
    broadcastToThread(threadId, 'thread/goal/updated', { threadId, goal });

    return { goal };
  }) as MethodHandler,

  /** `thread/goal/get` — fetch the current goal */
  goalGet: (async (params, ctx) => {
    const threadId = (params as Record<string, unknown> | undefined)?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const goal = await ctx.storage.get<Record<string, unknown>>(goalKey(threadId)).catch(() => null);
    return { goal: goal ?? null };
  }) as MethodHandler,

  /** `thread/goal/clear` — clear the current goal */
  goalClear: (async (params, ctx) => {
    const threadId = (params as Record<string, unknown> | undefined)?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    const existing = await ctx.storage.get<Record<string, unknown>>(goalKey(threadId)).catch(() => null);
    await ctx.storage.delete(goalKey(threadId));

    const cleared = existing != null;
    broadcastToThread(threadId, 'thread/goal/cleared', { threadId });

    return { cleared };
  }) as MethodHandler,

  /** `thread/rollback` — drop the last N turns */
  rollback: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');
    const count = typeof p?.count === 'number' ? Math.max(1, p.count) : 1;

    const result = await ctx.conversations.rollback(threadId, count);
    broadcastToThread(threadId, 'thread/status/changed', {
      threadId,
      status: { type: 'idle' },
    });

    return { thread: { id: threadId }, rolledBackTo: result.rolledBackTo };
  }) as MethodHandler,

  /** `thread/inject_items` — inject raw items into the conversation history */
  injectItems: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    const items = p?.items as unknown[] | undefined;
    if (!threadId) throw new Error('threadId is required');

    if (items && items.length > 0) {
      const itemText = items
        .map((item: unknown) => {
          const i = item as Record<string, unknown>;
          if (i.type === 'message') return (i.content as string) ?? '';
          if (i.type === 'text') return (i.text as string) ?? '';
          return JSON.stringify(item);
        })
        .join('\n');

      if (itemText.trim()) {
        try {
          await ctx.conversations.sendMessage(threadId, `[injected context]\n${itemText}`);
        } catch {
          /* ok */
        }
      }
    }

    return {};
  }) as MethodHandler,

  /** `thread/shellCommand` — run a shell command and inject output into thread */
  shellCommand: (async (params, ctx, _conn, notify) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    const command = p?.command as string | undefined;
    if (!threadId) throw new Error('threadId is required');
    if (!command) throw new Error('command is required');

    const result = await ctx.shell.exec({ command: 'sh', args: ['-c', command], cwd: (p?.cwd as string) ?? process.cwd() });
    const exitCode = exitCodeFromShellResult(result);
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
    try {
      await ctx.conversations.sendMessage(
        threadId,
        `[shell command]\n$ ${command}\n${output ? `\`\`\`\n${output}\n\`\`\`` : ''}\n[exited with code ${exitCode}]`,
      );
    } catch {
      /* ok */
    }
    notify('turn/completed', {
      threadId,
      turn: { id: `shell-${Date.now()}`, status: 'completed', error: null },
    });
    return { exitCode, output, executionWrappers: result.executionWrappers };
  }) as MethodHandler,
};
