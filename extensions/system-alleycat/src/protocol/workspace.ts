import type { MethodHandler } from '../codexJsonRpcServer.js';

function asStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined || value === null) return value;
  if (!Array.isArray(value)) throw new Error('workspace list fields must be arrays when provided');
  return value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim());
}

export const workspace = {
  /** `workspace/read` — read the shared PA conversation workspace */
  read: (async (_params, ctx) => {
    if (!ctx.conversations.getWorkspace) throw new Error('Conversation workspace is unavailable.');
    const current = await ctx.conversations.getWorkspace();
    return { workspace: current };
  }) as MethodHandler,

  /** `workspace/update` — update open/pinned/archived/active shared workspace state */
  update: (async (params, ctx) => {
    if (!ctx.conversations.updateWorkspace) throw new Error('Conversation workspace is unavailable.');
    const p = (params ?? {}) as Record<string, unknown>;
    const activeConversationId = p.activeConversationId;
    if (activeConversationId !== undefined && activeConversationId !== null && typeof activeConversationId !== 'string') {
      throw new Error('activeConversationId must be a string or null when provided');
    }

    const next = await ctx.conversations.updateWorkspace({
      openConversationIds: asStringArray(p.openConversationIds),
      pinnedConversationIds: asStringArray(p.pinnedConversationIds),
      archivedConversationIds: asStringArray(p.archivedConversationIds),
      remoteControlledConversationIds: asStringArray(p.remoteControlledConversationIds),
      activeConversationId: activeConversationId === undefined ? undefined : activeConversationId,
    });
    return { ok: true, workspace: next };
  }) as MethodHandler,
};
