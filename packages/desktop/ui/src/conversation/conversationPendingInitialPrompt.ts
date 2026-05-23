import type { PendingConversationPrompt } from '../pending/pendingConversationPrompt';
import type { MessageBlock } from '../shared/types';
import { hasConversationTranscriptAcceptedPendingInitialPrompt } from './pendingInitialPromptLogic';

export function shouldClearAcceptedPendingInitialPrompt(input: {
  draft: boolean;
  conversationId: string | undefined;
  pendingInitialPrompt: PendingConversationPrompt | null;
  pendingInitialPromptDispatching: boolean;
  messages: MessageBlock[] | undefined;
}): boolean {
  return Boolean(
    !input.draft &&
    input.conversationId &&
    input.pendingInitialPrompt &&
    input.pendingInitialPromptDispatching &&
    hasConversationTranscriptAcceptedPendingInitialPrompt({ messages: input.messages, prompt: input.pendingInitialPrompt }),
  );
}

export function shouldClearStalePendingInitialPrompt(input: {
  draft: boolean;
  conversationId: string | undefined;
  pendingInitialPrompt: PendingConversationPrompt | null;
  pendingInitialPromptDispatching: boolean;
  messageCount: number;
}): boolean {
  return Boolean(
    !input.draft && input.conversationId && input.pendingInitialPrompt && !input.pendingInitialPromptDispatching && input.messageCount > 0,
  );
}

export function shouldResetPendingInitialPromptFailureSession(input: {
  conversationId: string | undefined;
  pendingInitialPrompt: PendingConversationPrompt | null;
}): boolean {
  return !input.conversationId || !input.pendingInitialPrompt;
}
