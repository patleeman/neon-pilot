import { useEffect } from 'react';

import { api } from '../client/api';
import { sessionNeedsAttention } from '../session/sessionIndicators';
import type { SessionMeta } from '../shared/types';

type UseSidebarAttentionReadInput = {
  activeConversationId: string | null;
  sessions: readonly SessionMeta[] | null;
};

export function useSidebarAttentionRead({ activeConversationId, sessions }: UseSidebarAttentionReadInput) {
  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const activeSession = sessions?.find((session) => session.id === activeConversationId);
    if (!activeSession || !sessionNeedsAttention(activeSession)) {
      return;
    }

    void api.markConversationAttentionRead(activeSession.id).catch(() => {
      // Ignore optimistic attention-clear failures.
    });
  }, [activeConversationId, sessions]);
}
