import { useCallback, useEffect, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import type { ExecutionRecord } from '../shared/types';

const ACTIVE_EXECUTION_REFRESH_MS = 5000;

function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(isDocumentVisible);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => setVisible(isDocumentVisible());
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return visible;
}

export function useConversationActiveExecutions(conversationId: string | null | undefined): {
  executions: ExecutionRecord[];
  refresh: () => Promise<void>;
} {
  const normalizedConversationId = conversationId?.trim() || null;
  const { versions } = useAppEvents();
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const documentVisible = useDocumentVisible();

  const refresh = useCallback(async () => {
    if (!normalizedConversationId || !documentVisible) {
      setExecutions([]);
      return;
    }

    const result = await api.conversationExecutions(normalizedConversationId, { active: true, visibility: 'primary' });
    setExecutions(result.primary);
  }, [documentVisible, normalizedConversationId]);

  useEffect(() => {
    let cancelled = false;

    async function runRefresh() {
      try {
        if (!normalizedConversationId || !documentVisible) {
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
  }, [documentVisible, normalizedConversationId, versions.executions]);

  useEffect(() => {
    if (!normalizedConversationId || !documentVisible || executions.length === 0) return;

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
  }, [documentVisible, executions.length, normalizedConversationId]);

  return { executions, refresh };
}
