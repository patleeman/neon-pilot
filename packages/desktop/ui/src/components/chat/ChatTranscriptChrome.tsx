import type { RefObject } from 'react';
import React from 'react';

import { MenuItem, MenuSeparator, MenuShell } from '../ui';
import type { ReplySelectionContextMenuState, TranscriptSelectionAction } from './useChatReplySelection.js';

void React;

export function StreamingIndicator({ label }: { label: string }) {
  return (
    <div className="flex gap-2 items-start" role="status" aria-live="polite">
      <div className="flex items-center gap-2 pt-1 text-[12px] text-secondary italic">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent animate-pulse not-italic" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function SelectionContextMenu({
  menuState,
  menuRef,
  selectionActions = [],
  onAction,
}: {
  menuState: ReplySelectionContextMenuState;
  menuRef: RefObject<HTMLDivElement>;
  selectionActions?: TranscriptSelectionAction[];
  onAction: (action: 'reply' | 'copy' | TranscriptSelectionAction) => Promise<void> | void;
}) {
  return (
    <MenuShell
      ref={menuRef}
      className="fixed bottom-auto left-auto right-auto top-auto mb-0 min-w-[224px]"
      style={{ left: menuState.x, top: menuState.y }}
      aria-label="Selected transcript text actions"
      data-selection-context-menu="true"
    >
      <div className="space-y-px">
        {menuState.replySelection ? (
          <>
            {selectionActions.length > 0 ? (
              <>
                <div className="flex items-center gap-1 px-2 py-1" role="group" aria-label="Selection reply starters">
                  {selectionActions.map((action) => (
                    <button
                      key={`${action.extensionId}:${action.id}`}
                      type="button"
                      title={action.title}
                      aria-label={action.title}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={() => {
                        void onAction(action);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      role="menuitem"
                    >
                      {action.icon ?? action.title}
                    </button>
                  ))}
                </div>
                <MenuSeparator />
              </>
            ) : null}
            <MenuItem
              onClick={() => {
                void onAction('reply');
              }}
            >
              Reply with Selection
            </MenuItem>
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem
          onClick={() => {
            void onAction('copy');
          }}
        >
          Copy
        </MenuItem>
      </div>
    </MenuShell>
  );
}
