import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

import type { MethodHandler } from '../codexJsonRpcServer.js';
import { mutateWorkspace, workspaceList } from './workspaceState.js';

// Track per-turn subscriptions keyed by threadId so they can be cleaned up
// on connection drop. Map<threadId, Set<unsubscribeFn>>
const turnSubscriptions = new Map<string, Set<() => void>>();
interface ActiveTurnState {
  turnId: string;
  threadId: string;
  interrupted: boolean;
}

const activeTurns = new Map<string, ActiveTurnState>();

function findActiveTurnForThread(threadId: string): ActiveTurnState | undefined {
  for (const state of activeTurns.values()) {
    if (state.threadId === threadId) return state;
  }
  return undefined;
}

function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function codexTurn(id: string, status: 'inProgress' | 'completed' | 'failed', error: string | null = null) {
  return {
    id,
    items: [],
    itemsView: 'full',
    status,
    error,
    startedAt: null,
    completedAt: status === 'inProgress' ? null : Math.floor(Date.now() / 1000),
    durationMs: null,
  };
}

function nowMs(): number {
  return Date.now();
}

const MAX_PROMPT_IMAGE_BYTES = 15 * 1024 * 1024;

interface PromptImage {
  data: string;
  mimeType: string;
  name?: string;
}

function normalizeBase64(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) ? trimmed : null;
}

function imageFromDataUrl(url: string, name?: string): PromptImage | null {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(url.trim());
  if (!match) return null;
  const mimeType = match[1]?.trim() || '';
  const data = normalizeBase64(match[2]);
  if (!mimeType.toLowerCase().startsWith('image/') || !data) return null;
  return { data, mimeType, ...(name ? { name } : {}) };
}

function sniffImageMime(data: Buffer): string | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  if (data.length >= 6) {
    const header = data.subarray(0, 6).toString('ascii');
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  }
  return null;
}

function imageFromFilePath(pathOrUrl: string, mimeType?: string, name?: string): PromptImage | null {
  let rawPath: string;
  try {
    rawPath = pathOrUrl.startsWith('file://') ? new URL(pathOrUrl).pathname : pathOrUrl;
  } catch {
    return null;
  }
  if (!rawPath.startsWith('/') || !existsSync(rawPath)) return null;
  const stats = statSync(rawPath);
  if (!stats.isFile() || stats.size > MAX_PROMPT_IMAGE_BYTES) return null;
  const fileData = readFileSync(rawPath);
  const sniffedMimeType = sniffImageMime(fileData);
  if (!sniffedMimeType) return null;
  const inferredMimeType = mimeType || mimeTypeFromName(rawPath);
  if (inferredMimeType.toLowerCase() !== sniffedMimeType) return null;
  return { data: fileData.toString('base64'), mimeType: sniffedMimeType, name: name || basename(rawPath) };
}

function mimeTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function promptImageFromInputItem(item: Record<string, unknown>): PromptImage | null {
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : undefined;
  const mimeType =
    typeof item.mimeType === 'string' && item.mimeType.trim()
      ? item.mimeType.trim()
      : typeof item.media_type === 'string' && item.media_type.trim()
        ? item.media_type.trim()
        : undefined;
  const data = normalizeBase64(item.dataBase64 ?? item.data ?? item.base64);
  if (data && mimeType?.toLowerCase().startsWith('image/')) return { data, mimeType, ...(name ? { name } : {}) };

  const url = typeof item.url === 'string' ? item.url : typeof item.image_url === 'string' ? item.image_url : undefined;
  if (!url) return null;
  return imageFromDataUrl(url, name) ?? imageFromFilePath(url, mimeType, name);
}

function promptImagesFromInput(input: Array<Record<string, unknown>>): PromptImage[] {
  return input
    .filter((item) => item.type === 'image' || item.type === 'input_image' || item.type === 'local_image')
    .map(promptImageFromInputItem)
    .filter((image): image is PromptImage => image !== null);
}

