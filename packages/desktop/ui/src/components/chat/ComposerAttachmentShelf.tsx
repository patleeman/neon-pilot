import { useCallback, useEffect, useState } from 'react';

import { setExtensionCommandContext } from '../../extensions/commands';
import { AttachmentChip, AttachmentChipButton, cx, IconButton, TextButton } from '../ui';
import {
  COMPOSER_EDIT_FIRST_DRAWING_COMMAND_EVENT,
  COMPOSER_PREVIEW_FIRST_ATTACHMENT_COMMAND_EVENT,
  COMPOSER_PREVIEW_FIRST_DRAWING_COMMAND_EVENT,
  COMPOSER_REMOVE_FIRST_ATTACHMENT_COMMAND_EVENT,
  COMPOSER_REMOVE_FIRST_DRAWING_COMMAND_EVENT,
} from './composerAttachmentCommands';
import { IMAGE_PREVIEW_CLOSE_COMMAND_EVENT } from './imagePreviewCommands';

interface ComposerAttachmentShelfDrawingAttachment {
  localId: string;
  title: string;
  attachmentId?: string;
  revision?: number;
  dirty: boolean;
  previewUrl: string;
}

interface ComposerImageAttachment {
  localId: string;
  name?: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
}

interface ComposerVideoAttachment {
  localId: string;
  name?: string;
  mimeType: string;
  size: number;
}

interface ComposerAudioAttachment {
  localId: string;
  name?: string;
  mimeType: string;
  size: number;
}

interface ComposerDocumentAttachment {
  localId: string;
  name?: string;
  mimeType: string;
  size: number;
}

interface ComposerPreviewImage {
  alt: string;
  src: string;
  label: string;
  dispose?: () => void;
}

interface ComposerAttachmentShelfProps {
  attachments: ComposerImageAttachment[];
  videoAttachments?: ComposerVideoAttachment[];
  audioAttachments?: ComposerAudioAttachment[];
  documentAttachments?: ComposerDocumentAttachment[];
  drawingAttachments: ComposerAttachmentShelfDrawingAttachment[];
  drawingsBusy?: boolean;
  drawingsError?: string | null;
  onRemoveAttachment: (index: number) => void;
  onRemoveVideoAttachment?: (index: number) => void;
  onRemoveAudioAttachment?: (index: number) => void;
  onRemoveDocumentAttachment?: (index: number) => void;
  onEditDrawing: (localId: string) => void;
  onRemoveDrawingAttachment: (localId: string) => void;
}

