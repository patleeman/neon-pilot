import { describe, expect, it } from 'vitest';

import {
  buildConversationInitialModelPreferenceState,
  buildConversationServiceTierPreferenceInput,
  resolveConversationDraftHydrationState,
  resolveConversationInitialDeferredResumeState,
  resolveConversationInitialModelPreferenceState,
  resolveConversationInitialPendingPromptState,
} from './conversationInitialState';

describe('conversation initial state helpers', () => {
  it('only persists service tier when the user made an explicit choice', () => {
    expect(
      buildConversationServiceTierPreferenceInput({
        currentServiceTier: 'priority',
        hasExplicitServiceTier: false,
      }),
    ).toEqual({});

    expect(
      buildConversationServiceTierPreferenceInput({
        currentServiceTier: 'priority',
        hasExplicitServiceTier: true,
      }),
    ).toEqual({ serviceTier: 'priority' });

    expect(
      buildConversationServiceTierPreferenceInput({
        currentServiceTier: '',
        hasExplicitServiceTier: true,
      }),
    ).toEqual({ serviceTier: null });
  });

  it('normalizes initial model preference state with defaults', () => {
    expect(
      buildConversationInitialModelPreferenceState({
        conversationId: 'conv-1',
        currentModel: '',
        currentThinkingLevel: ' high ',
        currentServiceTier: '',
        hasExplicitServiceTier: false,
        defaultModel: ' default-model ',
        defaultThinkingLevel: 'medium',
        defaultServiceTier: 'priority',
      }),
    ).toEqual({
      conversationId: 'conv-1',
      currentModel: 'default-model',
      currentThinkingLevel: 'high',
      currentServiceTier: 'priority',
      hasExplicitServiceTier: false,
    });
  });

  it('accepts initial model preference state only for the active saved conversation', () => {
    const locationState = {
      initialModelPreferenceState: {
        conversationId: 'conv-1',
        currentModel: 'model-a',
        currentThinkingLevel: 'low',
        currentServiceTier: 'priority',
        hasExplicitServiceTier: true,
      },
    };

    expect(
      resolveConversationInitialModelPreferenceState({
        draft: false,
        conversationId: 'conv-1',
        locationState,
        defaultModel: 'model-default',
        defaultThinkingLevel: 'medium',
        defaultServiceTier: '',
      }),
    ).toEqual(locationState.initialModelPreferenceState);

    expect(
      resolveConversationInitialModelPreferenceState({
        draft: true,
        conversationId: 'conv-1',
        locationState,
        defaultModel: 'model-default',
        defaultThinkingLevel: 'medium',
        defaultServiceTier: '',
      }),
    ).toBeNull();

    expect(
      resolveConversationInitialModelPreferenceState({
        draft: false,
        conversationId: 'conv-2',
        locationState,
        defaultModel: 'model-default',
        defaultThinkingLevel: 'medium',
        defaultServiceTier: '',
      }),
    ).toBeNull();
  });

  it('accepts initial deferred-resume and draft-hydration state only for the active saved conversation', () => {
    const resumes = [{ id: 'resume-1', status: 'scheduled', dueAt: '2026-05-01T12:00:00.000Z' }];
    const locationState = {
      initialDeferredResumeState: { conversationId: 'conv-1', resumes },
      draftHydrationState: { conversationId: 'conv-1', enableAutoModeOnLoad: true },
    };

    expect(
      resolveConversationInitialDeferredResumeState({
        draft: false,
        conversationId: 'conv-1',
        locationState,
      }),
    ).toBe(resumes);

    expect(
      resolveConversationDraftHydrationState({
        draft: false,
        conversationId: 'conv-1',
        locationState,
      }),
    ).toEqual({ conversationId: 'conv-1', enableAutoModeOnLoad: true });

    expect(
      resolveConversationInitialDeferredResumeState({
        draft: false,
        conversationId: 'conv-2',
        locationState,
      }),
    ).toBeNull();

    expect(
      resolveConversationDraftHydrationState({
        draft: true,
        conversationId: 'conv-1',
        locationState,
      }),
    ).toBeNull();
  });

  it('accepts initial pending prompt state only for the active saved conversation', () => {
    const prompt = { text: 'hello', behavior: 'followUp' as const, images: [], attachmentRefs: [] };
    const locationState = {
      initialPendingPromptState: { conversationId: 'conv-1', prompt },
    };

    expect(
      resolveConversationInitialPendingPromptState({
        draft: false,
        conversationId: 'conv-1',
        locationState,
      }),
    ).toEqual(prompt);

    expect(
      resolveConversationInitialPendingPromptState({
        draft: false,
        conversationId: 'conv-2',
        locationState,
      }),
    ).toBeNull();

    expect(
      resolveConversationInitialPendingPromptState({
        draft: true,
        conversationId: 'conv-1',
        locationState,
      }),
    ).toBeNull();
  });
});
