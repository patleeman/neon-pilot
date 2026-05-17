import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

import type { MethodHandler } from '../codexJsonRpcServer.js';
import { readTurns } from './thread.js';

// Track per-turn subscriptions keyed by threadId so they can be cleaned up
// on connection drop. Map<threadId, Set<unsubscribeFn>>
const turnSubscriptions = new Map<string, Set<() => void>>();

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

function imageFromFilePath(pathOrUrl: string, mimeType?: string, name?: string): PromptImage | null {
  let rawPath: string;
  try {
    rawPath = pathOrUrl.startsWith('file://') ? new URL(pathOrUrl).pathname : pathOrUrl;
  } catch {
    return null;
  }
  if (!rawPath.startsWith('/') || !existsSync(rawPath)) return null;
  const inferredMimeType = mimeType || mimeTypeFromName(rawPath);
  if (!inferredMimeType.toLowerCase().startsWith('image/')) return null;
  return { data: readFileSync(rawPath).toString('base64'), mimeType: inferredMimeType, name: name || basename(rawPath) };
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

function latestAssistantTextFromTurns(turns: unknown[]): string | null {
  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = turns[turnIndex] as Record<string, unknown> | undefined;
    const items = Array.isArray(turn?.items) ? turn.items : [];
    for (let itemIndex = items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const item = items[itemIndex] as Record<string, unknown> | undefined;
      if (item?.type === 'agentMessage' && typeof item.text === 'string' && item.text.trim()) return item.text;
    }
  }
  return null;
}

