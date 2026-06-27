import type { PendingConversationPrompt } from '../pending/pendingConversationPrompt';

export interface ConversationInitialModelPreferenceState {
  conversationId: string;
  currentModel: string;
  currentThinkingLevel: string;
  currentServiceTier: string;
  hasExplicitServiceTier: boolean;
}

interface ConversationInitialDeferredResumeState {
  conversationId: string;
  resumes: DeferredResumeSummary[];
}

export interface ConversationDraftHydrationState {
  conversationId: string;
  enableAutoModeOnLoad?: boolean;
}

export interface ConversationInitialComposerDraftState {
  conversationId: string;
  text: string;
}

interface ConversationLocationState {
  initialModelPreferenceState?: ConversationInitialModelPreferenceState;
  initialDeferredResumeState?: ConversationInitialDeferredResumeState;
  draftHydrationState?: ConversationDraftHydrationState;
  initialComposerDraftState?: ConversationInitialComposerDraftState;
  initialPendingPromptState?: {
    conversationId: string;
    prompt?: PendingConversationPrompt | null;
  };
  initialPromptAlreadySubmittedState?: {
    conversationId: string;
  };
}

const INITIAL_PROMPT_ALREADY_SUBMITTED_STORAGE_PREFIX = 'neon-pilot:conversation:initial-prompt-submitted:';

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function initialPromptAlreadySubmittedStorageKey(conversationId: string): string {
  return `${INITIAL_PROMPT_ALREADY_SUBMITTED_STORAGE_PREFIX}${conversationId}`;
}

export function markConversationInitialPromptAlreadySubmitted(conversationId: string, storage: Storage | null = getSessionStorage()): void {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId || !storage) {
    return;
  }

  storage.setItem(initialPromptAlreadySubmittedStorageKey(normalizedConversationId), '1');
}

export function consumeConversationInitialPromptAlreadySubmitted(
  conversationId: string,
  storage: Storage | null = getSessionStorage(),
): boolean {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId || !storage) {
    return false;
  }

  const key = initialPromptAlreadySubmittedStorageKey(normalizedConversationId);
  const marked = storage.getItem(key) === '1';
  if (marked) {
    storage.removeItem(key);
  }
  return marked;
}

export function buildConversationServiceTierPreferenceInput(input: { currentServiceTier: string; hasExplicitServiceTier: boolean }): {
  serviceTier?: string | null;
} {
  if (!input.hasExplicitServiceTier) {
    return {};
  }

  return { serviceTier: input.currentServiceTier.trim() || null };
}

export function buildConversationInitialModelPreferenceState(input: {
  conversationId: string;
  currentModel?: string;
  currentThinkingLevel?: string;
  currentServiceTier?: string;
  hasExplicitServiceTier?: boolean;
  defaultModel?: string;
  defaultThinkingLevel?: string;
  defaultServiceTier?: string;
}): ConversationInitialModelPreferenceState {
  const normalizedCurrentServiceTier = input.currentServiceTier?.trim() || '';
  const hasExplicitServiceTier = Boolean(input.hasExplicitServiceTier);

  return {
    conversationId: input.conversationId,
    currentModel: input.currentModel?.trim() || input.defaultModel?.trim() || '',
    currentThinkingLevel: input.currentThinkingLevel?.trim() || input.defaultThinkingLevel?.trim() || '',
    currentServiceTier: hasExplicitServiceTier
      ? normalizedCurrentServiceTier
      : normalizedCurrentServiceTier || input.defaultServiceTier?.trim() || '',
    hasExplicitServiceTier,
  };
}

export function resolveConversationInitialModelPreferenceState(input: {
  draft: boolean;
  conversationId: string | null | undefined;
  locationState: unknown;
  defaultModel: string;
  defaultThinkingLevel: string;
  defaultServiceTier: string;
}): ConversationInitialModelPreferenceState | null {
  if (input.draft || !input.conversationId || !input.locationState || typeof input.locationState !== 'object') {
    return null;
  }

  const candidate = (input.locationState as ConversationLocationState).initialModelPreferenceState;
  if (!candidate || typeof candidate !== 'object' || candidate.conversationId !== input.conversationId) {
    return null;
  }

  return buildConversationInitialModelPreferenceState({
    conversationId: candidate.conversationId,
    currentModel: typeof candidate.currentModel === 'string' ? candidate.currentModel : '',
    currentThinkingLevel: typeof candidate.currentThinkingLevel === 'string' ? candidate.currentThinkingLevel : '',
    currentServiceTier: typeof candidate.currentServiceTier === 'string' ? candidate.currentServiceTier : '',
    hasExplicitServiceTier: typeof candidate.hasExplicitServiceTier === 'boolean' ? candidate.hasExplicitServiceTier : false,
    defaultModel: input.defaultModel,
    defaultThinkingLevel: input.defaultThinkingLevel,
    defaultServiceTier: input.defaultServiceTier,
  });
}

