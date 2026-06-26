/**
 * NotificationCenter — compact top-bar dropdown.
 *
 * Shows notification history with type filtering, expandable details, and
 * bulk actions (dismiss all, mark all read).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { writeClipboardText } from '../../desktop/clipboard';
import { cx, IconButton, MetaLabel, StatusDot, type StatusDotTone, TextButton } from '../ui';
import { type NotificationItem, type NotificationType, useNotificationStore } from './notificationStore';

const TYPE_DOT_TONE: Record<NotificationType, StatusDotTone> = {
  info: 'steel',
  warning: 'warning',
  error: 'danger',
};

const TYPE_LABEL: Record<NotificationType, string> = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatNotificationForCopy(item: NotificationItem): string {
  const lines = [
    `Type: ${TYPE_LABEL[item.type]}`,
    item.source ? `Source: ${item.source}` : null,
    `Time: ${new Date(item.timestamp).toLocaleString()}`,
    item.count > 1 ? `Repeated: ${item.count}x` : null,
    '',
    item.message,
  ];

  if (item.details) {
    lines.push('', 'Details:', item.details);
  }

  return lines.filter((line): line is string => line !== null).join('\n');
}

function NotificationRow({
  item,
  onDismiss,
  onMarkRead,
}: {
  item: NotificationItem;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);

  const clearCopyResetTimeout = useCallback(() => {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearCopyResetTimeout, [clearCopyResetTimeout]);

  const copyNotification = async () => {
    try {
      await writeClipboardText(formatNotificationForCopy(item));
      setCopied(true);
      clearCopyResetTimeout();
      copyResetTimeoutRef.current = window.setTimeout(() => {
        copyResetTimeoutRef.current = null;
        setCopied(false);
      }, 1200);
    } catch {
      // Silently fail — clipboard access denied.
    }
  };

  return (
    <div
      className={cx(
        'group -mx-1.5 rounded-md px-2 py-1.5 transition-colors cursor-pointer',
        item.read ? 'opacity-50' : 'ui-notification-row-unread',
      )}
      onClick={() => {
        if (!item.read) onMarkRead(item.id);
        setExpanded(!expanded);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!item.read) onMarkRead(item.id);
          setExpanded(!expanded);
        }
      }}
    >
      <div className="flex items-start gap-2">
        <StatusDot tone={TYPE_DOT_TONE[item.type]} size="xs" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <MetaLabel tone="muted" className="font-medium">
              {TYPE_LABEL[item.type]}
            </MetaLabel>
            {item.source ? <span className="text-[9px] text-steel/50">[{item.source}]</span> : null}
            <span className="ml-auto text-[9px] text-steel/45">{formatTimestamp(item.timestamp)}</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-[18px] text-primary">{item.message}</p>
          {item.count > 1 ? <span className="text-[9px] text-steel/50">Repeated {item.count}x</span> : null}
          {item.details && expanded ? (
            <pre className="mt-1 overflow-x-auto rounded bg-base/70 px-1.5 py-1 text-[10px] leading-[16px] text-secondary whitespace-pre-wrap break-words">
              {item.details}
            </pre>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconButton
            compact
            size="sm"
            type="button"
            className="text-steel/40 hover:text-secondary"
            onClick={(e) => {
              e.stopPropagation();
              void copyNotification();
            }}
            aria-label="Copy notification"
            title={copied ? 'Copied' : 'Copy'}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </IconButton>
          <IconButton
            compact
            size="sm"
            type="button"
            className="text-steel/40 hover:text-secondary"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(item.id);
            }}
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </IconButton>
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const { notifications, unreadCount, dismiss, dismissAll, markRead, markAllRead } = useNotificationStore();
  const filtered = useMemo(() => notifications.filter((n) => !n.dismissed), [notifications]);

  const hasNotifications = notifications.some((n) => !n.dismissed);
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[130]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="false"
      aria-label="Notifications"
    >
      <div className="ui-notification-dropdown">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-3 py-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-semibold text-primary">Notifications</h2>
            {hasUnread ? <span className="ui-notification-badge">{unreadCount}</span> : null}
          </div>
          <div className="flex items-center gap-1">
            {hasNotifications && (
              <>
                <TextButton type="button" className="px-1.5 py-0.5 text-[9px]" onClick={dismissAll}>
                  Dismiss all
                </TextButton>
                {hasUnread && (
                  <TextButton type="button" className="px-1.5 py-0.5 text-[9px]" onClick={markAllRead}>
                    Mark read
                  </TextButton>
                )}
              </>
            )}
            <IconButton
              compact
              size="sm"
              type="button"
              className="text-secondary hover:text-primary"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-1.5">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center">
              <div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto text-steel/25"
                  aria-hidden="true"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p className="mt-2 text-[11px] text-dim">No notifications</p>
              </div>
            </div>
          ) : (
            <div className="space-y-px">
              {filtered.map((item) => (
                <NotificationRow key={item.id} item={item} onDismiss={dismiss} onMarkRead={markRead} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
