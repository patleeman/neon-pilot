import { useEffect } from 'react';

import type { ThreadGoal } from '../../shared/types';
import { setExtensionCommandContext } from '../../extensions/commands';
import { Button, cx, MetaLabel, Spinner } from '../ui';
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

export function ConversationGoalPanel({ goal, onCancel }: GoalPanelProps) {
  const goalActive = Boolean(goal?.objective && goal.status === 'active');

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
        <MetaLabel tone="accent" className="font-bold">
          Goal
        </MetaLabel>
        <span className="min-w-0 flex-1 truncate text-primary">{goal.objective}</span>
        <span className={cx('shrink-0 text-[11px] font-medium', statusConfig.className)}>{statusConfig.label}</span>
        {goal.status === 'active' ? (
          <Button variant="action" tone="danger" type="button" onClick={onCancel} className="shrink-0 text-[11px]" aria-label="Cancel goal">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="3.25" y="3.25" width="9.5" height="9.5" rx="1.2" />
            </svg>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
