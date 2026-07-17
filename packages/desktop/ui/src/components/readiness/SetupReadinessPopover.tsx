import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { SetupReadinessAction, SetupReadinessItem, SetupReadinessSnapshot, SetupReadinessStatus } from '../../shared/types';
import { cx, IconButton, Select, Spinner, StatusDot, type StatusDotTone, TaskListItem, ToolbarButton } from '../ui';

type Filter = 'incomplete' | 'all' | 'dismissed';

const STATUS_LABEL: Record<SetupReadinessStatus, string> = {
  ready: 'Ready',
  needs_setup: 'Needs setup',
  blocked: 'Blocked',
  not_applicable: 'Not needed',
  unknown: 'Check failed',
};

const STATUS_TONE: Record<SetupReadinessStatus, StatusDotTone> = {
  ready: 'success',
  needs_setup: 'warning',
  blocked: 'danger',
  not_applicable: 'muted',
  unknown: 'steel',
};

function itemIsIncomplete(item: SetupReadinessItem): boolean {
  return item.status !== 'ready' && item.status !== 'not_applicable';
}

function EmptyState({ filter }: { filter: Filter }) {
  const text = filter === 'dismissed' ? 'No dismissed setup items' : filter === 'all' ? 'No setup items registered' : 'Everything is ready';
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-secondary">
      <StatusDot tone={filter === 'incomplete' ? 'success' : 'muted'} size="xs" />
      <span className="ml-2">{text}</span>
    </div>
  );
}

function SmallIcon({ d }: { d: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function SetupReadinessRow({
  item,
  busy,
  onRunAction,
  onDismiss,
  onRestore,
}: {
  item: SetupReadinessItem;
  busy: boolean;
  onRunAction: (item: SetupReadinessItem, action: SetupReadinessAction) => void;
  onDismiss: (item: SetupReadinessItem) => void;
  onRestore: (item: SetupReadinessItem) => void;
}) {
  const detail = [item.error ?? item.detail, item.extensionName, item.dismissed ? 'Dismissed' : null].filter(Boolean).join(' · ');

  return (
    <TaskListItem
      checked={item.status === 'ready' || item.status === 'not_applicable'}
      className={cx('px-2 py-1.5', item.dismissed && 'opacity-60')}
      control={<StatusDot tone={STATUS_TONE[item.status]} size="xs" />}
      label={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{item.title}</span>
          <span className="shrink-0 text-[10px] font-medium text-dim">{STATUS_LABEL[item.status]}</span>
        </span>
      }
      detail={detail}
      actions={
        <>
          {item.dismissed ? (
            <IconButton
              compact
              size="sm"
              type="button"
              onClick={() => onRestore(item)}
              disabled={busy}
              aria-label="Restore setup item"
              title="Restore"
            >
              <SmallIcon d="M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13" />
            </IconButton>
          ) : null}
          {!item.dismissed && item.dismissible && itemIsIncomplete(item) ? (
            <IconButton
              compact
              size="sm"
              type="button"
              onClick={() => onDismiss(item)}
              disabled={busy}
              aria-label="Dismiss setup item"
              title="Dismiss"
            >
              <SmallIcon d="M18 6 6 18M6 6l12 12" />
            </IconButton>
          ) : null}
          {item.actions.map((action) => (
            <ToolbarButton
              key={action.id}
              type="button"
              className={cx(action.tone === 'primary' && 'text-accent', action.tone === 'danger' && 'text-danger')}
              onClick={() => onRunAction(item, action)}
              disabled={busy}
            >
              {busy ? <Spinner size="xs" /> : null}
              {action.label}
            </ToolbarButton>
          ))}
        </>
      }
    />
  );
}

export function SetupReadinessPopover({
  snapshot,
  loading,
  error,
  onClose,
  onRefresh,
  onRunAction,
  onDismiss,
  onRestore,
}: {
  snapshot: SetupReadinessSnapshot | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onRunAction: (extensionId: string, itemId: string, actionId: string) => Promise<unknown>;
  onDismiss: (extensionId: string, itemId: string) => Promise<unknown>;
  onRestore: (extensionId: string, itemId: string) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('incomplete');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const items = snapshot?.items ?? [];
  const visibleItems = useMemo(() => {
    if (filter === 'dismissed') return items.filter((item) => item.dismissed);
    if (filter === 'incomplete') return items.filter((item) => itemIsIncomplete(item) && !item.dismissed);
    return items;
  }, [filter, items]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const runWithBusy = async (key: string, run: () => Promise<unknown>) => {
    setBusyKey(key);
    try {
      await run();
    } finally {
      setBusyKey(null);
    }
  };

  const restoreItem = (item: SetupReadinessItem) => {
    void runWithBusy(item.key, async () => {
      const restored = await onRestore(item.extensionId, item.id);
      if (restored) setFilter('incomplete');
    });
  };

  const runSetupAction = (item: SetupReadinessItem, action: SetupReadinessAction) => {
    if (action.route) {
      navigate(action.route);
      onClose();
      return;
    }
    void runWithBusy(item.key, () => onRunAction(item.extensionId, item.id, action.id));
  };

  return (
    <div
      className="fixed inset-0 z-[110]"
      role="dialog"
      aria-modal="false"
      aria-label="Setup readiness"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="ui-setup-readiness-popover">
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-primary">Setup Readiness</h2>
              {snapshot && snapshot.counts.actionable > 0 ? (
                <span className="ui-notification-badge">{snapshot.counts.actionable}</span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Select
              aria-label="Setup readiness filter"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value as Filter)}
              className="h-7 w-[116px] text-[11px]"
            >
              <option value="incomplete">Incomplete</option>
              <option value="all">All</option>
              <option value="dismissed">Dismissed</option>
            </Select>
            <IconButton
              compact
              size="sm"
              type="button"
              onClick={onRefresh}
              aria-label="Check setup again"
              title="Check again"
              disabled={loading}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
            </IconButton>
            <IconButton compact size="sm" type="button" onClick={onClose} aria-label="Close setup readiness" title="Close setup readiness">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </IconButton>
          </div>
        </div>
        {loading ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-2 text-[11px] text-dim">
            <Spinner size="xs" />
            <span>Checking setup</span>
          </div>
        ) : null}
        {error ? (
          <div className="mx-4 mt-3 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-[11px] text-danger">{error}</div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading && !snapshot ? (
            <div className="flex h-full items-center justify-center text-dim">
              <Spinner size="sm" />
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <div className="space-y-2">
              {visibleItems.map((item) => (
                <SetupReadinessRow
                  key={item.key}
                  item={item}
                  busy={busyKey === item.key}
                  onRunAction={runSetupAction}
                  onDismiss={(row) => void runWithBusy(row.key, () => onDismiss(row.extensionId, row.id))}
                  onRestore={restoreItem}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
