import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import type { ConversationActivityResult } from '../shared/types';

const ACTIVE_ACTIVITY_REFRESH_MS = 5000;

const EMPTY_ACTIVITY: ConversationActivityResult = {
  conversationId: '',
  items: [],
  primary: [],
  system: [],
  hidden: [],
};

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

export function useConversationActivity(
  conversationId: string | null | undefined,
  refreshKey = '',
): {
  activity: ConversationActivityResult;
  refresh: () => Promise<void>;
} {
  const normalizedConversationId = conversationId?.trim() || null;
  const { versions } = useAppEvents();
  const [activity, setActivity] = useState<ConversationActivityResult>(EMPTY_ACTIVITY);
  const documentVisible = useDocumentVisible();
  const lifecycleRef = useRef({
    conversationId: normalizedConversationId,
    documentVisible,
    disposed: false,
  });
  lifecycleRef.current.conversationId = normalizedConversationId;
  lifecycleRef.current.documentVisible = documentVisible;

  useEffect(() => {
    lifecycleRef.current.disposed = false;
    return () => {
      lifecycleRef.current.disposed = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!normalizedConversationId || !documentVisible) {
      if (!lifecycleRef.current.disposed) {
        setActivity(EMPTY_ACTIVITY);
      }
      return;
    }

    const requestConversationId = normalizedConversationId;
    const result = await api.conversationActivity(requestConversationId);
    if (
      lifecycleRef.current.disposed ||
      !lifecycleRef.current.documentVisible ||
      lifecycleRef.current.conversationId !== requestConversationId
    ) {
      return;
    }
    setActivity(result);
  }, [documentVisible, normalizedConversationId]);

  useEffect(() => {
    let cancelled = false;

    async function runRefresh() {
      try {
        if (!normalizedConversationId || !documentVisible) {
          if (!cancelled) setActivity(EMPTY_ACTIVITY);
          return;
        }

        const result = await api.conversationActivity(normalizedConversationId);
        if (!cancelled) setActivity(result);
      } catch {
        if (!cancelled) setActivity(EMPTY_ACTIVITY);
      }
    }

    void runRefresh();

    return () => {
      cancelled = true;
    };
  }, [documentVisible, normalizedConversationId, refreshKey, versions.executions, versions.sessions, versions.tasks]);

  useEffect(() => {
    if (!normalizedConversationId || !documentVisible || !activity.items.some((item) => item.active)) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const result = await api.conversationActivity(normalizedConversationId);
        if (cancelled) return;
        setActivity(result);
        if (result.items.some((item) => item.active)) timeout = setTimeout(poll, ACTIVE_ACTIVITY_REFRESH_MS);
      } catch {
        if (!cancelled) setActivity(EMPTY_ACTIVITY);
      }
    }

    timeout = setTimeout(poll, ACTIVE_ACTIVITY_REFRESH_MS);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [activity.items, documentVisible, normalizedConversationId]);

  return { activity, refresh };
}
