import type { MentionItem } from '../../conversation/conversationMentions';
import type { ConversationContextDocRef } from '../../shared/types';
import { IconButton, MetaLabel, Pill, SectionLabel, TextButton } from '../ui';

export function ConversationContextShelf({
  attachedContextDocs,
  draftMentionItems,
  unattachedDraftMentionItems,
  contextDocsBusy,
  onRemoveAttachedContextDoc,
  onAttachMentionedDocs,
}: {
  attachedContextDocs: ConversationContextDocRef[];
  draftMentionItems: MentionItem[];
  unattachedDraftMentionItems: Array<MentionItem & { path: string }>;
  contextDocsBusy: boolean;
  onRemoveAttachedContextDoc: (path: string) => void;
  onAttachMentionedDocs: (items: Array<MentionItem & { path: string }>) => void;
}) {
  return (
    <>
      {attachedContextDocs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 pt-3 pb-2.5">
          <SectionLabel>Attached context</SectionLabel>
          {attachedContextDocs.map((doc) => (
            <Pill key={doc.path} className="gap-1.5" title={doc.summary ? `${doc.path}\n\n${doc.summary}` : doc.path}>
              <MetaLabel tone="muted">{doc.kind}</MetaLabel>
              <span className="max-w-[18rem] truncate text-secondary">{doc.title}</span>
              <IconButton
                compact
                type="button"
                onClick={() => {
                  onRemoveAttachedContextDoc(doc.path);
                }}
                disabled={contextDocsBusy}
                className="ml-0.5 shrink-0 leading-none disabled:opacity-50"
                title={`Remove ${doc.title} from attached context`}
              >
                ×
              </IconButton>
            </Pill>
          ))}
        </div>
      )}

      {draftMentionItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 pt-3 pb-2.5">
          <SectionLabel>Prompt references</SectionLabel>
          {unattachedDraftMentionItems.length > 0 && (
            <TextButton
              type="button"
              onClick={() => {
                onAttachMentionedDocs(unattachedDraftMentionItems);
              }}
              disabled={contextDocsBusy}
              tone="accent"
              className="disabled:cursor-default disabled:opacity-50"
            >
              {contextDocsBusy ? 'attaching…' : `attach ${unattachedDraftMentionItems.length}`}
            </TextButton>
          )}
          {draftMentionItems.map((item) => (
            <Pill key={`${item.kind}:${item.id}`} className="gap-1.5" title={item.summary || item.title || item.id}>
              <MetaLabel tone="muted">{item.kind}</MetaLabel>
              <span className="font-mono text-accent">{item.id}</span>
            </Pill>
          ))}
        </div>
      )}
    </>
  );
}
