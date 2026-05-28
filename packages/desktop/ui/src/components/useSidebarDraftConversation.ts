import { useCallback, useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { normalizeConversationGroupCwd } from '../conversation/conversationCwdGroups';
import { DRAFT_CONVERSATION_ROUTE, readDraftConversationCwd } from '../conversation/draftConversation';
import { startDraftConversation } from '../conversation/newConversationNavigation';

type UseSidebarDraftConversationInput = {
  locationPathname: string;
  navigate: NavigateFunction;
  showNotice: (tone: 'accent' | 'danger', text: string, durationMs?: number) => void;
};

export function useSidebarDraftConversation({ locationPathname, navigate, showNotice }: UseSidebarDraftConversationInput) {
  const [draftCwd, setDraftCwd] = useState(() => readDraftConversationCwd());
  const [workspaceQuickSelectOpen, setWorkspaceQuickSelectOpen] = useState(false);

  useEffect(() => {
    setDraftCwd(readDraftConversationCwd());
    setWorkspaceQuickSelectOpen(false);
  }, [locationPathname]);

  const handleNewConversation = useCallback(
    (cwd?: string | null) => {
      const explicitCwd = normalizeConversationGroupCwd(cwd);
      try {
        startDraftConversation({
          navigate,
          cwd: explicitCwd,
          replace: locationPathname === DRAFT_CONVERSATION_ROUTE,
          focusComposer: true,
        });
        setDraftCwd(explicitCwd);
      } catch (error) {
        showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
      }
    },
    [locationPathname, navigate, showNotice],
  );

  return {
    draftCwd,
    handleNewConversation,
    setDraftCwd,
    setWorkspaceQuickSelectOpen,
    workspaceQuickSelectOpen,
  };
}
