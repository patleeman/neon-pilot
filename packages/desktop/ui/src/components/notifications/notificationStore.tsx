/**
 * Notification store — central state for all in-app notifications.
 *
 * Architecture:
 *   NotificationProvider (in Layout) → useNotificationStore() hook
 *
 * External sources feed in via:
 *   - `neon-pilot-extension-toast` CustomEvent (extension frontend → store)
 *   - `neon-pilot-notification` CustomEvent (core code, error boundaries → store)
 *   - Direct `addNotification()` export (class components, imperative use)
 *   - DesktopAppEvent `{ type: 'notification' }` (backend extension → SSE → store)
 */
import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';

export type NotificationType = 'info' | 'warning' | 'error';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  details?: string;
  source?: string;
  timestamp: string;
  count: number;
  read: boolean;
  dismissed: boolean;
}

export interface AddNotificationPayload {
  type: NotificationType;
  message: string;
  details?: string;
  source?: string;
}

type Action =
  | { kind: 'ADD'; payload: AddNotificationPayload }
  | { kind: 'DISMISS'; id: string }
  | { kind: 'DISMISS_ALL' }
  | { kind: 'MARK_READ'; id: string }
  | { kind: 'MARK_ALL_READ' };

const DEDUP_WINDOW_MS = 30_000;

let nextId = 1;

function generateId(): string {
  return `notif-${nextId++}-${Date.now()}`;
}

function isNotificationType(value: unknown): value is NotificationType {
  return value === 'info' || value === 'warning' || value === 'error';
}

function hasInternalDiagnosticContent(value: string): boolean {
  return (
    /Local API route did not complete/i.test(value) ||
    /\/api\//i.test(value) ||
    /file:\/\//i.test(value) ||
    /\s+at\s+\S+/i.test(value) ||
    /\bModule\.[A-Za-z_$][\w$]*/.test(value) ||
    /packages\/desktop\/server\/dist\/app\/localApi\.js/i.test(value)
  );
}

function fallbackNotificationMessage(type: NotificationType): string {
  if (type === 'error') return 'Something went wrong.';
  if (type === 'warning') return 'Something needs attention.';
  return 'Notification received.';
}

function sanitizeNotificationPayload(payload: AddNotificationPayload): AddNotificationPayload | null {
  const type = isNotificationType(payload.type) ? payload.type : 'info';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message) return null;

  const details = typeof payload.details === 'string' ? payload.details.trim() : '';
  const source = typeof payload.source === 'string' ? payload.source.trim() : '';

  return {
    type,
    message: hasInternalDiagnosticContent(message) ? fallbackNotificationMessage(type) : message,
    ...(details && !hasInternalDiagnosticContent(details) ? { details } : {}),
    ...(source ? { source } : {}),
  };
}

function reducer(state: NotificationItem[], action: Action): NotificationItem[] {
  switch (action.kind) {
    case 'ADD': {
      const payload = sanitizeNotificationPayload(action.payload);
      if (!payload) return state;

      const now = Date.now();
      // Dedup: same message + source + type within the window increments counter
      const existing = state.find(
        (n) =>
          !n.dismissed &&
          n.message === payload.message &&
          n.source === payload.source &&
          n.type === payload.type &&
          now - new Date(n.timestamp).getTime() < DEDUP_WINDOW_MS,
      );

      if (existing) {
        return state.map((n) =>
          n.id === existing.id ? { ...n, count: n.count + 1, timestamp: new Date().toISOString(), read: false } : n,
        );
      }

      return [
        ...state,
        {
          id: generateId(),
          type: payload.type,
          message: payload.message,
          details: payload.details,
          source: payload.source,
          timestamp: new Date().toISOString(),
          count: 1,
          read: false,
          dismissed: false,
        },
      ];
    }
    case 'DISMISS':
      return state.map((n) => (n.id === action.id ? { ...n, dismissed: true } : n));
    case 'DISMISS_ALL':
      return state.map((n) => (n.dismissed ? n : { ...n, dismissed: true }));
    case 'MARK_READ':
      return state.map((n) => (n.id === action.id ? { ...n, read: true } : n));
    case 'MARK_ALL_READ':
      return state.map((n) => (n.read ? n : { ...n, read: true }));
    default:
      return state;
  }
}

