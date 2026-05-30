import { describe, expect, it } from 'vitest';

import {
  shouldFetchConversationAttachmentsNow,
  shouldFetchLiveSessionGitContextNow,
  shouldLoadConversationModelsAfterMetadataReady,
} from './conversationLazyLoadDecisions';

describe('conversationLazyLoadDecisions', () => {
  it('loads models for draft mode', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        metadataReady: false,
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
      }),
    ).toBe(true);
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        metadataReady: true,
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
      }),
    ).toBe(true);
  });

  it('loads models for existing conversations even before metadata is ready', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        metadataReady: false,
        draft: false,
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