async function markThreadControlledRemotely(
  threadId: string,
  ctx: Parameters<MethodHandler>[1],
  options?: { active?: boolean },
): Promise<void> {
  try {
    const workspace = (await ctx.conversations.getWorkspace()) as Record<string, unknown> | null;
    const pinnedConversationIds = Array.isArray(workspace?.pinnedConversationIds)
      ? workspace.pinnedConversationIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const openConversationIds = Array.isArray(workspace?.openConversationIds)
      ? workspace.openConversationIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const alreadyVisible = pinnedConversationIds.includes(threadId) || openConversationIds.includes(threadId);
    await ctx.conversations.updateWorkspace({
      ...(alreadyVisible ? {} : { openConversationIds: [...openConversationIds, threadId] }),
      ...(options?.active === false ? {} : { activeConversationId: threadId }),
    });
  } catch {
    // Workspace focus is best-effort; message delivery should not depend on desktop UI state.
  }

  try {
    const markerKey = `remote-control-marker:${threadId}`;
    const existing = await ctx.storage.get(markerKey);
    if (existing) return;
    await ctx.conversations.appendVisibleCustomMessage(threadId, 'remote_control', 'Controlled remotely from Kitty Litter.', {
      source: 'kitty-litter',
    });
    await ctx.storage.put(markerKey, { source: 'kitty-litter', createdAt: new Date().toISOString() });
  } catch {
    // The marker is decorative; never block the remote turn on it.
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

    // Subscribe to PA session events and forward them as Codex notifications.
    // The subscription stays alive until the turn ends — do NOT unsubscribe
    // in a finally block because sendMessage may resolve before streaming finishes.
    let turnDone = false;
    let agentItemId: string | null = null;
    let agentText = '';

    const subscribeToTurn = () => {
      const maybeUnsubscribe = ctx.conversations.subscribe(threadId, (event: unknown) => {
        if (turnDone) return;
        const ev = event as Record<string, unknown>;
        if (!ev || typeof ev.type !== 'string') return;

        switch (ev.type) {
          case 'agent_start': {
            agentItemId = uid('item-');
            agentText = '';
            notify('item/started', {
              threadId,
              turnId,
              item: { id: agentItemId, type: 'agentMessage', text: '' },
              startedAtMs: nowMs(),
            });
            break;
          }
          case 'text_delta': {
            const delta = ev.delta as string | undefined;
            if (delta && agentItemId) {
              agentText += delta;
              notify('item/agentMessage/delta', {
                threadId,
                turnId,
                itemId: agentItemId,
                delta,
              });
            }
            break;
          }
          case 'thinking_delta': {
            const delta = ev.delta as string | undefined;
            if (delta && agentItemId) {
              notify('item/reasoning/delta', {
                threadId,
                turnId,
                itemId: agentItemId,
                delta,
                summaryIndex: 0,
              });
            }
            break;
          }
          case 'tool_start': {
            const toolId = (ev.toolCallId as string) ?? uid('tool-');
            notify('item/started', {
              threadId,
              turnId,
              item: {
                id: toolId,
                type: 'dynamicToolCall',
                namespace: 'personal-agent',
                tool: (ev.toolName as string) || 'tool',
                arguments: ev.input ?? {},
                status: 'inProgress',
              },
            });
            break;
          }
          case 'tool_end': {
            const toolId = (ev.toolCallId as string) ?? uid('tool-');
            notify('item/completed', {
              threadId,
              turnId,
              item: {
                id: toolId,
                type: 'dynamicToolCall',
                namespace: 'personal-agent',
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
            if (agentItemId) {
              notify('item/completed', {
                threadId,
                turnId,
                item: {
                  id: agentItemId,
                  type: 'agentMessage',
                  text: agentText,
                },
                completedAtMs: nowMs(),
              });
            }
            break;
          }
          case 'turn_end': {
            turnDone = true;
            conn.activeTurnThreads.delete(threadId);
            if (typeof maybeUnsubscribe === 'function') {
              maybeUnsubscribe();
            }
            cleanupTurnSubscriptions(threadId);
            notify('turn/completed', {
              threadId,
              turn: codexTurn(turnId, 'completed'),
            });
            break;
          }
          case 'error': {
            const errorMsg = ev.message as string | undefined;
            turnDone = true;
            conn.activeTurnThreads.delete(threadId);
            if (typeof maybeUnsubscribe === 'function') {
              maybeUnsubscribe();
            }
            cleanupTurnSubscriptions(threadId);
            notify('turn/completed', {
              threadId,
              turn: codexTurn(turnId, 'failed', errorMsg ?? 'Unknown error'),
            });
            break;
          }
        }
      });

      // Track this subscription so it can be cleaned up on connection drop.
      if (typeof maybeUnsubscribe === 'function') {
        let subs = turnSubscriptions.get(threadId);
        if (!subs) {
          subs = new Set();
          turnSubscriptions.set(threadId, subs);
        }
        subs.add(maybeUnsubscribe);
      }
      return maybeUnsubscribe;
    };

    let unsubscribe: unknown;
    try {
      await ctx.conversations.ensureLive(threadId, typeof p?.cwd === 'string' ? { cwd: p.cwd } : undefined);
      unsubscribe = subscribeToTurn();
      await markThreadControlledRemotely(threadId, ctx);
      await ctx.conversations.sendMessage(threadId, text, images.length > 0 ? { images } : undefined);
      if (!turnDone && !agentText) {
        const fallbackText = latestAssistantTextFromTurns(await readTurns(threadId, ctx));
        if (fallbackText) {
          const fallbackItemId = agentItemId ?? uid('item-');
          notify('item/started', {
            threadId,
            turnId,
            item: { id: fallbackItemId, type: 'agentMessage', text: '' },
            startedAtMs: nowMs(),
          });
          notify('item/agentMessage/delta', { threadId, turnId, itemId: fallbackItemId, delta: fallbackText });
          notify('item/completed', {
            threadId,
            turnId,
            item: { id: fallbackItemId, type: 'agentMessage', text: fallbackText },
            completedAtMs: nowMs(),
          });
          turnDone = true;
          conn.activeTurnThreads.delete(threadId);
          if (typeof unsubscribe === 'function') unsubscribe();
          cleanupTurnSubscriptions(threadId);
          notify('turn/completed', { threadId, turn: codexTurn(turnId, 'completed') });
        }
      }
    } catch (error) {
      conn.activeTurnThreads.delete(threadId);
      if (!turnDone) {
        turnDone = true;
        notify('turn/completed', {
          threadId,
          turn: codexTurn(turnId, 'failed', error instanceof Error ? error.message : String(error)),
        });
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
        cleanupTurnSubscriptions(threadId);
      }
    }

    return {
      turn: codexTurn(turnId, turnDone ? 'completed' : 'inProgress'),
    };
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
    return { turnId: threadId };
  }) as MethodHandler,

  /**
   * `turn/interrupt` — interrupt a running turn.
   */
  interrupt: (async (params, ctx, _conn, notify) => {
    const p = params as Record<string, unknown> | undefined;
    const threadId = p?.threadId as string | undefined;
    if (!threadId) throw new Error('threadId is required');

    // Notify the client that the turn was interrupted, so it doesn't hang
    // waiting for turn/completed that will never arrive.
    notify('turn/interrupted', {
      threadId,
      turn: codexTurn((p?.turnId as string) ?? `interrupted-${Date.now()}`, 'failed', 'Turn interrupted by user'),
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
