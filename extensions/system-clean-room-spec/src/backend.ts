import type { ExtensionBackendContext } from '@neon-pilot/extensions/backend';

import { cleanRoomPrompt } from './prompts/clean-room-spec.js';

const METADATA_NAMESPACE = 'system-clean-room-spec';
const CLEAN_ROOM_METADATA = { kind: 'clean-room-spec', version: 1 } as const;
const ALLOWED_TOOL_NAMES = ['web_search', 'web_fetch', 'agent_browser'] as const;

const WELCOME_MESSAGE = `Clean-room spec generator is ready.

Send a URL, paper, tweet, blog, docs page, product page, demo, or other public reference. I’ll study it with web-only tools and produce a clean implementation brief for a coding agent.`;

interface StartResult {
  conversationId: string;
  opened: boolean;
}

interface MessageActionInput {
  messageText?: string;
  messageRole?: string;
  blockId?: string;
  conversationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sourceCwd(ctx: ExtensionBackendContext): string {
  return ctx.toolContext?.cwd ?? ctx.runtime.getRepoRoot();
}

async function markCleanRoomConversation(ctx: ExtensionBackendContext, conversationId: string): Promise<void> {
  await ctx.conversations.metadata.set({
    conversationId,
    namespace: METADATA_NAMESPACE,
    values: { ...CLEAN_ROOM_METADATA, createdAt: new Date().toISOString() },
  });
}

async function openConversation(ctx: ExtensionBackendContext, conversationId: string): Promise<boolean> {
  try {
    await ctx.commands.execute('conversation.open', { conversationId });
    return true;
  } catch (error) {
    ctx.log.warn('failed to open clean-room conversation', {
      conversationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function start(_input: unknown, ctx: ExtensionBackendContext): Promise<StartResult> {
  const created = (await ctx.conversations.create({
    cwd: sourceCwd(ctx),
    title: 'Clean-room spec generator',
    allowedToolNames: [...ALLOWED_TOOL_NAMES],
  })) as { id: string };

  await markCleanRoomConversation(ctx, created.id);
  await ctx.conversations.appendVisibleCustomMessage(created.id, 'clean-room-spec-welcome', WELCOME_MESSAGE, { source: ctx.extensionId });
  const opened = await openConversation(ctx, created.id);
  return { conversationId: created.id, opened };
}

export async function provideTurnContext(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ blocks: Array<{ type: string; text: string }> }> {
  const conversationId = isRecord(input) && typeof input.conversationId === 'string' ? input.conversationId : null;
  if (!conversationId) return { blocks: [] };

  const metadata = await ctx.conversations.metadata.get({ conversationId, namespace: METADATA_NAMESPACE }).catch(() => ({}));
  if (!isRecord(metadata) || metadata.kind !== CLEAN_ROOM_METADATA.kind) return { blocks: [] };

  return {
    blocks: [
      {
        type: 'clean-room-spec-instructions',
        text: cleanRoomPrompt,
      },
    ],
  };
}

export async function startImplementation(input: unknown, ctx: ExtensionBackendContext): Promise<StartResult & { skipped?: string }> {
  const message = isRecord(input) ? (input as MessageActionInput) : {};
  const spec = typeof message.messageText === 'string' ? message.messageText.trim() : '';
  if (!spec) throw new Error('Start implementation requires an assistant message with spec text.');

  const sourceConversationId = typeof message.conversationId === 'string' ? message.conversationId : null;
  if (sourceConversationId) {
    const metadata = await ctx.conversations.metadata
      .get({ conversationId: sourceConversationId, namespace: METADATA_NAMESPACE })
      .catch(() => ({}));
    if (!isRecord(metadata) || metadata.kind !== CLEAN_ROOM_METADATA.kind) {
      return { conversationId: sourceConversationId, opened: false, skipped: 'not-clean-room-spec-conversation' };
    }
  }

  const prompt = `Implement from this clean-room spec. Do not browse the original references unless I explicitly ask. Treat this spec as the source of truth.\n\n<clean-room-spec>\n${spec}\n</clean-room-spec>`;
  const created = (await ctx.conversations.create({
    cwd: sourceCwd(ctx),
    title: 'Implement clean-room spec',
    initialPrompt: prompt,
  })) as { id: string };
  const opened = await openConversation(ctx, created.id);
  return { conversationId: created.id, opened };
}
