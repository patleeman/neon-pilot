import { useCallback, useEffect, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import type { ExecutionRecord } from '../shared/types';

const ACTIVE_EXECUTION_REFRESH_MS = 5000;

export function useConversationActiveExecutions(conversationId: string | null | undefined): {
  executions: ExecutionRecord[];
  refresh: () => Promise<void>;
} {
  const normalizedConversationId = conversationId?.trim() || null;
  const { versions } = useAppEvents();
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);

  const refresh = useCallback(async () => {
    if (!normalizedConversationId) {
      setExecutions([]);
      return;
    }

    const result = await api.conversationExecutions(normalizedConversationId, { active: true, visibility: 'primary' });
    setExecutions(result.primary);
  }, [normalizedConversationId]);

  useEffect(() => {
    let cancelled = false;

    async function runRefresh() {
      try {
        if (!normalizedConversationId) {
          if (!cancelled) setExecutions([]);
          return;
        }

        const result = await api.conversationExecutions(normalizedConversationId, { active: true, visibility: 'primary' });
        if (!cancelled) setExecutions(result.primary);
      } catch {
        if (!cancelled) setExecutions([]);
      }
    }

    void runRefresh();

    return () => {
      cancelled = true;
    };
  }, [normalizedConversationId, versions.executions]);

  useEffect(() => {
    if (!normalizedConversationId || executions.length === 0) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const result = await api.conversationExecutions(normalizedConversationId, { active: true, visibility: 'primary' });
        if (cancelled) return;
        setExecutions(result.primary);
        if (result.primary.length > 0) timeout = setTimeout(poll, ACTIVE_EXECUTION_REFRESH_MS);
      } catch {
        if (!cancelled) setExecutions([]);
      }
    }

    timeout = setTimeout(poll, ACTIVE_EXECUTION_REFRESH_MS);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [executions.length, normalizedConversationId]);

  return { executions, refresh };
}
