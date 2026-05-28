import { useCallback, useEffect, useRef, useState } from 'react';

import { addNotification } from './notifications/notificationStore';

type SidebarNotice = { tone: 'accent' | 'danger'; text: string };

export function useSidebarNotice() {
  const noticeTimeoutRef = useRef<number | null>(null);
  const [notice, setNotice] = useState<SidebarNotice | null>(null);

  const showNotice = useCallback((tone: SidebarNotice['tone'], text: string, durationMs = 2500) => {
    if (tone === 'danger') {
      addNotification({ type: 'error', message: text, source: 'sidebar' });
      return;
    }

    setNotice({ tone, text });
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    },
    [],
  );

  return { notice, showNotice };
}