export function resolveConversationInitialDeferredResumeState(input: {
  draft: boolean;
  conversationId: string | null | undefined;
  locationState: unknown;
}): DeferredResumeSummary[] | null {
  if (input.draft || !input.conversationId || !input.locationState || typeof input.locationState !== 'object') {
    return null;
  }

  const candidate = (input.locationState as ConversationLocationState).initialDeferredResumeState;
  if (!candidate || typeof candidate !== 'object' || candidate.conversationId !== input.conversationId) {
    return null;
  }

  return Array.isArray(candidate.resumes) ? candidate.resumes : [];
}

export function resolveConversationDraftHydrationState(input: {
  draft: boolean;
  conversationId: string | null | undefined;
  locationState: unknown;
}): ConversationDraftHydrationState | null {
  if (input.draft || !input.conversationId || !input.locationState || typeof input.locationState !== 'object') {
    return null;
  }

  const candidate = (input.locationState as ConversationLocationState).draftHydrationState;
  if (!candidate || typeof candidate !== 'object' || candidate.conversationId !== input.conversationId) {
    return null;
  }

  return {
    conversationId: candidate.conversationId,
    enableAutoModeOnLoad: candidate.enableAutoModeOnLoad,
  };
}

export function resolveConversationInitialComposerDraftState(input: {
  draft: boolean;
  conversationId: string | null | undefined;
  locationState: unknown;
}): ConversationInitialComposerDraftState | null {
  if (input.draft || !input.conversationId || !input.locationState || typeof input.locationState !== 'object') {
    return null;
  }

  const candidate = (input.locationState as ConversationLocationState).initialComposerDraftState;
  if (!candidate || typeof candidate !== 'object' || candidate.conversationId !== input.conversationId) {
    return null;
  }

  return typeof candidate.text === 'string' ? { conversationId: candidate.conversationId, text: candidate.text } : null;
}

export function resolveConversationInitialPendingPromptState(input: {
  draft: boolean;
  conversationId: string | null | undefined;
  locationState: unknown;
}): PendingConversationPrompt | null {
  if (input.draft || !input.conversationId || !input.locationState || typeof input.locationState !== 'object') {
    return null;
  }

  const candidate = (input.locationState as ConversationLocationState).initialPendingPromptState;
  if (!candidate || typeof candidate !== 'object' || candidate.conversationId !== input.conversationId) {
    return null;
  }

  const prompt = candidate.prompt;
  if (!prompt || typeof prompt !== 'object' || typeof prompt.text !== 'string') {
    return null;
  }

  return {
    text: prompt.text,
    ...(prompt.behavior === 'steer' || prompt.behavior === 'followUp' ? { behavior: prompt.behavior } : {}),
    images: Array.isArray(prompt.images) ? prompt.images : [],
    attachmentRefs: Array.isArray(prompt.attachmentRefs) ? prompt.attachmentRefs : [],
    ...(Array.isArray(prompt.contextMessages) ? { contextMessages: prompt.contextMessages } : {}),
    ...(Array.isArray(prompt.relatedConversationIds) ? { relatedConversationIds: prompt.relatedConversationIds } : {}),
  };
}

export function hasConversationInitialPendingPromptState(input: {
  draft: boolean;
  conversationId: string | null | undefined;
  locationState: unknown;
}): boolean {
  if (input.draft || !input.conversationId || !input.locationState || typeof input.locationState !== 'object') {
    return false;
  }

  const candidate = (input.locationState as ConversationLocationState).initialPendingPromptState;
  return Boolean(candidate && typeof candidate === 'object' && candidate.conversationId === input.conversationId);
}

export function hasConversationInitialPromptAlreadySubmitted(input: {
  draft: boolean;
  conversationId: string | null | undefined;
  locationState: unknown;
}): boolean {
  if (input.draft || !input.conversationId || !input.locationState || typeof input.locationState !== 'object') {
    return false;
  }

  const candidate = (input.locationState as ConversationLocationState).initialPromptAlreadySubmittedState;
  return Boolean(candidate && typeof candidate === 'object' && candidate.conversationId === input.conversationId);
}