async function markThreadControlledRemotely(
  threadId: string,
  ctx: Parameters<MethodHandler>[1],
  options?: { active?: boolean },
): Promise<void> {
  try {
    await mutateWorkspace(ctx, (workspace) => {
      const pinnedConversationIds = workspaceList(workspace, 'pinnedConversationIds');
      const openConversationIds = workspaceList(workspace, 'openConversationIds');
      const remoteControlledConversationIds = workspaceList(workspace, 'remoteControlledConversationIds');
      const alreadyVisible = pinnedConversationIds.includes(threadId) || openConversationIds.includes(threadId);
      return {
        ...(alreadyVisible ? {} : { openConversationIds: [...openConversationIds, threadId] }),
        ...(remoteControlledConversationIds.includes(threadId)
          ? {}
          : { remoteControlledConversationIds: [...remoteControlledConversationIds, threadId] }),
        ...(options?.active === false ? {} : { activeConversationId: threadId }),
      };
    });
  } catch {
    // Workspace focus is best-effort; message delivery should not depend on desktop UI state.
  }
}

/** Clean up all turn subscriptions for a given thread. */
export function cleanupTurnSubscriptions(threadId: string): void {
  const subs = turnSubscriptions.get(threadId);
  if (!subs) return;
  for (const unsub of subs) {
    if (typeof unsub === 'function') unsub();
  }
  turnSubscriptions.delete(threadId);
}

