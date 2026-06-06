import type { ConversationBackgroundWorkKind } from '../conversation/conversationExecutionActivity';
import { sessionNeedsAttention } from '../session/sessionIndicators';
import { cx, Spinner } from './ui';

function BackgroundWorkIcon({ kind }: { kind?: ConversationBackgroundWorkKind | null }) {
  if (kind === 'subagent') return <span aria-hidden="true">✦</span>;
  if (kind === 'command') {
    return (
      <span aria-hidden="true" className="font-mono text-[10px] leading-none tracking-[-0.08em]">
        ›_
      </span>
    );
  }
  return <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />;
}

export function ConversationStatusText({
  isRunning,
  needsAttention,
  hasPendingRuns,
  backgroundWorkKind,
  className,
}: {
  isRunning?: boolean;
  needsAttention?: boolean;
  hasPendingRuns?: boolean;
  backgroundWorkKind?: ConversationBackgroundWorkKind | null;
  className?: string;
}) {
  if (isRunning) {
    return (
      <span
        role="img"
        aria-label="Running conversation"
        className={cx('flex h-3 w-3 items-center justify-center text-accent', className)}
        title="Agent is still running"
      >
        <Spinner size="xs" />
      </span>
    );
  }

  if (hasPendingRuns) {
    return (
      <span
        role="img"
        aria-label="Background work running"
        className={cx('flex h-3 w-3 items-center justify-center text-accent/80', className)}
        title="Background work is running"
      >
        <BackgroundWorkIcon kind={backgroundWorkKind} />
      </span>
    );
  }

  if (!sessionNeedsAttention({ isRunning, needsAttention })) {
    return null;
  }

  return (
    <span
      role="img"
      aria-label="Conversation needs review"
      className={cx('block h-2 w-2 rounded-full bg-warning', className)}
      title="Stopped with new output or linked updates you have not viewed yet"
    />
  );
}
