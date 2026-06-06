import { useMemo, useState } from 'react';

import type { ConversationAttachmentRecord, ConversationAttachmentSummary } from '../shared/types';
import { timeAgo } from '../shared/utils';
import { Button, cx, Dialog, DialogBody, DialogHeader, Pill, SurfacePanel, ToolbarButton } from './ui';

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
    <Dialog
      aria-label="Conversation drawings"
      onClose={onClose}
      backdropStyle={{ background: 'rgb(0 0 0 / 0.55)', backdropFilter: 'blur(2px)' }}
      style={{ maxWidth: '840px', maxHeight: 'calc(100vh - 5rem)' }}
    >
      <DialogHeader
        title="Conversation drawings"
        description="Attach a saved drawing (latest or a specific revision) to your next prompt."
        actions={<ToolbarButton onClick={onClose}>Close</ToolbarButton>}
      />

      <div className="border-b border-border-subtle px-4 pb-3">
        <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-elevated px-3 py-2">
          <span className="text-dim text-[12px]">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 bg-transparent text-[13px] text-primary placeholder:text-dim outline-none"
            placeholder="Filter drawings by id or title…"
          />
          <Pill tone="muted" mono className="tabular-nums">
            {filtered.length}
          </Pill>
        </div>
      </div>

      <DialogBody className="space-y-2">
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <p className="py-8 text-center text-[12px] text-dim">No drawings match this filter.</p>}

          {filtered.map((attachment) => {
            const isExpanded = expandedAttachmentId === attachment.id;
            const isLoading = loadingAttachmentId === attachment.id;
            const record = recordsById[attachment.id];

            return (
              <SurfacePanel key={attachment.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-primary truncate">{attachment.title}</p>
                    <p className="mt-1 text-[11px] text-dim font-mono">
                      {attachment.id} · rev {attachment.currentRevision} · updated {timeAgo(attachment.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToolbarButton onClick={() => onAttach({ attachment, revision: attachment.currentRevision })}>
                      Attach latest
                    </ToolbarButton>
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
                    {isLoading && <p className="text-[11px] text-dim">Loading revisions…</p>}

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
                            <Button
                              variant="ghost"
                              className="text-[11px] text-accent hover:text-accent/80"
                              onClick={() => onAttach({ attachment, revision: revision.revision })}
                            >
                              Attach
                            </Button>
                          </div>
                        ))}

                    {!isLoading && record && record.revisions.length === 0 && <p className="text-[11px] text-dim">No saved revisions.</p>}
                  </div>
                )}
              </SurfacePanel>
            );
          })}
        </div>
      </DialogBody>
    </Dialog>
  );
}
