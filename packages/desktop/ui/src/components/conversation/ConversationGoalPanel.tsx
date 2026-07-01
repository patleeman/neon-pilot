import { useEffect, useMemo, useState } from 'react';

import { setExtensionCommandContext } from '../../extensions/commands';
import type { ThreadGoal } from '../../shared/types';
import { Button, cx, ShelfStatusRow, Spinner } from '../ui';
import { CONVERSATION_CANCEL_GOAL_COMMAND_EVENT } from './conversationGoalCommands';

export interface GoalPanelProps {
  goal: ThreadGoal | null;
  onCancel?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'text-success' },
  paused: { label: 'Paused', className: 'text-warning' },
  complete: { label: 'Complete', className: 'text-dim' },
};

function formatElapsedTime(startedAt: string | null | undefined, nowMs: number): string | null {
  if (!startedAt) return null;
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs) || startedMs > nowMs) return null;
  const totalSeconds = Math.floor((nowMs - startedMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function ConversationGoalPanel({ goal, onCancel }: GoalPanelProps) {
  const goalActive = Boolean(goal?.objective && goal.status === 'active');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const elapsedTime = useMemo(() => formatElapsedTime(goal?.startedAt, nowMs), [goal?.startedAt, nowMs]);

  useEffect(() => {
    setExtensionCommandContext('conversation.goalActive', goalActive);
    return () => setExtensionCommandContext('conversation.goalActive', null);
  }, [goalActive]);

  useEffect(() => {
    if (!goalActive || !onCancel) return;
    function handleCancelGoalCommand() {
      onCancel?.();
    }
    window.addEventListener(CONVERSATION_CANCEL_GOAL_COMMAND_EVENT, handleCancelGoalCommand);
    return () => window.removeEventListener(CONVERSATION_CANCEL_GOAL_COMMAND_EVENT, handleCancelGoalCommand);
  }, [goalActive, onCancel]);

  useEffect(() => {
    if (!goal?.startedAt) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [goal?.startedAt]);

  if (!goal || !goal.objective || goal.status === 'complete') {
    return null;
  }

  const statusConfig = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.complete;

  return (
    <div className="border-b border-border-subtle/60 bg-surface/20 px-4 py-2.5">
      <ShelfStatusRow
        label="Goal"
        leading={
          goal.status === 'active' ? (
            <span className="inline-flex h-3 w-3 items-center justify-center text-accent" aria-hidden="true">
              <Spinner size="xs" />
            </span>
          ) : null
        }
        status={
          <span className={cx('text-[11px] font-medium', statusConfig.className)}>
            {statusConfig.label}
            {elapsedTime ? ` ${elapsedTime}` : ''}
          </span>
        }
        actions={
          goal.status === 'active' ? (
            <Button variant="action" tone="danger" type="button" onClick={onCancel} aria-label="Cancel goal">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="3.25" y="3.25" width="9.5" height="9.5" rx="1.2" />
              </svg>
              Cancel
            </Button>
          ) : null
        }
      >
        <span className="block truncate text-primary">{goal.objective}</span>
      </ShelfStatusRow>
    </div>
  );
}
