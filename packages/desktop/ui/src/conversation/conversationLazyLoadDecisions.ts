import { shouldFetchConversationAttachments, shouldFetchConversationLiveSessionGitContext } from './conversationPageState';

export function shouldLoadConversationModelsAfterMetadataReady(input: {
  draft: boolean;
  hasPendingInitialPrompt: boolean;
  hasPendingInitialPromptInFlight: boolean;
  nonCriticalComposerMetadataReady: boolean;
}): boolean {
  return input.nonCriticalComposerMetadataReady && !input.hasPendingInitialPrompt && !input.hasPendingInitialPromptInFlight;
}

export function shouldFetchConversationAttachmentsNow(input: {
  draft: boolean;
  conversationId: string | undefined;
  drawingsPickerOpen: boolean;
}): boolean {
  return shouldFetchConversationAttachments(input);
}

export function shouldFetchLiveSessionGitContextNow(input: {
  draft: boolean;
  conversationId: string | undefined;
  conversationLiveDecision: boolean | null;
  conversationBootstrapLoading: boolean;
  sessionLoading: boolean;
  isStreaming: boolean;
  hasPendingInitialPrompt: boolean;
  pendingInitialPromptDispatching: boolean;
  hasPendingInitialPromptInFlight: boolean;
}): boolean {
  return shouldFetchConversationLiveSessionGitContext(input);
}
