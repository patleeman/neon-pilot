import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../ui';
import { ConversationComposerShell, type ConversationComposerShellState } from './ConversationComposerChrome';

export type ConversationComposerLayout = 'main' | 'rail';

export interface ConversationComposerContainerProps
  extends ConversationComposerShellState, Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  layout?: ConversationComposerLayout;
  shellClassName?: string;
  dragOverlay?: ReactNode;
  shelves?: ReactNode;
  inputControls: ReactNode;
}

export const ConversationComposerContainer = forwardRef<HTMLDivElement, ConversationComposerContainerProps>(
  function ConversationComposerContainer(
    {
      layout = 'main',
      className,
      shellClassName,
      dragOverlay,
      shelves,
      inputControls,
      dragOver,
      hasInteractiveOverlay,
      streamIsStreaming,
      autoModeEnabled,
      runMode,
      ...containerProps
    },
    ref,
  ) {
    return (
      <div className={cx('min-w-0', layout === 'rail' && 'w-full max-w-full overflow-hidden px-3 py-3', className)} {...containerProps}>
        {shelves ? <div className="mb-2">{shelves}</div> : null}
        <ConversationComposerShell
          ref={ref}
          className={cx('min-w-0 max-w-full', shellClassName)}
          dragOver={dragOver}
          hasInteractiveOverlay={hasInteractiveOverlay}
          streamIsStreaming={streamIsStreaming}
          autoModeEnabled={autoModeEnabled}
          runMode={runMode}
        >
          {dragOverlay}
          {inputControls}
        </ConversationComposerShell>
      </div>
    );
  },
);
