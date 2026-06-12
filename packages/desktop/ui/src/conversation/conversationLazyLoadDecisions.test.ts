import { describe, expect, it } from 'vitest';

import {
  shouldFetchConversationAttachmentsNow,
  shouldFetchLiveSessionGitContextNow,
  shouldLoadConversationModelsAfterMetadataReady,
} from './conversationLazyLoadDecisions';

describe('conversationLazyLoadDecisions', () => {
  it('loads models for idle draft mode without waiting for non-critical composer metadata', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
      }),
    ).toBe(true);
  });

  it('defers draft models while the initial prompt is being created', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        draft: true,
        hasPendingInitialPrompt: true,
        hasPendingInitialPromptInFlight: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: true,
      }),
    ).toBe(false);
  });

  it('loads models for existing conversations without waiting for non-critical composer metadata', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
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
