import type { ThreadGoal } from '../../shared/types';
import { cx, Spinner } from '../ui';

export interface GoalPanelProps {
  goal: ThreadGoal | null;
  onCancel?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'text-success' },
  paused: { label: 'Paused', className: 'text-warning' },
  complete: { label: 'Complete', className: 'text-dim' },
};

export function ConversationGoalPanel({ goal, onCancel }: GoalPanelProps) {
  if (!goal || !goal.objective || goal.status === 'complete') {
    return null;
  }

  const statusConfig = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.complete;

  return (
    <div className="border-b border-border-subtle/60 bg-surface/20 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {goal.status === 'active' ? (
          <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center text-accent" aria-hidden="true">
            <Spinner size="xs" />
          </span>
        ) : null}
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-accent">Goal</span>
        <span className="min-w-0 flex-1 truncate text-primary">{goal.objective}</span>
        <span className={cx('shrink-0 text-[11px] font-medium', statusConfig.className)}>{statusConfig.label}</span>
        {goal.status === 'active' ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-danger/70 transition-colors hover:bg-danger/10 hover:text-danger"
            aria-label="Cancel goal"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="3.25" y="3.25" width="9.5" height="9.5" rx="1.2" />
            </svg>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
