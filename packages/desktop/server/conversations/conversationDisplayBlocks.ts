import type { DisplayBlock } from './conversationTypes.js';
import { buildDisplayBlocksFromEntries as buildSessionDisplayBlocksFromEntries } from './sessions.js';

export interface DisplayMessageEntryLike {
  id: string;
  parentId?: string | null;
  timestamp: string | number;
  message: {
    role: string;
    content?: unknown;
    toolCallId?: string;
    toolName?: string;
    details?: unknown;
    stopReason?: string;
    errorMessage?: string;
    summary?: string;
    tokensBefore?: number;
    fromId?: string;
    customType?: string;
    display?: boolean;
    command?: string;
    output?: string;
    exitCode?: number;
    cancelled?: boolean;
    truncated?: boolean;
    fullOutputPath?: string;
    excludeFromContext?: boolean;
  };
}

export function buildConversationDisplayBlocksFromEntries(messages: DisplayMessageEntryLike[]): DisplayBlock[] {
  return buildSessionDisplayBlocksFromEntries(messages);
}