export const turn = {
  /**
   * `turn/start` — send user input to a thread and stream the response.
   *
   * Subscribes to the PA live session events and forwards them as Codex
   * notifications. The subscription stays alive until the turn completes
   * (turn_end / error event), at which point it auto-cleans.
   *
   * params: {
   *   threadId: string,
   *   input: Array<{ type: 'text', text: string } | { type: 'image', url: string }>,
   *   cwd?: string,
   *   model?: string,
   *   effect?: string
   * }
   */
  start: (async (params, ctx, conn, notify) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    // Track for cleanup on connection drop
    conn.activeTurnThreads.add(threadId);

    const input = p?.input as Array<Record<string, unknown>> | undefined;
    if (!input || input.length === 0) throw new Error('input is required');

    const textParts: string[] = [];
    for (const item of input) {
      if (item.type === 'text' && typeof item.text === 'string') {
        textParts.push(item.text);
      }
    }
    const images = promptImagesFromInput(input);
    const text = textParts.join('\n');
    if (!text && images.length === 0) throw new Error('input must contain at least one text or image item');

    const turnId = uid('turn-');
    const turnState: ActiveTurnState = { turnId, threadId, interrupted: false };
    // Key by turnId so interrupt can target the specific turn,
    // not whichever turn was last started on this thread.
    activeTurns.set(turnId, turnState);

    // Notify turn started
    notify('turn/started', {
      threadId,
      turn: codexTurn(turnId, 'inProgress'),
    });

    // User message item
    const userItemId = uid('item-');
    const userItem = {
      id: userItemId,
      type: 'userMessage',
      content: [
        ...(text ? [{ type: 'text', text, textElements: [] }] : []),
        ...images.map((image) => ({ type: 'image', mimeType: image.mimeType, name: image.name ?? null })),
      ],
    };
    notify('item/started', {
      threadId,
      turnId,
      item: userItem,
      startedAtMs: nowMs(),
    });
    notify('item/completed', {
      threadId,
      turnId,
      item: userItem,
      completedAtMs: nowMs(),
    });

    let turnDone = false;
    let finalStatus: 'inProgress' | 'completed' | 'failed' = 'inProgress';
    let agentItemId: string | null = null;
    let agentText = '';
    let agentItemCompleted = false;
    let reasoningItemId: string | null = null;
    let reasoningText = '';
    let reasoningItemCompleted = false;
    const anonymousToolIds: string[] = [];

    const completeReasoningItem = () => {
      if (!reasoningItemId || reasoningItemCompleted) return;
      notify('item/completed', {
        threadId,
        turnId,
        item: { id: reasoningItemId, type: 'reasoning', summary: [], content: reasoningText ? [reasoningText] : [] },
        completedAtMs: nowMs(),
      });
      reasoningItemCompleted = true;
    };

    const onEvent = (event: unknown) => {
      if (turnDone || turnState.interrupted) return;
      const ev = event as Record<string, unknown>;
      if (!ev || typeof ev.type !== 'string') return;

      switch (ev.type) {
        case 'agent_start': {
          if (!agentItemId || agentItemCompleted) {
            agentItemId = uid('item-');
            agentText = '';
            agentItemCompleted = false;
            notify('item/started', {
              threadId,
              turnId,
              item: { id: agentItemId, type: 'agentMessage', text: '' },
              startedAtMs: nowMs(),
            });
          }
          break;
        }
        case 'text_delta': {
          const delta = ev.delta as string | undefined;
          if (delta) {
            if (!agentItemId) {
              agentItemId = uid('item-');
              agentText = '';
              agentItemCompleted = false;
              notify('item/started', {
                threadId,
                turnId,
                item: { id: agentItemId, type: 'agentMessage', text: '' },
                startedAtMs: nowMs(),
              });
            }
            agentText += delta;
            notify('item/agentMessage/delta', { threadId, turnId, itemId: agentItemId, delta });
          }
          break;
        }
        case 'thinking_delta': {
          const delta = ev.delta as string | undefined;
          if (delta) {
            if (!reasoningItemId) {
              reasoningItemId = uid('item-');
              reasoningText = '';
              reasoningItemCompleted = false;
              notify('item/started', {
                threadId,
                turnId,
                item: { id: reasoningItemId, type: 'reasoning', summary: [], content: [] },
                startedAtMs: nowMs(),
              });
            }
            reasoningText += delta;
            notify('item/reasoning/delta', { threadId, turnId, itemId: reasoningItemId, delta, summaryIndex: 0 });
          }
          break;
        }
        case 'tool_start': {
          const toolId = typeof ev.toolCallId === 'string' && ev.toolCallId ? ev.toolCallId : uid('tool-');
          if (!(typeof ev.toolCallId === 'string' && ev.toolCallId)) anonymousToolIds.push(toolId);
          notify('item/started', {
            threadId,
            turnId,
            item: {
              id: toolId,
              type: 'dynamicToolCall',
              namespace: 'neon-pilot',
              tool: (ev.toolName as string) || 'tool',
              arguments: ev.input ?? {},
              status: 'inProgress',
            },
          });
          break;
        }
        case 'tool_end': {
          const toolId = typeof ev.toolCallId === 'string' && ev.toolCallId ? ev.toolCallId : (anonymousToolIds.shift() ?? uid('tool-'));
          notify('item/completed', {
            threadId,
            turnId,
            item: {
              id: toolId,
              type: 'dynamicToolCall',
              namespace: 'neon-pilot',
              tool: (ev.toolName as string) || 'tool',
              arguments: ev.input ?? {},
              status: 'completed',
              contentItems: typeof ev.output === 'string' ? [{ type: 'text', text: ev.output }] : [],
              success: ev.isError === true ? false : true,
            },
          });
          break;
        }
        case 'agent_end': {
          completeReasoningItem();
          if (agentItemId && !agentItemCompleted) {
            notify('item/completed', {
              threadId,
              turnId,
              item: { id: agentItemId, type: 'agentMessage', text: agentText },
              completedAtMs: nowMs(),
            });
            agentItemCompleted = true;
          }
          break;
        }
        case 'turn_end': {
          turnDone = true;
          finalStatus = 'completed';
          conn.activeTurnThreads.delete(threadId);
          if (activeTurns.get(turnId) === turnState) activeTurns.delete(turnId);
          cleanupTurnSubscriptions(threadId);
          completeReasoningItem();
          if (agentItemId && !agentItemCompleted) {
            notify('item/completed', {
              threadId,
              turnId,
              item: { id: agentItemId, type: 'agentMessage', text: agentText },
              completedAtMs: nowMs(),
            });
            agentItemCompleted = true;
          }
          notify('turn/completed', { threadId, turn: codexTurn(turnId, 'completed') });
          break;
        }
        case 'error': {
          const errorMsg = ev.message as string | undefined;
          turnDone = true;
          finalStatus = 'failed';
          conn.activeTurnThreads.delete(threadId);
          if (activeTurns.get(turnId) === turnState) activeTurns.delete(turnId);
          cleanupTurnSubscriptions(threadId);
          notify('turn/completed', { threadId, turn: codexTurn(turnId, 'failed', errorMsg ?? 'Unknown error') });
          break;
        }
      }
    };

    const cwdOptions = typeof p?.cwd === 'string' ? { cwd: p.cwd } : undefined;
    void (async () => {
      try {
        await ctx.conversations.ensureLive(threadId, cwdOptions);
        await markThreadControlledRemotely(threadId, ctx);
        await ctx.conversations.runTurn(threadId, text, {
          ...(cwdOptions ?? {}),
          ...(images.length > 0 ? { images } : {}),
          onEvent,
        });
      } catch (error) {
        conn.activeTurnThreads.delete(threadId);
        if (activeTurns.get(turnId) === turnState) activeTurns.delete(turnId);
        if (!turnDone && !turnState.interrupted) {
          turnDone = true;
          finalStatus = 'failed';
          notify('turn/completed', {
            threadId,
            turn: codexTurn(turnId, 'failed', error instanceof Error ? error.message : String(error)),
          });
          cleanupTurnSubscriptions(threadId);
        }
      }
    })();

    return { turn: codexTurn(turnId, finalStatus) };
  }) as MethodHandler,

  /**
   * `turn/steer` — send input to an already in-flight turn.
   */
  steer: (async (params, ctx) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    const input = p?.input as Array<Record<string, unknown>> | undefined;
    if (!threadId) throw new Error('threadId is required');

    const normalizedInput = input ?? [];
    const text = normalizedInput
      .map((i) => (i.type === 'text' ? (i.text as string) : ''))
      .filter(Boolean)
      .join('\n');
    const images = promptImagesFromInput(normalizedInput);
    if (!text && images.length === 0) throw new Error('input must contain at least one text or image item');

    await ctx.conversations.ensureLive(threadId, typeof p?.cwd === 'string' ? { cwd: p.cwd } : undefined);
    await markThreadControlledRemotely(threadId, ctx, { active: false });
    await ctx.conversations.sendMessage(threadId, text, images.length > 0 ? { steer: true, images } : { steer: true });
    return { turnId: findActiveTurnForThread(threadId)?.turnId ?? null, threadId };
  }) as MethodHandler,

  /**
   * `turn/interrupt` — interrupt a running turn.
   */
  interrupt: (async (params, ctx, conn, notify) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    // Look up by turnId when provided so we interrupt the correct turn,
    // not whichever turn was last started on this thread.
    const requestedTurnId = p?.turnId as string | undefined;
    const turnState = requestedTurnId
      ? (activeTurns.get(requestedTurnId) ?? findActiveTurnForThread(threadId))
      : findActiveTurnForThread(threadId);
    if (turnState) turnState.interrupted = true;
    conn.activeTurnThreads.delete(threadId);

    // Notify the client that the turn was interrupted, so it doesn't hang
    // waiting for turn/completed that will never arrive.
    const interruptedTurnId = requestedTurnId ?? turnState?.turnId ?? `interrupted-${Date.now()}`;
    notify('turn/interrupted', {
      threadId,
      turn: codexTurn(interruptedTurnId, 'failed', 'Turn interrupted by user'),
    });

    // Send abort command before cleaning up subscriptions, so any turn_end
    // events from the PA backend can still flow through to the handler.
    try {
      await ctx.conversations.sendMessage(threadId, '/abort');
    } catch {
      // Best effort
    }

    // Clean up after the fact — the subscription is done regardless.
    cleanupTurnSubscriptions(threadId);

    return {};
  }) as MethodHandler,
};

export { turnSubscriptions };
