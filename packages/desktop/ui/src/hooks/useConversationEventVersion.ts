import { useAppEvents } from '../app/contexts';
import { readConversationScopedEventVersion } from '../conversation/conversationEventVersions';

export function useConversationEventVersion(conversationId: string | null | undefined): number {
  const { conversationVersions } = useAppEvents();
  return readConversationScopedEventVersion(conversationVersions, conversationId);
}

export function useConversationMetadataEventVersion(conversationId: string | null | undefined): number {
  const { conversationMetadataVersions } = useAppEvents();
  return readConversationScopedEventVersion(conversationMetadataVersions, conversationId);
}
