import { describe, expect, it } from 'vitest';

import {
  shouldFetchConversationAttachmentsNow,
  shouldFetchLiveSessionGitContextNow,
  shouldLoadConversationModelsAfterMetadataReady,
} from './conversationLazyLoadDecisions';

describe('conversationLazyLoadDecisions', () => {
  it('defers models for draft mode until metadata is ready', () => {
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

  it('defers models for existing conversations until metadata is ready', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        metadataReady: false,
        draft: false,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        metadataReady: true,
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
