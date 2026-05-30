import { type ReactNode, type Ref } from 'react';

import { Pill } from '../ui';
import {
  ConversationComposerContainer,
  type ConversationComposerContainerProps,
  type ConversationComposerLayout,
} from './ConversationComposerContainer';

interface ConversationComposerNotice {
  tone: 'accent' | 'danger' | 'success' | 'warning';
  text: string;
}

interface ConversationComposerProps extends Omit<ConversationComposerContainerProps, 'children' | 'shelves' | 'inputControls'> {
  shellRef?: Ref<HTMLDivElement>;
  shellClassName?: string;
  menus?: ReactNode;
  shelves?: ReactNode;
  inputControls: ReactNode;
  composerMeta?: ReactNode;
  notice?: ConversationComposerNotice | null;
  childrenClassName?: string;
  containerClassName?: string;
  layoutMode?: ConversationComposerLayout;
}

export function ConversationComposer({
  shellRef,
  shellClassName,
  layoutMode = 'main',
  menus,
  shelves,
  inputControls,
  composerMeta,
  notice,
  childrenClassName,
  containerClassName,
  dragOverlay,
  onDragOver,
  onDragLeave,
  onDrop,
  className,
  ...containerProps
}: ConversationComposerProps) {
  return (
    <div className={className} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {notice && (
        <div className="mb-2 text-center">
          <Pill tone={notice.tone}>{notice.text}</Pill>
        </div>
      )}

      <div className={childrenClassName || 'relative mx-auto w-full max-w-6xl'}>
        {menus}

        <ConversationComposerContainer
          ref={shellRef}
          layout={layoutMode}
          shellClassName={shellClassName}
          className={containerClassName}
          dragOverlay={dragOverlay}
          shelves={shelves}
          inputControls={inputControls}
          {...containerProps}
        />

        {composerMeta}
      </div>
    </div>
  );
}