function countUnread(items: NotificationItem[]): number {
  return items.filter((n) => !n.dismissed && !n.read).length;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  add: (payload: AddNotificationPayload) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  add: () => '',
  dismiss: () => {},
  dismissAll: () => {},
  markRead: () => {},
  markAllRead: () => {},
});

export function useNotificationStore() {
  return useContext(NotificationContext);
}

// ── External API for class components / non-React code ────────────────────────

type AddFn = (payload: AddNotificationPayload) => string;
let externalAdd: AddFn | null = null;

/**
 * Pre-mount notification buffer.
 * Notifications dispatched before the NotificationProvider mounts are
 * queued here and replayed once the provider registers.
 */
let preMountBuffer: AddNotificationPayload[] = [];

function flushPreMountBuffer(dispatch: (payload: AddNotificationPayload) => void): void {
  const pending = preMountBuffer;
  preMountBuffer = [];
  for (const payload of pending) {
    dispatch(payload);
  }
}

/**
 * Add a notification from outside a React component (e.g. error boundaries).
 * Falls back to buffering if the store isn't mounted yet.
 */
export function addNotification(payload: AddNotificationPayload): string {
  if (externalAdd) {
    return externalAdd(payload);
  }

  // Store hasn't mounted yet — buffer for replay.
  // The provider flushes the buffer in its mount effect.
  preMountBuffer.push(payload);
  return generateId();
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, []);
  const externalAddRef = useRef<AddFn | null>(null);

  // Register the imperative add handler so `addNotification()` works.
  useEffect(() => {
    const handler: AddFn = (payload) => {
      const id = generateId();
      dispatch({ kind: 'ADD', payload: { ...payload } });
      return id;
    };
    externalAddRef.current = handler;
    externalAdd = handler;

    // Replay any notifications that arrived before the store mounted.
    flushPreMountBuffer(handler);

    return () => {
      if (externalAdd === handler) {
        externalAdd = null;
      }
    };
  }, []);

  // Listen for `neon-pilot-extension-toast` from extension frontends
  useEffect(() => {
    function handleExtensionToast(event: CustomEvent) {
      const detail = event.detail as {
        extensionId: string;
        message: string;
        type?: 'info' | 'warning' | 'error';
      };
      if (!detail.message) return;
      dispatch({
        kind: 'ADD',
        payload: {
          message: detail.message,
          type: detail.type ?? 'info',
          source: detail.extensionId,
        },
      });
    }

    window.addEventListener('neon-pilot-extension-toast', handleExtensionToast as EventListener);
    return () => window.removeEventListener('neon-pilot-extension-toast', handleExtensionToast as EventListener);
  }, []);

  // Listen for `neon-pilot-notification` from core code / error boundaries
  useEffect(() => {
    function handleNotification(event: CustomEvent) {
      const detail = event.detail as AddNotificationPayload & { _id?: string };
      if (!detail.message) return;
      dispatch({ kind: 'ADD', payload: { type: detail.type, message: detail.message, details: detail.details, source: detail.source } });
    }

    window.addEventListener('neon-pilot-notification', handleNotification as EventListener);
    return () => window.removeEventListener('neon-pilot-notification', handleNotification as EventListener);
  }, []);

  const add = useCallback((payload: AddNotificationPayload): string => {
    const id = generateId();
    dispatch({ kind: 'ADD', payload });
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ kind: 'DISMISS', id });
  }, []);

  const dismissAll = useCallback(() => {
    dispatch({ kind: 'DISMISS_ALL' });
  }, []);

  const markRead = useCallback((id: string) => {
    dispatch({ kind: 'MARK_READ', id });
  }, []);

  const markAllRead = useCallback(() => {
    dispatch({ kind: 'MARK_ALL_READ' });
  }, []);

  const value: NotificationContextValue = {
    notifications: state,
    unreadCount: countUnread(state),
    add,
    dismiss,
    dismissAll,
    markRead,
    markAllRead,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
