import { useEffect, useRef } from 'react';

export interface KBFileChangedExternallyDetail {
  path: string;
}

type KbEventCallback<T = unknown> = (detail: T) => void;

/**
 * Emit a typed in-window KB event.
 * Components use this to broadcast file-created/renamed/deleted/saved signals.
 * Event type already includes the 'kb:' prefix (e.g. 'kb:file-renamed').
 */
export function emitKBEvent<T = unknown>(type: string, detail?: T): void {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

/**
 * Subscribe to a typed in-window KB event.
 * Returns an unsubscribe function.
 */
export function onKBEvent<T = unknown>(type: string, handler: KbEventCallback<T>): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent).detail as T);
  };
  window.addEventListener(type, listener);
  return () => window.removeEventListener(type, listener);
}

export type KnowledgeWatcherEvent = {
  /** Changed knowledge document paths */
  paths: Array<string>;
  /** All current knowledge document paths after the change */
  snapshot: Array<string>;
};

type Props = {
  apiPathPrefix: string;
  onEvent: (event: KnowledgeWatcherEvent) => void;
};

type State = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Subscribe to server-sent knowledge filesystem watch events.
 *
 * Uses EventSource for long-lived push. When the EventSource drops (network
 * blip, server restart, sleep/wake), the native EventSource auto-reconnect
 * re-establishes the connection automatically — we do NOT close the source
 * in onerror.
 */
export function useKnowledgeWatcher({ apiPathPrefix, onEvent }: Props): State {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const stateRef = useRef<State>('disconnected');
  const returnStateRef = useRef<State>('disconnected');

  useEffect(() => {
    const changedPaths = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    const url = `${apiPathPrefix}/events`;

    function flush() {
      if (!mounted || changedPaths.size === 0) return;

      const paths = [...changedPaths];
      changedPaths.clear();
      onEventRef.current({ paths, snapshot: [] });
    }

    function scheduleFlush() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 150);
    }

    const source = new EventSource(url);

    source.onopen = () => {
      if (!mounted) return;
      stateRef.current = 'connected';
      returnStateRef.current = 'connected';
    };

    source.onmessage = (event) => {
      if (!mounted) return;
      try {
        const data = JSON.parse(event.data);

        if ('kb:file-changed-externally' === data.type) {
          for (const entry of data.entries ?? []) {
            if (typeof entry.path === 'string') {
              changedPaths.add(entry.path);
            }
          }
          scheduleFlush();
        } else if ('kb:entries-changed' === data.type) {
          for (const entry of data.entries ?? []) {
            if (typeof entry.path === 'string' && typeof entry.kind === 'string') {
              changedPaths.add(entry.path);
            }
          }
          scheduleFlush();
        } else if ('loadSnapshot' === data.type) {
          const paths = (data.entries ?? []).map((e: { path: string }) => e.path);
          onEventRef.current({ paths, snapshot: paths });
        }
      } catch {
        // ignore malformed events
      }
    };

    source.onerror = () => {
      if (!mounted) return;
      stateRef.current = 'error';
      returnStateRef.current = 'error';
      // Do NOT call source.close() here — EventSource's native auto-reconnect
      // handles transient failures (network blips, server restarts, sleep/wake).
      // Closing the source in onerror permanently disables reconnection.
    };

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [apiPathPrefix]);

  return returnStateRef.current;
}
