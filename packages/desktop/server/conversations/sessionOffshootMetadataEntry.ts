import type { ConversationOffshootKind } from './sessionCustomMetadata.js';

export const CONVERSATION_OFFSHOOT_METADATA_CUSTOM_TYPE = 'conversation_offshoot_metadata';

export function buildConversationOffshootMetadataData(input: {
  detached?: boolean;
  kind?: ConversationOffshootKind;
  parentSessionFile?: string;
  parentSessionId?: string;
  parentMessageId?: string;
  sourceRunId?: string;
}): Record<string, unknown> {
  if (input.detached) {
    return { detached: true };
  }

  return {
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.parentSessionFile ? { parentSessionFile: input.parentSessionFile } : {}),
    ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
    ...(input.parentMessageId ? { parentMessageId: input.parentMessageId } : {}),
    ...(input.sourceRunId ? { sourceRunId: input.sourceRunId } : {}),
  };
}
