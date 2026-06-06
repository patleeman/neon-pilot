import { useMemo, useState } from 'react';

import type { ConversationAttachmentRecord, ConversationAttachmentSummary } from '../shared/types';
import { timeAgo } from '../shared/utils';
import {
  CardMeta,
  CardTitle,
  cx,
  PanelMessage,
  Pill,
  ResourcePickerDialog,
  ResourcePickerList,
  ResourcePickerToolbar,
  SearchInput,
  SurfacePanel,
  TextButton,
  ToolbarButton,
} from './ui';

interface AttachSelection {
  attachment: ConversationAttachmentSummary;
  revision: number;
}

interface Props {
  attachments: ConversationAttachmentSummary[];
  onLoadAttachment: (attachmentId: string) => Promise<ConversationAttachmentRecord>;
  onAttach: (selection: AttachSelection) => void;
  onClose: () => void;
}

export function ConversationDrawingsPickerModal({ attachments, onLoadAttachment, onAttach, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [expandedAttachmentId, setExpandedAttachmentId] = useState<string | null>(null);
  const [recordsById, setRecordsById] = useState<Record<string, ConversationAttachmentRecord>>({});
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return attachments;
    }

    return attachments.filter((attachment) => {
      const haystack = [attachment.id, attachment.title, attachment.kind].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [attachments, query]);

  async function toggleHistory(attachment: ConversationAttachmentSummary) {
    const isExpanded = expandedAttachmentId === attachment.id;
    if (isExpanded) {
      setExpandedAttachmentId(null);
      return;
    }

    if (!recordsById[attachment.id]) {
      setLoadingAttachmentId(attachment.id);
      try {
        const record = await onLoadAttachment(attachment.id);
        setRecordsById((current) => ({ ...current, [attachment.id]: record }));
      } finally {
        setLoadingAttachmentId(null);
      }
    }

    setExpandedAttachmentId(attachment.id);
  }

  return (
    <ResourcePickerDialog
      title="Conversation drawings"
      description="Attach a saved drawing (latest or a specific revision) to your next prompt."
      actions={<ToolbarButton onClick={onClose}>Close</ToolbarButton>}
      onClose={onClose}
      backdropStyle={{ background: 'rgb(0 0 0 / 0.55)', backdropFilter: 'blur(2px)' }}
      style={{ maxWidth: '840px', maxHeight: 'calc(100vh - 5rem)' }}
    >
      <ResourcePickerToolbar
        search={
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="bg-elevated text-[13px]"
            placeholder="Filter drawings by id or title..."
          />
        }
        actions={
          <Pill tone="muted" mono className="tabular-nums">
            {filtered.length}
          </Pill>
        }
      />

      <ResourcePickerList className="space-y-2">
        {filtered.length === 0 && (
          <PanelMessage align="center" className="py-8">
            No drawings match this filter.
          </PanelMessage>
        )}

        {filtered.map((attachment) => {
          const isExpanded = expandedAttachmentId === attachment.id;
          const isLoading = loadingAttachmentId === attachment.id;
          const record = recordsById[attachment.id];

          return (
            <SurfacePanel key={attachment.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate">{attachment.title}</CardTitle>
                  <CardMeta className="mt-1 font-mono">
                    {attachment.id} · rev {attachment.currentRevision} · updated {timeAgo(attachment.updatedAt)}
                  </CardMeta>
                </div>
                <div className="flex items-center gap-2">
                  <ToolbarButton onClick={() => onAttach({ attachment, revision: attachment.currentRevision })}>Attach latest</ToolbarButton>
                  <ToolbarButton
                    onClick={() => {
                      void toggleHistory(attachment);
                    }}
                    className={cx(isExpanded && 'text-accent')}
                  >
                    {isExpanded ? 'Hide history' : 'History'}
                  </ToolbarButton>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2.5 border-t border-border-subtle pt-2 space-y-1.5">
                  {isLoading && <PanelMessage className="px-0 py-0">Loading revisions…</PanelMessage>}

                  {!isLoading &&
                    record &&
                    record.revisions.length > 0 &&
                    record.revisions
                      .slice()
                      .sort((left, right) => right.revision - left.revision)
                      .map((revision) => (
                        <div key={revision.revision} className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="min-w-0 flex-1 text-dim">
                            <span className="font-mono text-secondary">rev {revision.revision}</span>
                            <span>· {timeAgo(revision.createdAt)}</span>
                            {revision.note && <span className="truncate">· {revision.note}</span>}
                          </div>
                          <TextButton
                            className="text-[11px] text-accent hover:text-accent/80"
                            tone="accent"
                            onClick={() => onAttach({ attachment, revision: revision.revision })}
                          >
                            Attach
                          </TextButton>
                        </div>
                      ))}

                  {!isLoading && record && record.revisions.length === 0 && (
                    <PanelMessage className="px-0 py-0">No saved revisions.</PanelMessage>
                  )}
                </div>
              )}
            </SurfacePanel>
          );
        })}
      </ResourcePickerList>
    </ResourcePickerDialog>
  );
}
