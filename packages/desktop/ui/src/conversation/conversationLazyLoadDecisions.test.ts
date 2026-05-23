import { describe, expect, it } from 'vitest';

import {
  shouldFetchConversationAttachmentsNow,
  shouldFetchLiveSessionGitContextNow,
  shouldLoadConversationModelsAfterMetadataReady,
} from './conversationLazyLoadDecisions';

describe('conversationLazyLoadDecisions', () => {
  it('gates model loading on metadata readiness', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        metadataReady: false,
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        metadataReady: true,
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
      }),
    ).toBe(true);
  });

  it('delegates attachment and live git context fetch decisions', () => {
    expect(shouldFetchConversationAttachmentsNow({ draft: false, conversationId: 'conv', drawingsPickerOpen: true })).toBe(true);
    expect(shouldFetchConversationAttachmentsNow({ draft: false, conversationId: undefined, drawingsPickerOpen: false })).toBe(false);
    expect(
      shouldFetchLiveSessionGitContextNow({
        draft: false,
        conversationId: 'conv',
        conversationLiveDecision: true,
        conversationBootstrapLoading: false,
        sessionLoading: false,
        isStreaming: false,
        hasPendingInitialPrompt: false,
        pendingInitialPromptDispatching: false,
        hasPendingInitialPromptInFlight: false,
      }),
    ).toBe(true);
  });
});
