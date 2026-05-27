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
  DRAFT_CONVERSATION_ROUTE,
  hasDraftConversationAttachments,
  hasDraftConversationContextDocs,
  persistDraftConversationCwd,
  readDraftConversationComposer,
  readDraftConversationCwd,
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
}

function focusComposerAfterNavigation(): void {
  const dispatch = () => window.dispatchEvent(new CustomEvent('neon-pilot:composer-focus'));
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(dispatch);
  });
}

function hasDraftConversationState(): boolean {
  return (
    readDraftConversationComposer().trim().length > 0 ||
    readDraftConversationCwd().trim().length > 0 ||
    readDraftConversationModel().trim().length > 0 ||
    readDraftConversationThinkingLevel().trim().length > 0 ||
    hasDraftConversationAttachments() ||
    hasDraftConversationContextDocs()
  );
}

export function startDraftConversation(input: StartDraftConversationInput): void {
  const cwd = input.cwd?.trim() ?? '';
  const alreadyOnEmptyDraft =
    !cwd && typeof window !== 'undefined' && window.location?.pathname === DRAFT_CONVERSATION_ROUTE && !hasDraftConversationState();

  if (alreadyOnEmptyDraft) {
    if (input.focusComposer === true) {
      focusComposerAfterNavigation();
    }
    return;
  }

  clearDraftConversationAttachments();
  clearDraftConversationComposer();
  clearDraftConversationContextDocs();
  clearDraftConversationCwd();
  clearDraftConversationModelPreferences();
  if (cwd) {
    // Preserve an explicit workspace choice while still resetting the rest of
    // the draft so opening Chat is instant and deterministic.
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
