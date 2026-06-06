import type { FormEvent } from 'react';

import { TextInput, TitleButton, ToolbarButton } from './ui';

interface ConversationSavedHeaderProps {
  title: string;
  cwd: string | null;
  onTitleClick?: () => void;
  cwdEditing: boolean;
  cwdDraft: string;
  cwdError?: string | null;
  cwdSaveBusy?: boolean;
  onCwdDraftChange: (value: string) => void;
  onCancelEditingCwd: () => void;
  onSaveCwd: () => void;
}

export function ConversationSavedHeader({
  title,
  cwd,
  onTitleClick,
  cwdEditing,
  cwdDraft,
  cwdError,
  cwdSaveBusy = false,
  onCwdDraftChange,
  onCancelEditingCwd,
  onSaveCwd,
}: ConversationSavedHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="min-w-0 overflow-hidden">
        {onTitleClick ? (
          <h1 className="min-w-0">
            <TitleButton
              onClick={onTitleClick}
              title="Rename conversation"
              aria-label={`Rename conversation: ${title}`}
              className="ui-conversation-title-clamp max-w-full break-words text-[38px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[42px]"
            >
              {title}
            </TitleButton>
          </h1>
        ) : (
          <h1 className="ui-conversation-title-clamp max-w-full break-words text-[38px] font-semibold leading-[1.05] tracking-[-0.02em] text-primary sm:text-[42px]">
            {title}
          </h1>
        )}
      </div>
      {cwdEditing && (
        <form
          className="flex min-w-0 flex-wrap items-center gap-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            onSaveCwd();
          }}
        >
          <TextInput
            autoFocus
            value={cwdDraft}
            onChange={(event) => onCwdDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancelEditingCwd();
              }
            }}
            placeholder={cwd ?? '~/workingdir/repo'}
            spellCheck={false}
            aria-label="Conversation working directory"
            className="min-w-[16rem] flex-1 font-mono"
            disabled={cwdSaveBusy}
          />
          <ToolbarButton type="submit" className="text-accent" disabled={cwdSaveBusy}>
            {cwdSaveBusy ? 'Switching…' : 'Switch'}
          </ToolbarButton>
          <ToolbarButton onClick={onCancelEditingCwd} disabled={cwdSaveBusy}>
            Cancel
          </ToolbarButton>
        </form>
      )}
      {cwdError && <p className="text-[11px] text-danger/80">{cwdError}</p>}
    </div>
  );
}
