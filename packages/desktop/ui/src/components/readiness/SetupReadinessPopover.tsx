import { useEffect, useMemo, useState } from 'react';

import type { SetupReadinessItem, SetupReadinessSnapshot, SetupReadinessStatus } from '../../shared/types';
import { cx, IconButton, MetaLabel, Spinner, StatusDot, type StatusDotTone, TextButton, ToolbarButton } from '../ui';

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
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <StatusDot tone={filter === 'incomplete' ? 'success' : 'muted'} size="md" className="mx-auto" />
        <p className="mt-3 text-[12px] text-secondary">{text}</p>
      </div>
    </div>
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
  onRunAction: (item: SetupReadinessItem, actionId: string) => void;
  onDismiss: (item: SetupReadinessItem) => void;
  onRestore: (item: SetupReadinessItem) => void;
}) {
  return (
    <div className={cx('ui-setup-readiness-row', item.dismissed && 'opacity-60')}>
      <div className="flex min-w-0 items-start gap-2">
        <StatusDot tone={STATUS_TONE[item.status]} size="xs" className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[12px] font-semibold text-primary">{item.title}</h3>
            <MetaLabel tone={item.status === 'ready' ? 'success' : item.status === 'blocked' ? 'danger' : 'muted'}>
              {STATUS_LABEL[item.status]}
            </MetaLabel>
          </div>
          <p className="mt-0.5 text-[11px] leading-[17px] text-secondary">{item.description}</p>
          {item.detail || item.error ? (
            <p className={cx('mt-1 text-[10px] leading-[16px]', item.error ? 'text-danger' : 'text-dim')}>{item.error ?? item.detail}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <MetaLabel tone="muted">{item.extensionName}</MetaLabel>
            <MetaLabel tone="muted">{item.severity}</MetaLabel>
            {item.dismissed ? <MetaLabel tone="secondary">Dismissed</MetaLabel> : null}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {item.dismissed ? (
          <TextButton type="button" className="px-1.5 py-0.5 text-[10px]" onClick={() => onRestore(item)} disabled={busy}>
            Restore
          </TextButton>
        ) : null}
        {!item.dismissed && item.dismissible && itemIsIncomplete(item) ? (
          <TextButton type="button" className="px-1.5 py-0.5 text-[10px]" onClick={() => onDismiss(item)} disabled={busy}>
            Dismiss
          </TextButton>
        ) : null}
        {item.actions.map((action) => (
          <ToolbarButton
            key={action.id}
            type="button"
            className={cx('px-2 py-1 text-[10px]', action.tone === 'primary' && 'text-accent', action.tone === 'danger' && 'text-danger')}
            onClick={() => onRunAction(item, action.id)}
            disabled={busy}
          >
            {busy ? <Spinner size="xs" /> : null}
            {action.label}
          </ToolbarButton>
        ))}
      </div>
    </div>
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
  onRunAction: (extensionId: string, itemId: string, actionId: string) => Promise<void>;
  onDismiss: (extensionId: string, itemId: string) => Promise<void>;
  onRestore: (extensionId: string, itemId: string) => Promise<void>;
}) {
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

  const runWithBusy = async (key: string, run: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await run();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130]"
      role="dialog"
      aria-modal="false"
      aria-label="Setup readiness"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="ui-setup-readiness-popover">
        <div className="flex shrink-0 items-start justify-between border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-primary">Setup Readiness</h2>
              {snapshot && snapshot.counts.actionable > 0 ? (
                <span className="ui-notification-badge">{snapshot.counts.actionable}</span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] leading-[17px] text-secondary">
              Complete setup items extensions need before their features work reliably.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
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
            <IconButton compact size="sm" type="button" onClick={onClose} aria-label="Close setup readiness">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </IconButton>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-b border-border-subtle px-4 py-2">
          {(['incomplete', 'all', 'dismissed'] as const).map((nextFilter) => (
            <TextButton
              key={nextFilter}
              type="button"
              className={cx('rounded px-2 py-1 text-[10px]', filter === nextFilter && 'bg-steel/10 text-primary')}
              onClick={() => setFilter(nextFilter)}
            >
              {nextFilter === 'incomplete' ? 'Incomplete' : nextFilter === 'dismissed' ? 'Dismissed' : 'All'}
            </TextButton>
          ))}
          {loading ? <Spinner size="xs" className="ml-auto" /> : null}
        </div>
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
                  onRunAction={(row, actionId) => void runWithBusy(row.key, () => onRunAction(row.extensionId, row.id, actionId))}
                  onDismiss={(row) => void runWithBusy(row.key, () => onDismiss(row.extensionId, row.id))}
                  onRestore={(row) => void runWithBusy(row.key, () => onRestore(row.extensionId, row.id))}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
