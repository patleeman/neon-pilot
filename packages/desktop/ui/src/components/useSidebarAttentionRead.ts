import { useEffect } from 'react';

import { api } from '../client/api';
import { sessionNeedsAttention } from '../session/sessionIndicators';
import type { SessionMeta } from '../shared/types';
import { sessionStore } from '../store';

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

    sessionStore.patch(activeSession.id, {
      needsAttention: false,
      attentionUnreadMessageCount: 0,
      attentionUnreadActivityCount: 0,
      attentionActivityIds: [],
    });

    void api.markConversationAttentionRead(activeSession.id).catch(() => {
      // Ignore attention-clear failures; the next sessions refresh restores the
      // authoritative state if the backend did not accept the update.
    });
  }, [activeConversationId, sessions]);
}
