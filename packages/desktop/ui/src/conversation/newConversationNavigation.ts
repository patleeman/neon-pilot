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
