import { TitleButton } from './ui';

export const CONVERSATION_TITLE_CLASS =
  'ui-conversation-title-clamp max-w-full break-words text-[38px] font-semibold leading-[1.05] tracking-[-0.02em] text-primary sm:text-[42px]';

interface ConversationSavedHeaderProps {
  title: string;
  onTitleClick?: () => void;
}

export function ConversationSavedHeader({ title, onTitleClick }: ConversationSavedHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="min-w-0 overflow-hidden">
        {onTitleClick ? (
          <h1 className={CONVERSATION_TITLE_CLASS}>
            <TitleButton
              onClick={onTitleClick}
              title="Rename conversation"
              aria-label={`Rename conversation: ${title}`}
              className="ui-conversation-title-clamp max-w-full break-words"
            >
              {title}
            </TitleButton>
          </h1>
        ) : (
          <h1 className={CONVERSATION_TITLE_CLASS}>{title}</h1>
        )}
      </div>
    </div>
  );
}
