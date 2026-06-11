import { describe, expect, it } from 'vitest';

import {
  buildConversationInitialModelPreferenceState,
  buildConversationServiceTierPreferenceInput,
  consumeConversationInitialPromptAlreadySubmitted,
  hasConversationInitialPromptAlreadySubmitted,
  markConversationInitialPromptAlreadySubmitted,
  resolveConversationDraftHydrationState,
  resolveConversationInitialComposerDraftState,
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

  it('detects already-submitted initial prompts only for the active saved conversation', () => {
    const locationState = {
      initialPromptAlreadySubmittedState: { conversationId: 'conv-1' },
    };

    expect(
      hasConversationInitialPromptAlreadySubmitted({
        draft: false,
        conversationId: 'conv-1',
        locationState,
      }),
    ).toBe(true);

    expect(
      hasConversationInitialPromptAlreadySubmitted({
        draft: false,
        conversationId: 'conv-2',
        locationState,
      }),
    ).toBe(false);

    expect(
      hasConversationInitialPromptAlreadySubmitted({
        draft: true,
        conversationId: 'conv-1',
        locationState,
      }),
    ).toBe(false);
  });

  it('marks already-submitted initial prompts in session storage once', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } as Storage;

    markConversationInitialPromptAlreadySubmitted('conv-1', storage);

    expect(consumeConversationInitialPromptAlreadySubmitted('conv-1', storage)).toBe(true);
    expect(consumeConversationInitialPromptAlreadySubmitted('conv-1', storage)).toBe(false);
    expect(consumeConversationInitialPromptAlreadySubmitted('conv-2', storage)).toBe(false);
  });

  it('accepts initial composer draft state only for the active saved conversation', () => {
    const locationState = {
      initialComposerDraftState: { conversationId: 'conv-1', text: 'revise this prompt' },
    };

    expect(
      resolveConversationInitialComposerDraftState({
        draft: false,
        conversationId: 'conv-1',
        locationState,
      }),
    ).toEqual({ conversationId: 'conv-1', text: 'revise this prompt' });

    expect(
      resolveConversationInitialComposerDraftState({
        draft: false,
        conversationId: 'conv-2',
        locationState,
      }),
    ).toBeNull();
  });
});
