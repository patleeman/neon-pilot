import {
  cancelAttentionEventForSessionFile,
  enqueueAttentionEventForSessionFile,
  listAttentionEventsForSessionFile,
} from '../automation/attentionEvents.js';
import { assertExtensionPermission } from './extensionPermissions.js';

export interface ExtensionAttentionEnqueueInput {
  conversationId?: string;
  sessionFile?: string;
  title?: string;
  prompt: string;
  delay?: string;
  at?: string;
  source?: { kind?: string; id?: string };
  delivery?: {
    mode?: 'batchable' | 'sequential' | 'isolated';
    priority?: 'low' | 'normal' | 'high';
    requireAck?: boolean;
    autoResumeIfOpen?: boolean;
    behavior?: 'steer' | 'followUp';
    batchKey?: string;
  };
}

export function createExtensionAttentionCapability(
  extensionId: string,
  toolContext?: { conversationId?: string; sessionFile?: string; sessionId?: string },
) {
  function resolveSessionFile(input?: { sessionFile?: string }): string {
    const sessionFile = input?.sessionFile?.trim() || toolContext?.sessionFile?.trim();
    if (!sessionFile) throw new Error('attention events require a sessionFile or active conversation context.');
    return sessionFile;
  }

  return {
    async enqueue(input: ExtensionAttentionEnqueueInput) {
      assertExtensionPermission(extensionId, 'attention:write', 'attention events');
      if (!input.prompt?.trim()) throw new Error('prompt is required');
      const sessionFile = resolveSessionFile(input);
      return enqueueAttentionEventForSessionFile({
        sessionFile,
        conversationId: input.conversationId?.trim() || toolContext?.conversationId || toolContext?.sessionId,
        title: input.title,
        prompt: input.prompt,
        delay: input.delay,
        at: input.at,
        source: {
          kind: input.source?.kind?.trim() || 'extension',
          id: input.source?.id,
          extensionId,
        },
        delivery: input.delivery,
      });
    },
    async list(input?: { sessionFile?: string }) {
      assertExtensionPermission(extensionId, 'attention:read', 'attention events');
      return listAttentionEventsForSessionFile(resolveSessionFile(input));
    },
    async cancel(input: { id: string; sessionFile?: string }) {
      assertExtensionPermission(extensionId, 'attention:write', 'attention events');
      return cancelAttentionEventForSessionFile({ sessionFile: resolveSessionFile(input), id: input.id });
    },
  };
}
