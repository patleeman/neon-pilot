import type { ExtensionHostToolContext } from './extensionHostProtocol.js';

export interface ExtensionHostToolContextSnapshot {
  conversationId?: string;
  cwd?: string;
  sessionFile?: string;
  sessionId?: string;
  preferredVisionModel?: string;
}

export function createExtensionHostToolContextSnapshot(
  context?: ExtensionHostToolContext,
): ExtensionHostToolContextSnapshot | undefined {
  if (!context) return undefined;
  return {
    ...(context.conversationId ? { conversationId: context.conversationId } : {}),
    ...(context.cwd ? { cwd: context.cwd } : {}),
    ...(context.sessionFile ? { sessionFile: context.sessionFile } : {}),
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    ...(context.preferredVisionModel ? { preferredVisionModel: context.preferredVisionModel } : {}),
  };
}

export function createExtensionBackendToolContextFromSnapshot(
  snapshot?: ExtensionHostToolContextSnapshot,
): ExtensionHostToolContext | undefined {
  if (!snapshot) return undefined;
  return { ...snapshot };
}
