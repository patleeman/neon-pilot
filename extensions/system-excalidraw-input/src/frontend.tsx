import { type NativeExtensionClient } from '@neon-pilot/extensions';
import { lazy, Suspense, useEffect } from 'react';

import type { ExcalidrawEditorSavePayload } from './editorModal';

const LazyExcalidrawEditorModal = lazy(async () => {
  const module = await import('./editorModal');
  return { default: module.ExcalidrawEditorModal };
});
const LazyExcalidrawWorkbenchPanel = lazy(async () => {
  const module = await import('./editorModal');
  return { default: module.ExcalidrawWorkbenchPanel };
});
const LazyExcalidrawWorkbenchDetail = lazy(async () => {
  const module = await import('./editorModal');
  return { default: module.ExcalidrawWorkbenchDetail };
});

function PencilIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function ExcalidrawInputTool({
  pa,
  toolContext,
}: {
  pa: NativeExtensionClient;
  toolContext: {
    conversationId?: string | null;
    composerDisabled: boolean;
    streamIsStreaming: boolean;
    upsertDrawingAttachment: (payload: ExcalidrawEditorSavePayload) => void;
  };
}) {
  useEffect(() => {
    const subscription = pa.events.subscribe('excalidraw:saved', (event) => {
      if (event.payload && typeof event.payload === 'object') {
        toolContext.upsertDrawingAttachment(event.payload as ExcalidrawEditorSavePayload);
      }
    });
    return () => subscription.unsubscribe();
  }, [pa, toolContext]);

  const openDrawingModal = async () => {
    const result = await pa.ui.openModal({
      component: 'ExcalidrawEditorModal',
      props: { conversationId: toolContext.conversationId, saveLabel: 'Attach to chat' },
      size: 'fullscreen',
    });
    if (result && typeof result === 'object') {
      toolContext.upsertDrawingAttachment(result as ExcalidrawEditorSavePayload);
      pa.ui.toast('Drawing attached to composer.');
    }
  };

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        if ((event.pointerType && event.pointerType !== 'mouse') || event.button === 0) {
          void openDrawingModal();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void openDrawingModal();
        }
      }}
      disabled={toolContext.composerDisabled}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-elevated/60 hover:text-primary disabled:opacity-40"
      title="Create drawing"
      aria-label="Create drawing"
    >
      <PencilIcon />
    </button>
  );
}

export function ExcalidrawEditorModal(props: Parameters<typeof LazyExcalidrawEditorModal>[0]) {
  return (
    <Suspense
      fallback={<div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-dim">Loading Excalidraw…</div>}
    >
      <LazyExcalidrawEditorModal {...props} />
    </Suspense>
  );
}

export function ExcalidrawWorkbenchPanel(props: Parameters<typeof LazyExcalidrawWorkbenchPanel>[0]) {
  return (
    <Suspense
      fallback={<div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-dim">Loading drawing…</div>}
    >
      <LazyExcalidrawWorkbenchPanel {...props} />
    </Suspense>
  );
}

export function ExcalidrawWorkbenchDetail(props: Parameters<typeof LazyExcalidrawWorkbenchDetail>[0]) {
  return (
    <Suspense
      fallback={<div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-dim">Loading drawing…</div>}
    >
      <LazyExcalidrawWorkbenchDetail {...props} />
    </Suspense>
  );
}
