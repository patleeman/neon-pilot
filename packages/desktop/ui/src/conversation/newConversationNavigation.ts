import type { NavigateFunction } from 'react-router-dom';

import { api } from '../client/api';
import { ensureConversationTabOpen } from '../session/sessionTabs';
import { primeCreatedConversationOpenCaches } from './conversationSessionLifecycle';
import {
  clearDraftConversationAttachments,
  clearDraftConversationComposer,
  clearDraftConversationContextDocs,
  clearDraftConversationCwd,
  clearDraftConversationModelPreferences,
  persistDraftConversationCwd,
  readDraftConversationModel,
  readDraftConversationThinkingLevel,
} from './draftConversation';

const NEW_CONVERSATION_INITIAL_TAIL_BLOCKS = 40;

export interface StartNewLiveConversationInput {
  navigate: NavigateFunction;
  cwd?: string | null;
  replace?: boolean;
  focusComposer?: boolean;
  preserveDraftSurface?: boolean;
  bootstrapVersionKey?: string;
  sessionDetailVersion?: number;
}

export interface StartDraftConversationInput {
  navigate: NavigateFunction;
  cwd?: string | null;
  replace?: boolean;
  focusComposer?: boolean;
  initialComposerText?: string | null;
  initialPromptText?: string | null;
}

function focusComposerAfterNavigation(): void {
  const dispatch = () => window.dispatchEvent(new CustomEvent('neon-pilot:composer-focus'));
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(dispatch);
  });
}

/**
 * Start a new conversation by creating a live session first, then navigating.
 * Eliminates the draft sentinel pattern and its associated race conditions.
 */
export async function startNewConversation(input: StartDraftConversationInput): Promise<string> {
  const cwd = input.cwd?.trim() ?? '';
  const model = readDraftConversationModel();
  const thinkingLevel = readDraftConversationThinkingLevel();
  const initialPromptText = input.initialPromptText?.trim() ?? input.initialComposerText?.trim() ?? '';
  const shouldFocusComposer = input.focusComposer === true && !initialPromptText;

  try {
    const created = await api.createLiveSession(cwd || undefined, initialPromptText || undefined, {
      ...(model ? { model } : {}),
      ...(thinkingLevel ? { thinkingLevel } : {}),
    });

    primeCreatedConversationOpenCaches(created, {
      tailBlocks: NEW_CONVERSATION_INITIAL_TAIL_BLOCKS,
      bootstrapVersionKey: '',
      sessionDetailVersion: 0,
    });

    clearDraftConversationAttachments();
    clearDraftConversationComposer();
    clearDraftConversationContextDocs();
    clearDraftConversationCwd();
    clearDraftConversationModelPreferences();
    ensureConversationTabOpen(created.id);

    input.navigate(`/conversations/${encodeURIComponent(created.id)}`, {
      replace: input.replace,
      state: {
        focusComposer: shouldFocusComposer,
      },
    });

    if (shouldFocusComposer) {
      focusComposerAfterNavigation();
    }

    return created.id;
  } catch (error) {
    console.error('Failed to create conversation:', error);
    // Fall back to draft navigation on failure
    navigateDraft(input);
    return '';
  }
}

// Fallback draft navigation for error cases
function navigateDraft(input: StartDraftConversationInput): void {
  const cwd = input.cwd?.trim() ?? '';
  clearDraftConversationAttachments();
  clearDraftConversationComposer();
  clearDraftConversationContextDocs();
  clearDraftConversationCwd();
  clearDraftConversationModelPreferences();
  if (cwd) {
    persistDraftConversationCwd(cwd);
  }
  input.navigate('/conversations/new', {
    replace: input.replace,
    state: {
      focusComposer: input.focusComposer === true,
    },
  });
  if (input.focusComposer === true) {
    focusComposerAfterNavigation();
  }
}

export async function startNewLiveConversation(input: StartNewLiveConversationInput): Promise<string> {
  const cwd = input.cwd?.trim() ?? '';
  const model = readDraftConversationModel();
  const thinkingLevel = readDraftConversationThinkingLevel();
  const created = await api.createLiveSession(cwd || undefined, undefined, {
    ...(model ? { model } : {}),
    ...(thinkingLevel ? { thinkingLevel } : {}),
  });

  primeCreatedConversationOpenCaches(created, {
    tailBlocks: NEW_CONVERSATION_INITIAL_TAIL_BLOCKS,
    bootstrapVersionKey: input.bootstrapVersionKey ?? '',
    sessionDetailVersion: input.sessionDetailVersion ?? 0,
  });
  clearDraftConversationAttachments();
  clearDraftConversationComposer();
  clearDraftConversationContextDocs();
  clearDraftConversationCwd();
  clearDraftConversationModelPreferences();
  ensureConversationTabOpen(created.id);
  input.navigate(`/conversations/${encodeURIComponent(created.id)}`, {
    replace: input.replace,
    state: {
      ...(input.preserveDraftSurface === true ? { preserveConversationSurfaceKey: 'draft' } : {}),
      focusComposer: input.focusComposer === true,
    },
  });
  return created.id;
}