const FILE_ICONS: Record<string, string> = {
  'image/': '🖼',
  'text/': '📄',
  'application/json': '{ }',
  'application/pdf': '📕',
  'audio/': '♪',
  'video/': '🎬',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function fileIcon(type: string) {
  return Object.entries(FILE_ICONS).find(([prefix]) => type.startsWith(prefix))?.[1] ?? '📎';
}

function buildDrawingPreviewTitle(attachment: ComposerAttachmentShelfDrawingAttachment): string {
  const revisionText = attachment.revision ? ` (rev ${attachment.revision})` : '';
  return `${attachment.title}${revisionText}`;
}

function ComposerImagePreviewModal({ image, onClose }: { image: ComposerPreviewImage; onClose: () => void }) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setExtensionCommandContext('imagePreview.active', true);
    return () => setExtensionCommandContext('imagePreview.active', null);
  }, []);

  useEffect(() => {
    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onClose();
    }

    function closeFromCommand() {
      onClose();
    }

    window.addEventListener('keydown', closeFromKeyboard);
    window.addEventListener(IMAGE_PREVIEW_CLOSE_COMMAND_EVENT, closeFromCommand);
    return () => {
      window.removeEventListener('keydown', closeFromKeyboard);
      window.removeEventListener(IMAGE_PREVIEW_CLOSE_COMMAND_EVENT, closeFromCommand);
    };
  }, [onClose]);

  return (
    <div
      className="ui-overlay-backdrop"
      style={{ background: 'rgb(0 0 0 / 0.72)', backdropFilter: 'blur(2px)', paddingTop: '1rem' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={image.label}
        className="ui-dialog-shell relative"
        style={{
          width: 'min(96vw, 1440px)',
          height: 'min(94vh, 1040px)',
          maxHeight: 'calc(100vh - 2rem)',
          background: 'rgb(10 13 20 / 0.96)',
        }}
      >
        <div className="relative min-h-0 flex-1 bg-black/30 px-4 py-4 sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3 sm:inset-x-6 sm:top-6">
            <div className="pointer-events-auto min-w-0 rounded-lg bg-black/45 px-3 py-1.5" title={image.label}>
              <p className="truncate text-[12px] font-medium text-white/95">{image.label}</p>
              {dimensions ? (
                <p className="mt-0.5 text-[10px] text-white/60">
                  {dimensions.width}×{dimensions.height}
                </p>
              ) : null}
            </div>
            <IconButton
              shape="circle"
              compact
              onClick={onClose}
              aria-label="Close image preview"
              className="pointer-events-auto h-8 w-8 shrink-0 border-white/15 bg-black/45 text-[16px] leading-none text-white/80 hover:text-white"
            >
              ×
            </IconButton>
          </div>
          <img
            src={image.src}
            alt={image.alt}
            className="h-full w-full object-contain"
            onLoad={(event) => {
              const nextDimensions = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              setDimensions((current) =>
                current?.width === nextDimensions.width && current?.height === nextDimensions.height ? current : nextDimensions,
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ComposerAttachmentShelf({
  attachments,
  videoAttachments = [],
  audioAttachments = [],
  documentAttachments = [],
  drawingAttachments,
  drawingsBusy = false,
  drawingsError = null,
  onRemoveAttachment,
  onRemoveVideoAttachment,
  onRemoveAudioAttachment,
  onRemoveDocumentAttachment,
  onEditDrawing,
  onRemoveDrawingAttachment,
}: ComposerAttachmentShelfProps) {
  const [previewImage, setPreviewImage] = useState<ComposerPreviewImage | null>(null);
  const firstPreviewableAttachment =
    attachments.find((attachment) => attachment.mimeType.startsWith('image/') && Boolean(attachment.previewUrl)) ?? null;
  const firstAttachment = attachments[0] ?? videoAttachments[0] ?? audioAttachments[0] ?? documentAttachments[0] ?? null;
  const firstAttachmentKind = attachments[0]
    ? 'image'
    : videoAttachments[0]
      ? 'video'
      : audioAttachments[0]
        ? 'audio'
        : documentAttachments[0]
          ? 'document'
          : null;
  const firstDrawing = drawingAttachments[0] ?? null;

  useEffect(
    () => () => {
      previewImage?.dispose?.();
    },
    [previewImage],
  );

  const closePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const openAttachmentPreview = useCallback((attachment: ComposerImageAttachment) => {
    if (!attachment.mimeType.startsWith('image/') || !attachment.previewUrl) {
      return;
    }

    const label = attachment.name || 'Image attachment';
    setPreviewImage({
      alt: label,
      src: attachment.previewUrl,
      label,
    });
  }, []);

  const openDrawingPreview = useCallback((attachment: ComposerAttachmentShelfDrawingAttachment) => {
    const label = buildDrawingPreviewTitle(attachment);
    setPreviewImage({
      alt: label,
      src: attachment.previewUrl,
      label,
    });
  }, []);

  useEffect(() => {
    setExtensionCommandContext('composer.canPreviewFirstAttachment', Boolean(firstPreviewableAttachment));
    setExtensionCommandContext('composer.canRemoveFirstAttachment', Boolean(firstAttachment));
    setExtensionCommandContext('composer.canPreviewFirstDrawing', Boolean(firstDrawing));
    setExtensionCommandContext('composer.canEditFirstDrawing', Boolean(firstDrawing));
    setExtensionCommandContext('composer.canRemoveFirstDrawing', Boolean(firstDrawing));
    return () => {
      setExtensionCommandContext('composer.canPreviewFirstAttachment', null);
      setExtensionCommandContext('composer.canRemoveFirstAttachment', null);
      setExtensionCommandContext('composer.canPreviewFirstDrawing', null);
      setExtensionCommandContext('composer.canEditFirstDrawing', null);
      setExtensionCommandContext('composer.canRemoveFirstDrawing', null);
    };
  }, [firstAttachment, firstDrawing, firstPreviewableAttachment]);

  useEffect(() => {
    if (!firstPreviewableAttachment) return;
    function handlePreviewFirstAttachmentCommand() {
      openAttachmentPreview(firstPreviewableAttachment!);
    }
    window.addEventListener(COMPOSER_PREVIEW_FIRST_ATTACHMENT_COMMAND_EVENT, handlePreviewFirstAttachmentCommand);
    return () => window.removeEventListener(COMPOSER_PREVIEW_FIRST_ATTACHMENT_COMMAND_EVENT, handlePreviewFirstAttachmentCommand);
  }, [firstPreviewableAttachment, openAttachmentPreview]);

  useEffect(() => {
    if (!firstAttachment) return;
    function handleRemoveFirstAttachmentCommand() {
      if (firstAttachmentKind === 'image') onRemoveAttachment(0);
      else if (firstAttachmentKind === 'video') onRemoveVideoAttachment?.(0);
      else if (firstAttachmentKind === 'audio') onRemoveAudioAttachment?.(0);
      else if (firstAttachmentKind === 'document') onRemoveDocumentAttachment?.(0);
    }
    window.addEventListener(COMPOSER_REMOVE_FIRST_ATTACHMENT_COMMAND_EVENT, handleRemoveFirstAttachmentCommand);
    return () => window.removeEventListener(COMPOSER_REMOVE_FIRST_ATTACHMENT_COMMAND_EVENT, handleRemoveFirstAttachmentCommand);
  }, [
    firstAttachment,
    firstAttachmentKind,
    onRemoveAttachment,
    onRemoveAudioAttachment,
    onRemoveDocumentAttachment,
    onRemoveVideoAttachment,
  ]);

  useEffect(() => {
    if (!firstDrawing) return;
    function handlePreviewFirstDrawingCommand() {
      openDrawingPreview(firstDrawing!);
    }
    window.addEventListener(COMPOSER_PREVIEW_FIRST_DRAWING_COMMAND_EVENT, handlePreviewFirstDrawingCommand);
    return () => window.removeEventListener(COMPOSER_PREVIEW_FIRST_DRAWING_COMMAND_EVENT, handlePreviewFirstDrawingCommand);
  }, [firstDrawing, openDrawingPreview]);

  useEffect(() => {
    if (!firstDrawing) return;
    function handleEditFirstDrawingCommand() {
      onEditDrawing(firstDrawing!.localId);
    }
    window.addEventListener(COMPOSER_EDIT_FIRST_DRAWING_COMMAND_EVENT, handleEditFirstDrawingCommand);
    return () => window.removeEventListener(COMPOSER_EDIT_FIRST_DRAWING_COMMAND_EVENT, handleEditFirstDrawingCommand);
  }, [firstDrawing, onEditDrawing]);

  useEffect(() => {
    if (!firstDrawing) return;
    function handleRemoveFirstDrawingCommand() {
      onRemoveDrawingAttachment(firstDrawing!.localId);
    }
    window.addEventListener(COMPOSER_REMOVE_FIRST_DRAWING_COMMAND_EVENT, handleRemoveFirstDrawingCommand);
    return () => window.removeEventListener(COMPOSER_REMOVE_FIRST_DRAWING_COMMAND_EVENT, handleRemoveFirstDrawingCommand);
  }, [firstDrawing, onRemoveDrawingAttachment]);

  return (
    <>
      {(attachments.length > 0 ||
        videoAttachments.length > 0 ||
        audioAttachments.length > 0 ||
        documentAttachments.length > 0 ||
        drawingAttachments.length > 0 ||
        drawingsBusy ||
        drawingsError) && (
        <div className="border-b border-border-subtle/60 bg-base/20 px-4 py-3">
          {(attachments.length > 0 || videoAttachments.length > 0 || audioAttachments.length > 0 || documentAttachments.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((file, index) => {
                const fileName = file.name || 'Image attachment';
                const canPreview = file.mimeType.startsWith('image/') && Boolean(file.previewUrl);
                const summary = (
                  <>
                    <span className="shrink-0">{fileIcon(file.mimeType)}</span>
                    <span className="truncate text-secondary">{fileName}</span>
                    <span className="shrink-0 text-dim">{formatBytes(file.size)}</span>
                  </>
                );

                return (
                  <AttachmentChip key={file.localId || `${fileName}-${file.size}-${index}`} className="max-w-[220px]">
                    {canPreview ? (
                      <AttachmentChipButton
                        onClick={() => openAttachmentPreview(file)}
                        className="cursor-zoom-in"
                        title={`Preview ${fileName}`}
                        aria-label={`Preview ${fileName}`}
                      >
                        {summary}
                      </AttachmentChipButton>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1">{summary}</div>
                    )}
                    <IconButton
                      compact
                      onClick={() => onRemoveAttachment(index)}
                      className="mr-1 shrink-0 leading-none"
                      title={`Remove ${fileName}`}
                      aria-label={`Remove ${fileName}`}
                    >
                      ×
                    </IconButton>
                  </AttachmentChip>
                );
              })}
              {videoAttachments.map((file, index) => {
                const fileName = file.name || 'Video attachment';
                const summary = (
                  <>
                    <span className="shrink-0">{fileIcon(file.mimeType)}</span>
                    <span className="truncate text-secondary">{fileName}</span>
                    <span className="shrink-0 text-dim">{formatBytes(file.size)}</span>
                  </>
                );

                return (
                  <AttachmentChip key={file.localId || `${fileName}-${file.size}-${index}`} className="max-w-[240px]">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1">{summary}</div>
                    <IconButton
                      compact
                      onClick={() => onRemoveVideoAttachment?.(index)}
                      className="mr-1 shrink-0 leading-none"
                      title={`Remove ${fileName}`}
                      aria-label={`Remove ${fileName}`}
                    >
                      ×
                    </IconButton>
                  </AttachmentChip>
                );
              })}
              {audioAttachments.map((file, index) => {
                const fileName = file.name || 'Audio attachment';
                const summary = (
                  <>
                    <span className="shrink-0">{fileIcon(file.mimeType)}</span>
                    <span className="truncate text-secondary">{fileName}</span>
                    <span className="shrink-0 text-dim">{formatBytes(file.size)}</span>
                  </>
                );

                return (
                  <AttachmentChip key={file.localId || `${fileName}-${file.size}-${index}`} className="max-w-[240px]">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1">{summary}</div>
                    <IconButton
                      compact
                      onClick={() => onRemoveAudioAttachment?.(index)}
                      className="mr-1 shrink-0 leading-none"
                      title={`Remove ${fileName}`}
                      aria-label={`Remove ${fileName}`}
                    >
                      ×
                    </IconButton>
                  </AttachmentChip>
                );
              })}
              {documentAttachments.map((file, index) => {
                const fileName = file.name || 'Document attachment';
                const summary = (
                  <>
                    <span className="shrink-0">{fileIcon(file.mimeType)}</span>
                    <span className="truncate text-secondary">{fileName}</span>
                    <span className="shrink-0 text-dim">{formatBytes(file.size)}</span>
                  </>
                );

                return (
                  <AttachmentChip key={file.localId || `${fileName}-${file.size}-${index}`} className="max-w-[260px]">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1">{summary}</div>
                    <IconButton
                      compact
                      onClick={() => onRemoveDocumentAttachment?.(index)}
                      className="mr-1 shrink-0 leading-none"
                      title={`Remove ${fileName}`}
                      aria-label={`Remove ${fileName}`}
                    >
                      ×
                    </IconButton>
                  </AttachmentChip>
                );
              })}
            </div>
          )}

          {drawingAttachments.length > 0 && (
            <div
              className={cx(
                'flex flex-wrap gap-1.5',
                (attachments.length > 0 || videoAttachments.length > 0 || audioAttachments.length > 0 || documentAttachments.length > 0) &&
                  'mt-2',
              )}
            >
              {drawingAttachments.map((attachment) => {
                const label = buildDrawingPreviewTitle(attachment);
                return (
                  <AttachmentChip key={attachment.localId} size="md" className="max-w-[270px]">
                    <AttachmentChipButton
                      onClick={() => openDrawingPreview(attachment)}
                      className="cursor-zoom-in px-1 hover:opacity-95"
                      title={`Preview ${label}`}
                      aria-label={`Preview ${label}`}
                    >
                      <img src={attachment.previewUrl} alt={label} className="h-7 w-9 rounded object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-secondary">{label}</p>
                        <p className="text-[10px] text-dim">
                          {attachment.attachmentId ? `#${attachment.attachmentId}` : 'new drawing'}
                          {attachment.dirty ? ' · unsaved' : ''}
                        </p>
                      </div>
                    </AttachmentChipButton>
                    <TextButton
                      type="button"
                      onClick={() => onEditDrawing(attachment.localId)}
                      tone="accent"
                      className="text-[11px]"
                      title={`Edit ${attachment.title}`}
                    >
                      edit
                    </TextButton>
                    <IconButton
                      compact
                      onClick={() => onRemoveDrawingAttachment(attachment.localId)}
                      className="ml-0.5 shrink-0 leading-none"
                      title={`Remove ${attachment.title}`}
                      aria-label={`Remove ${attachment.title}`}
                    >
                      ×
                    </IconButton>
                  </AttachmentChip>
                );
              })}
            </div>
          )}

          {drawingsBusy && <div className="text-[11px] text-dim">Syncing drawings…</div>}
          {drawingsError && <div className="text-[11px] text-danger">{drawingsError}</div>}
        </div>
      )}

      {previewImage ? <ComposerImagePreviewModal image={previewImage} onClose={closePreview} /> : null}
    </>
  );
}
