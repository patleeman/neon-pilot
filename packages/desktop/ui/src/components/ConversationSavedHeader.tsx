import { TitleButton } from './ui';

interface ConversationSavedHeaderProps {
  title: string;
  onTitleClick?: () => void;
}

export function ConversationSavedHeader({
  title,
  onTitleClick,
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
    </div>
  );
}
