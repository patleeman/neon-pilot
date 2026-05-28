import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { api } from '../client/api';
import { buildConversationDeeplink, buildConversationSurfacePath } from '../conversation/conversationRoutes';
import { persistForkPromptDraft } from '../conversation/forking';
import { writeClipboardText } from '../desktop/clipboard';
import type { SessionMeta } from '../shared/types';

type UseSidebarConversationMenuActionsInput = {
  navigate: NavigateFunction;
  openSession: (sessionId: string) => void;
  refetch: () => Promise<void>;
  showNotice: (tone: 'accent' | 'danger', text: string, durationMs?: number) => void;
};

export function useSidebarConversationMenuActions({ navigate, openSession, refetch, showNotice }: UseSidebarConversationMenuActionsInput) {
  const openCreatedConversation = useCallback(
    (sessionId: string, initialPromptText?: string) => {
      if (initialPromptText) {
        persistForkPromptDraft(sessionId, initialPromptText);
      }

      openSession(sessionId);
      void refetch().catch(() => {});
      navigate(buildConversationSurfacePath(sessionId));
    },
    [navigate, openSession, refetch],
  );

  const handleDuplicateConversation = useCallback(
    async (session: Pick<SessionMeta, 'id' | 'isLive'>) => {
      try {
        const { newSessionId } = await api.duplicateConversation(session.id);
        openCreatedConversation(newSessionId);
        return true;
      } catch (error) {
        showNotice('danger', `Duplicate failed: ${error instanceof Error ? error.message : String(error)}`, 4000);
        return false;
      }
    },
    [openCreatedConversation, showNotice],
  );

  const copyTextToClipboard = useCallback(
    async (value: string) => {
      try {
        await writeClipboardText(value);
        return true;
      } catch {
        showNotice('danger', 'Copy to clipboard failed.', 4000);
        return false;
      }
    },
    [showNotice],
  );

  const handleCopyConversationId = useCallback(
    async (conversationId: string) => copyTextToClipboard(conversationId),
    [copyTextToClipboard],
  );

  const handleCopyConversationWorkingDirectory = useCallback(
    async (cwd: string | null | undefined) => {
      const normalizedCwd = cwd?.trim() ?? '';
      if (!normalizedCwd) {
        showNotice('danger', 'No working directory is saved for this conversation.', 4000);
        return false;
      }

      return copyTextToClipboard(normalizedCwd);
    },
    [copyTextToClipboard, showNotice],
  );

  const handleCopyConversationDeeplink = useCallback(
    async (conversationId: string) => {
      if (typeof window === 'undefined') {
        showNotice('danger', 'Could not build a deeplink for this conversation.', 4000);
        return false;
      }

      try {
        return copyTextToClipboard(buildConversationDeeplink(conversationId, window.location.href));
      } catch {
        showNotice('danger', 'Could not build a deeplink for this conversation.', 4000);
        return false;
      }
    },
    [copyTextToClipboard, showNotice],
  );

  return {
    handleCopyConversationDeeplink,
    handleCopyConversationId,
    handleCopyConversationWorkingDirectory,
    handleDuplicateConversation,
    openCreatedConversation,
  };
}
