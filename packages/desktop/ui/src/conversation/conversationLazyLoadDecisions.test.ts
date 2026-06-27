import { describe, expect, it } from 'vitest';

import {
  shouldFetchConversationAttachmentsNow,
  shouldFetchLiveSessionGitContextNow,
  shouldLoadConversationModelsAfterMetadataReady,
} from './conversationLazyLoadDecisions';

describe('conversationLazyLoadDecisions', () => {
  it('defers models until composer metadata is ready', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
        nonCriticalComposerMetadataReady: false,
      }),
    ).toBe(false);
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
        nonCriticalComposerMetadataReady: true,
      }),
    ).toBe(true);
  });

  it('defers draft models while the initial prompt is being created', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        draft: true,
        hasPendingInitialPrompt: true,
        hasPendingInitialPromptInFlight: false,
        nonCriticalComposerMetadataReady: true,
      }),
    ).toBe(false);
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        draft: true,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: true,
        nonCriticalComposerMetadataReady: true,
      }),
    ).toBe(false);
  });

  it('loads models for existing conversations after non-critical composer metadata is ready', () => {
    expect(
      shouldLoadConversationModelsAfterMetadataReady({
        draft: false,
        hasPendingInitialPrompt: false,
        hasPendingInitialPromptInFlight: false,
        nonCriticalComposerMetadataReady: true,
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
