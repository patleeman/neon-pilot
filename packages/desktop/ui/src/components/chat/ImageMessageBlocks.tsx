import { memo, useEffect } from 'react';

import { setExtensionCommandContext } from '../../extensions/commands';
import type { MessageBlock } from '../../shared/types';
import { Button, IconButton, MediaPreviewButton, SurfacePanel } from '../ui';
import {
  IMAGE_PREVIEW_CLOSE_COMMAND_EVENT,
  IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT,
  IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT,
  registerImagePreviewCapability,
  type ImagePreviewCommandDetail,
} from './imagePreviewCommands';

export type InspectableImage = {
  alt: string;
  src: string;
  caption?: string;
  width?: number;
  height?: number;
};

export function ImageInspectModal({ image, onClose }: { image: InspectableImage; onClose: () => void }) {
  const label = image.caption?.trim() || image.alt.trim() || 'Conversation image';

  useEffect(() => {
    setExtensionCommandContext('imagePreview.active', true);
    return () => setExtensionCommandContext('imagePreview.active', null);
  }, []);

  useEffect(() => {
    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
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
        aria-label={label}
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
            <div className="pointer-events-auto min-w-0 rounded-lg bg-black/45 px-3 py-1.5 backdrop-blur-sm" title={label}>
              <p className="truncate text-[12px] font-medium text-white/95">{label}</p>
              {image.width && image.height ? (
                <p className="mt-0.5 text-[10px] text-white/60">
                  {image.width}×{image.height}
                </p>
              ) : null}
            </div>
            <IconButton
              shape="circle"
              compact
              onClick={onClose}
              aria-label="Close image preview"
              className="pointer-events-auto h-8 w-8 shrink-0 border-white/15 bg-black/45 text-[16px] leading-none text-white/80 hover:bg-black/60 hover:text-white focus-visible:ring-white/25 focus-visible:ring-offset-black"
            >
              ×
            </IconButton>
          </div>
          <img src={image.src} alt={image.alt} className="h-full w-full object-contain" />
        </div>
      </div>
    </div>
  );
}

export function ImagePreview({
  alt,
  src,
  caption,
  width,
  height,
  maxHeight,
  deferred = false,
  loading = false,
  onLoad,
  onInspect,
}: {
  alt: string;
  src?: string;
  caption?: string;
  width?: number;
  height?: number;
  maxHeight: number;
  deferred?: boolean;
  loading?: boolean;
  onLoad?: () => Promise<void> | void;
  onInspect?: (image: InspectableImage) => void;
}) {
  const inspectableImage = src
    ? {
        alt,
        src,
        caption,
        width,
        height,
      }
    : null;

  useEffect(() => {
    if (!inspectableImage || !onInspect) return undefined;
    return registerImagePreviewCapability('inspect');
  }, [inspectableImage, onInspect]);

  useEffect(() => {
    if (!deferred || !onLoad) return undefined;
    return registerImagePreviewCapability('load');
  }, [deferred, onLoad]);

  useEffect(() => {
    function handleInspectFirstCommand(event: Event) {
      const detail = (event as CustomEvent<ImagePreviewCommandDetail>).detail;
      if (detail?.handled || !inspectableImage || !onInspect) return;
      if (detail) detail.handled = true;
      onInspect(inspectableImage);
    }

    function handleLoadFirstCommand(event: Event) {
      const detail = (event as CustomEvent<ImagePreviewCommandDetail>).detail;
      if (detail?.handled || !deferred || loading || !onLoad) return;
      if (detail) detail.handled = true;
      void onLoad();
    }

    window.addEventListener(IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT, handleInspectFirstCommand);
    window.addEventListener(IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT, handleLoadFirstCommand);
    return () => {
      window.removeEventListener(IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT, handleInspectFirstCommand);
      window.removeEventListener(IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT, handleLoadFirstCommand);
    };
  }, [deferred, inspectableImage, loading, onInspect, onLoad]);

  return (
    <SurfacePanel muted className="overflow-hidden">
      {inspectableImage ? (
        <MediaPreviewButton
          onClick={() => onInspect?.(inspectableImage)}
          aria-label={`Inspect image: ${caption ?? alt}`}
          title="Inspect image"
        >
          <img src={inspectableImage.src} alt={alt} className="block w-full object-contain bg-elevated" style={{ maxHeight }} />
        </MediaPreviewButton>
      ) : (
        <div
          className="w-full bg-elevated flex flex-col items-center justify-center gap-2 px-4 py-5 text-dim"
          style={{ aspectRatio: `${width ?? 16} / ${height ?? 9}`, maxHeight }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-40"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span className="text-[11px] font-mono opacity-50">{alt}</span>
          {width && (
            <span className="text-[10px] opacity-35">
              {width}×{height}
            </span>
          )}
          {deferred && onLoad && (
            <Button
              variant="action"
              onClick={() => {
                void onLoad();
              }}
              disabled={loading}
              className="text-[11px]"
            >
              {loading ? 'Loading image…' : 'Load image'}
            </Button>
          )}
        </div>
      )}
      {(caption || (!src && alt)) && (
        <div className="px-3 py-2 bg-surface border-t border-border-subtle">
          <p className="text-[11px] text-dim font-mono">{caption ?? alt}</p>
        </div>
      )}
    </SurfacePanel>
  );
}

export const ImageBlock = memo(function ImageBlock({
  block,
  onHydrateMessage,
  hydratingMessageBlockIds,
  onInspectImage,
}: {
  block: Extract<MessageBlock, { type: 'image' }>;
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
  onInspectImage?: (image: InspectableImage) => void;
}) {
  const blockId = typeof block.id === 'string' ? block.id.trim() : '';
  const canHydrate = Boolean(block.deferred && blockId && onHydrateMessage);
  const loading = Boolean(blockId && hydratingMessageBlockIds?.has(blockId));

  return (
    <ImagePreview
      alt={block.alt}
      src={block.src}
      caption={block.caption}
      width={block.width}
      height={block.height}
      maxHeight={320}
      deferred={block.deferred}
      loading={loading}
      onLoad={canHydrate ? () => onHydrateMessage?.(blockId as string) : undefined}
      onInspect={onInspectImage}
    />
  );
});
