import type { MethodHandler } from '../codexJsonRpcServer.js';

type ConversationContext = Parameters<MethodHandler>[1];

type Workspace = Record<string, unknown> | null;

type WorkspacePatch = Record<string, unknown>;

let workspaceMutationQueue: Promise<void> = Promise.resolve();

function readStringList(workspace: Workspace, key: string): string[] {
  const value = workspace?.[key];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : [];
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function workspaceList(workspace: Workspace, key: string): string[] {
  return unique(readStringList(workspace, key));
}

export async function mutateWorkspace(
  ctx: ConversationContext,
  mutate: (workspace: Workspace) => WorkspacePatch | Promise<WorkspacePatch>,
): Promise<unknown> {
  if (!ctx.conversations.updateWorkspace) throw new Error('Conversation workspace is unavailable.');

  const run = workspaceMutationQueue.then(async () => {
    const workspace = (await ctx.conversations.getWorkspace?.().catch(() => null)) as Workspace;
    const patch = await mutate(workspace);
    return await ctx.conversations.updateWorkspace(patch);
  });

  workspaceMutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return await run;
}
