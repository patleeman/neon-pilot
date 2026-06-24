import excalidrawCss from '@excalidraw/excalidraw/index.css?raw';
import { type NativeExtensionClient } from '@neon-pilot/extensions';
import {
  buildDrawingFileNames,
  type ExcalidrawComponent,
  type ExcalidrawSceneData,
  loadExcalidrawComponent,
  parseExcalidrawSceneFromSourceData,
  serializeExcalidrawScene,
} from '@neon-pilot/extensions/excalidraw';
import {
  CenteredLoadingState,
  CenteredMessage,
  IconButton,
  PanelMessage,
  ResourceListItem,
  SectionLabel,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import React, { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from 'react';

export interface ExcalidrawEditorSavePayload {
  localId?: string;
  attachmentId?: string;
  revision?: number;
  dirty?: boolean;
  title: string;
  scene: ExcalidrawSceneData;
  sourceData: string;
  sourceMimeType: string;
  sourceName: string;
  previewData: string;
  previewMimeType: string;
  previewName: string;
  previewUrl: string;
}

interface ExcalidrawEditorProps {
  initialTitle?: string;
  initialScene?: ExcalidrawSceneData | null;
  initialAttachmentId?: string;
  initialRevision?: number;
  saveLabel?: string;
  persistLabel?: string;
  cancelLabel?: string;
  moveLabel?: string;
  onCancel?: () => void;
  onPersist?: (payload: ExcalidrawEditorSavePayload) => Promise<ExcalidrawEditorSavePayload> | ExcalidrawEditorSavePayload;
  onMoveToWorkbench?: (
    payload: ExcalidrawEditorSavePayload,
  ) => Promise<ExcalidrawEditorSavePayload | void> | ExcalidrawEditorSavePayload | void;
  onSave: (payload: ExcalidrawEditorSavePayload) => void;
}

interface ConversationDrawingSummary {
  id: string;
  kind?: string;
  title?: string;
  currentRevision?: number;
  updatedAt?: string;
}

interface DraftDrawingSummary extends ConversationDrawingSummary {
  draft: true;
  scene: ExcalidrawSceneData;
}

interface ConversationDrawingRecord extends ConversationDrawingSummary {
  revisions?: Array<{
    revision: number;
    sourceMimeType?: string;
    sourceName?: string;
    previewMimeType?: string;
    previewName?: string;
  }>;
  latestRevision?: {
    revision: number;
    sourceMimeType?: string;
    sourceName?: string;
    previewMimeType?: string;
    previewName?: string;
  };
}

interface ConversationAttachmentAssetData {
  dataUrl: string;
}

interface DrawingDetailState {
  localDraftId?: string;
  initialTitle?: string;
  initialScene?: ExcalidrawSceneData | null;
  initialAttachmentId?: string;
  initialRevision?: number;
  saveLabel?: string;
}

const EMPTY_SCENE: ExcalidrawSceneData = { elements: [], appState: {}, files: {} } as ExcalidrawSceneData;
const EXCALIDRAW_STYLE_ID = 'pa-system-excalidraw-input-styles';
const EXCALIDRAW_CSS_WITHOUT_FONT_URLS = excalidrawCss.replace(/@font-face\{font-family:Assistant;[^}]*\}/g, '');
const EMBEDDED_UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: false,
    loadScene: false,
    saveToActiveFile: false,
    saveAsImage: false,
    toggleTheme: false,
  },
} as const;
const ICON = {
  attach: 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  check: 'M20 6 9 17l-5-5',
  panel:
    'M3 5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v13.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V5.25Zm12 0v13.5',
  plus: 'M12 5v14M5 12h14',
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
  save: 'M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l4 4v12a2 2 0 0 1-2 2ZM9 21v-8h6v8M9 3v5h5',
  x: 'M6 18 18 6M6 6l12 12',
};
const draftDrawings = new Map<string, DraftDrawingSummary>();

interface ExcalidrawErrorBoundaryState {
  error: Error | null;
}

class ExcalidrawErrorBoundary extends Component<{ children: ReactNode }, ExcalidrawErrorBoundaryState> {
  state: ExcalidrawErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ExcalidrawErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Excalidraw failed to render:', error, info);
    window.dispatchEvent(
      new CustomEvent('neon-pilot-notification', {
        detail: {
          type: 'error',
          message: 'Drawing editor crashed',
          details: error instanceof Error ? error.message : String(error),
          source: 'system-excalidraw-input',
        },
      }),
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-danger">
          Failed to load Excalidraw: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function ensureExcalidrawStyles() {
  if (document.getElementById(EXCALIDRAW_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = EXCALIDRAW_STYLE_ID;
  style.textContent = EXCALIDRAW_CSS_WITHOUT_FONT_URLS;
  document.head.appendChild(style);
}

function getExcalidrawTheme(): 'dark' | 'light' {
  if (document.documentElement.classList.contains('dark')) return 'dark';
  if (document.documentElement.dataset.theme === 'dark') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function Ico({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function ExcalidrawEditor({
  initialTitle,
  initialScene,
  initialAttachmentId,
  initialRevision,
  saveLabel,
  persistLabel,
  cancelLabel,
  moveLabel,
  onCancel,
  onPersist,
  onMoveToWorkbench,
  onSave,
}: ExcalidrawEditorProps) {
  const [attaching, setAttaching] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [savedRef, setSavedRef] = useState<{ attachmentId?: string; revision?: number }>({
    attachmentId: initialAttachmentId,
    revision: initialRevision,
  });
  const [LoadedExcalidraw, setLoadedExcalidraw] = useState<ExcalidrawComponent | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const sceneRef = useRef<ExcalidrawSceneData>(initialScene ?? EMPTY_SCENE);
  const excalidrawTheme = getExcalidrawTheme();
  const drawingTitle = initialTitle?.trim() || 'Drawing';
  const busy = attaching || persisting || moving;

  useEffect(() => {
    let cancelled = false;
    ensureExcalidrawStyles();
    void loadExcalidrawComponent()
      .then((component) => {
        if (cancelled) return;
        setLoadedExcalidraw(() => component);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error : new Error('Failed to load Excalidraw.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function buildPayload(): Promise<ExcalidrawEditorSavePayload> {
    const scene = sceneRef.current;
    const serialized = await serializeExcalidrawScene(scene);
    const fileNames = buildDrawingFileNames(drawingTitle);
    return {
      ...savedRef,
      title: drawingTitle,
      scene,
      sourceData: serialized.sourceData,
      sourceMimeType: serialized.sourceMimeType,
      sourceName: fileNames.sourceName,
      previewData: serialized.previewData,
      previewMimeType: serialized.previewMimeType,
      previewName: fileNames.previewName,
      previewUrl: serialized.previewUrl,
    } satisfies ExcalidrawEditorSavePayload;
  }

  async function handleAttach() {
    if (!LoadedExcalidraw || loadError) return;
    setAttaching(true);
    try {
      onSave(await buildPayload());
    } finally {
      setAttaching(false);
    }
  }

  async function handlePersist() {
    if (!LoadedExcalidraw || loadError || !onPersist) return;
    setPersisting(true);
    try {
      const persisted = await onPersist(await buildPayload());
      setSavedRef({ attachmentId: persisted.attachmentId, revision: persisted.revision });
    } finally {
      setPersisting(false);
    }
  }

  async function handleMoveToWorkbench() {
    if (!LoadedExcalidraw || loadError || !onMoveToWorkbench) return;
    setMoving(true);
    try {
      const persisted = await onMoveToWorkbench(await buildPayload());
      if (persisted) {
        setSavedRef({ attachmentId: persisted.attachmentId, revision: persisted.revision });
      }
    } finally {
      setMoving(false);
    }
  }

  const persistButtonLabel = persistLabel ?? 'Save';
  const attachButtonLabel = saveLabel ?? 'Attach to chat';

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex justify-end gap-2 border-b border-border-subtle px-3 py-2">
        {onMoveToWorkbench ? (
          <IconButton
            compact
            onClick={() => {
              void handleMoveToWorkbench();
            }}
            disabled={busy || !LoadedExcalidraw || loadError !== null}
            title={moving ? 'Moving to Workbench...' : (moveLabel ?? 'Save and move to Workbench')}
            aria-label={moveLabel ?? 'Save and move to Workbench'}
          >
            <Ico d={moving ? ICON.refresh : ICON.panel} size={12} />
          </IconButton>
        ) : null}
        {onCancel ? (
          <IconButton compact onClick={onCancel} disabled={busy} title={cancelLabel ?? 'Cancel'} aria-label={cancelLabel ?? 'Cancel'}>
            <Ico d={ICON.x} size={12} />
          </IconButton>
        ) : null}
        <ToolbarButton
          onClick={() => {
            void handlePersist();
          }}
          className="ui-icon-button-compact gap-1.5 px-2.5"
          disabled={!onPersist || busy || !LoadedExcalidraw || loadError !== null}
          title={!onPersist ? 'Save requires an existing conversation' : persisting ? 'Saving...' : persistButtonLabel}
          aria-label={persistButtonLabel}
        >
          <Ico d={persisting ? ICON.refresh : ICON.save} size={12} />
          <span>{persisting ? 'Saving...' : persistButtonLabel}</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            void handleAttach();
          }}
          className="ui-icon-button-compact gap-1.5 bg-accent px-2.5 text-white hover:bg-accent/90 disabled:bg-accent/50 disabled:text-white/70"
          disabled={busy || !LoadedExcalidraw || loadError !== null}
          title={attaching ? 'Attaching...' : attachButtonLabel}
          aria-label={attachButtonLabel}
        >
          <Ico d={attaching ? ICON.refresh : ICON.attach} size={12} />
          <span>{attaching ? 'Attaching...' : attachButtonLabel}</span>
        </ToolbarButton>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {loadError ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-danger">
            Failed to load Excalidraw: {loadError.message}
          </div>
        ) : LoadedExcalidraw ? (
          <ExcalidrawErrorBoundary>
            <div className="excalidraw-embed-lite h-full w-full min-w-0">
              <LoadedExcalidraw
                theme={excalidrawTheme}
                UIOptions={EMBEDDED_UI_OPTIONS}
                renderTopRightUI={() => null}
                initialData={
                  initialScene
                    ? {
                        elements: [...initialScene.elements],
                        appState: { ...initialScene.appState, theme: excalidrawTheme, openMenu: null, openSidebar: null },
                        files: initialScene.files,
                      }
                    : { appState: { theme: excalidrawTheme, openMenu: null, openSidebar: null } }
                }
                onChange={(elements, appState, files) => {
                  sceneRef.current = { elements: [...elements], appState: { ...appState }, files: { ...files } };
                }}
              />
            </div>
          </ExcalidrawErrorBoundary>
        ) : (
          <CenteredLoadingState label="Loading Excalidraw..." />
        )}
      </div>
    </div>
  );
}

export function ExcalidrawEditorModal({
  pa,
  props,
  close,
}: {
  pa: NativeExtensionClient;
  props: {
    conversationId?: string | null;
    localId?: string;
    initialTitle?: string;
    initialScene?: ExcalidrawSceneData | null;
    initialAttachmentId?: string;
    initialRevision?: number;
    saveLabel?: string;
  };
  close: (result?: unknown) => void;
}) {
  return (
    <ExcalidrawEditor
      initialTitle={props.initialTitle}
      initialScene={props.initialScene}
      initialAttachmentId={props.initialAttachmentId}
      initialRevision={props.initialRevision}
      saveLabel={props.saveLabel}
      persistLabel="Save"
      onCancel={() => close()}
      onPersist={
        props.conversationId
          ? async (payload) => {
              const savedPayload = await persistDrawingToConversation(pa, props.conversationId as string, payload);
              const composerPayload = { ...savedPayload, localId: props.localId, dirty: false };
              pa.events.publish('excalidraw:saved', composerPayload);
              pa.ui.toast('Drawing saved.');
              close(composerPayload);
              return savedPayload;
            }
          : undefined
      }
      onSave={(payload) => close(payload)}
      moveLabel={props.conversationId ? 'Save and move to Workbench' : 'Move to Workbench'}
      onMoveToWorkbench={async (payload) => {
        const workbenchPayload = props.conversationId
          ? await persistDrawingToConversation(pa, props.conversationId as string, payload)
          : payload;
        const draft = workbenchPayload.attachmentId
          ? null
          : publishDraftDrawing(pa, createDraftDrawing(workbenchPayload.scene, workbenchPayload.title));
        pa.workbench.setDetailState('drawing-detail', {
          localDraftId: draft?.id,
          initialTitle: workbenchPayload.title,
          initialScene: workbenchPayload.scene,
          initialAttachmentId: workbenchPayload.attachmentId,
          initialRevision: workbenchPayload.revision,
          saveLabel: props.saveLabel,
        });
        void pa.commands.execute('layout.set', { mode: 'workbench' });
        void pa.commands.execute('rail.open', { extensionId: 'system-excalidraw-input', surfaceId: 'drawings' });
        pa.ui.toast(props.conversationId ? 'Drawing saved and moved to Workbench.' : 'Drawing moved to Workbench.');
        close();
        return workbenchPayload;
      }}
    />
  );
}

function sourcePayloadFromDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

function getDrawingTitle(drawing: ConversationDrawingSummary): string {
  return drawing.title?.trim() || drawing.id;
}

function createDraftDrawing(scene: ExcalidrawSceneData = EMPTY_SCENE, title = 'Drawing'): DraftDrawingSummary {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    draft: true,
    kind: 'excalidraw',
    title,
    currentRevision: 0,
    updatedAt: new Date().toISOString(),
    scene,
  };
}

function upsertDraftDrawing(draft: DraftDrawingSummary): DraftDrawingSummary {
  const normalized = { ...draft, updatedAt: new Date().toISOString() };
  draftDrawings.set(normalized.id, normalized);
  return normalized;
}

function publishDraftDrawing(pa: NativeExtensionClient, draft: DraftDrawingSummary) {
  const normalized = upsertDraftDrawing(draft);
  pa.events.publish('excalidraw:draft-changed', { draft: normalized });
  return normalized;
}

function removeDraftDrawing(pa: NativeExtensionClient, draftId?: string) {
  if (!draftId) return;
  draftDrawings.delete(draftId);
  pa.events.publish('excalidraw:draft-changed', { removedDraftId: draftId });
}

function formatRevision(drawing: ConversationDrawingSummary): string {
  if ('draft' in drawing && drawing.draft) return 'unsaved';
  return `rev ${drawing.currentRevision ?? 1}`;
}

function sortDrawings(drawings: ConversationDrawingSummary[]): ConversationDrawingSummary[] {
  return [...drawings].sort((left, right) => {
    const updatedDiff = Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? '');
    return Number.isFinite(updatedDiff) && updatedDiff !== 0 ? updatedDiff : getDrawingTitle(left).localeCompare(getDrawingTitle(right));
  });
}

function upsertDrawingSummary(drawings: ConversationDrawingSummary[], drawing: ConversationDrawingSummary): ConversationDrawingSummary[] {
  const next = drawings.filter((current) => current.id !== drawing.id);
  next.push(drawing);
  return sortDrawings(next);
}

function buildSavedPayload(payload: ExcalidrawEditorSavePayload, record: ConversationDrawingRecord): ExcalidrawEditorSavePayload {
  const revision = record.latestRevision ?? record.revisions?.find((entry) => entry.revision === record.currentRevision);
  return {
    ...payload,
    attachmentId: record.id,
    revision: record.currentRevision,
    title: getDrawingTitle(record),
    sourceName: revision?.sourceName ?? payload.sourceName,
    sourceMimeType: revision?.sourceMimeType ?? payload.sourceMimeType,
    previewName: revision?.previewName ?? payload.previewName,
    previewMimeType: revision?.previewMimeType ?? payload.previewMimeType,
  };
}

async function persistDrawingToConversation(
  pa: NativeExtensionClient,
  conversationId: string,
  payload: ExcalidrawEditorSavePayload,
): Promise<ExcalidrawEditorSavePayload> {
  const input = {
    title: payload.title,
    sourceData: payload.sourceData,
    sourceName: payload.sourceName,
    sourceMimeType: payload.sourceMimeType,
    previewData: payload.previewData,
    previewName: payload.previewName,
    previewMimeType: payload.previewMimeType,
  };
  const result = payload.attachmentId
    ? ((await pa.conversations.updateAttachment(conversationId, payload.attachmentId, input)) as { attachment?: ConversationDrawingRecord })
    : ((await pa.conversations.createAttachment(conversationId, { kind: 'excalidraw', ...input })) as {
        attachment?: ConversationDrawingRecord;
      });
  if (!result.attachment) throw new Error('Saved drawing response did not include an attachment.');
  const savedPayload = buildSavedPayload(payload, result.attachment);
  pa.events.publish('excalidraw:attachments-changed', { conversationId, attachment: result.attachment });
  return savedPayload;
}

export function ExcalidrawWorkbenchPanel({ pa, context }: { pa: NativeExtensionClient; context: { conversationId?: string | null } }) {
  const [drawings, setDrawings] = useState<ConversationDrawingSummary[]>([]);
  const [drafts, setDrafts] = useState<DraftDrawingSummary[]>(() => Array.from(draftDrawings.values()));
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDrawings() {
    if (!context.conversationId) {
      setDrawings([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = (await pa.conversations.attachments(context.conversationId)) as { attachments?: ConversationDrawingSummary[] };
      setDrawings((result.attachments ?? []).filter((attachment) => attachment.kind === 'excalidraw'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!cancelled) void loadDrawings();
    };
    const idleCallback =
      'requestIdleCallback' in window ? window.requestIdleCallback(load, { timeout: 800 }) : window.setTimeout(load, 100);
    return () => {
      cancelled = true;
      if ('cancelIdleCallback' in window && typeof idleCallback === 'number') {
        window.cancelIdleCallback(idleCallback);
      } else {
        window.clearTimeout(idleCallback);
      }
    };
  }, [context.conversationId]);

  useEffect(() => {
    const subscription = pa.events.subscribe('excalidraw:attachments-changed', (event) => {
      const payload = event.payload as { conversationId?: string | null; attachment?: ConversationDrawingSummary } | null;
      if (payload?.conversationId && payload.conversationId !== context.conversationId) return;
      if (payload?.attachment?.kind === 'excalidraw') {
        setDrawings((current) => upsertDrawingSummary(current, payload.attachment as ConversationDrawingSummary));
        return;
      }
      void loadDrawings();
    });
    return () => subscription.unsubscribe();
  }, [context.conversationId, pa]);

  useEffect(() => {
    const subscription = pa.events.subscribe('excalidraw:draft-changed', (event) => {
      const payload = event.payload as { draft?: DraftDrawingSummary; removedDraftId?: string } | null;
      if (payload?.removedDraftId) {
        setDrafts((current) => current.filter((draft) => draft.id !== payload.removedDraftId));
        return;
      }
      if (!payload?.draft) return;
      setDrafts((current) => upsertDrawingSummary(current, payload.draft as DraftDrawingSummary) as DraftDrawingSummary[]);
    });
    return () => subscription.unsubscribe();
  }, [pa]);

  async function attachDrawing(drawing: ConversationDrawingSummary) {
    if ('draft' in drawing && drawing.draft) {
      pa.workbench.setDetailState('drawing-detail', {
        localDraftId: drawing.id,
        initialTitle: getDrawingTitle(drawing),
        initialScene: drawing.scene,
        saveLabel: 'Attach to chat',
      } satisfies DrawingDetailState);
      return;
    }

    if (!context.conversationId) return;
    setBusyId(drawing.id);
    setError(null);
    try {
      const detail = (await pa.conversations.attachment(context.conversationId, drawing.id)) as { attachment?: ConversationDrawingRecord };
      const record = detail.attachment;
      if (!record) throw new Error('Drawing attachment not found.');
      const revision = record.latestRevision ?? record.revisions?.find((entry) => entry.revision === record.currentRevision) ?? null;
      if (!revision) throw new Error('Drawing revision not found.');

      const sourceAsset = (await pa.conversations.attachmentAsset(
        context.conversationId,
        record.id,
        'source',
        revision.revision,
      )) as ConversationAttachmentAssetData;
      const previewAsset = (await pa.conversations.attachmentAsset(
        context.conversationId,
        record.id,
        'preview',
        revision.revision,
      )) as ConversationAttachmentAssetData;
      const sourceData = sourcePayloadFromDataUrl(sourceAsset.dataUrl);

      pa.events.publish('excalidraw:saved', {
        attachmentId: record.id,
        revision: revision.revision,
        title: getDrawingTitle(record),
        scene: parseExcalidrawSceneFromSourceData(sourceData),
        sourceData,
        sourceMimeType: revision.sourceMimeType ?? 'application/vnd.excalidraw+json',
        sourceName: revision.sourceName ?? `${getDrawingTitle(record)}.excalidraw`,
        previewData: sourcePayloadFromDataUrl(previewAsset.dataUrl),
        previewMimeType: revision.previewMimeType ?? 'image/png',
        previewName: revision.previewName ?? `${getDrawingTitle(record)}.png`,
        previewUrl: previewAsset.dataUrl,
      } satisfies ExcalidrawEditorSavePayload);
      pa.ui.toast('Drawing attached to composer.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      pa.ui.notify({ type: 'error', message: 'Failed to attach drawing', details: message });
    } finally {
      setBusyId(null);
    }
  }

  const visibleDrawings = [...drafts, ...drawings.filter((drawing) => !drafts.some((draft) => draft.id === drawing.id))];
  let content: ReactNode;
  if (loading && visibleDrawings.length === 0) {
    content = <PanelMessage>Loading drawings...</PanelMessage>;
  } else if (error && visibleDrawings.length === 0) {
    content = <PanelMessage tone="danger">{error}</PanelMessage>;
  } else if (visibleDrawings.length === 0) {
    content = (
      <PanelMessage>
        {context.conversationId ? 'No drawings in this conversation.' : 'No drawings in this draft conversation.'}
      </PanelMessage>
    );
  } else {
    content = (
      <div className="flex flex-col gap-1.5">
        {error ? (
          <PanelMessage tone="danger" className="px-2 py-1">
            {error}
          </PanelMessage>
        ) : null}
        {visibleDrawings.map((drawing) => {
          const busy = busyId === drawing.id;
          const isDraft = 'draft' in drawing && drawing.draft;
          return (
            <ResourceListItem
              key={drawing.id}
              onClick={() => void attachDrawing(drawing)}
              disabled={busy}
              label={getDrawingTitle(drawing)}
              meta={busy ? 'attaching' : isDraft ? 'open' : 'attach'}
              detail={`${drawing.id} · ${formatRevision(drawing)}`}
              title={`${getDrawingTitle(drawing)} · ${drawing.id} · ${formatRevision(drawing)}`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <SectionLabel className="flex-1">Drawings</SectionLabel>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              compact
              onClick={() => void loadDrawings()}
              disabled={loading}
              title={loading ? 'Refreshing drawings...' : 'Refresh drawings'}
              aria-label="Refresh drawings"
            >
              <Ico d={ICON.refresh} size={12} />
            </IconButton>
            <IconButton
              compact
              onClick={() => {
                const draft = publishDraftDrawing(pa, createDraftDrawing());
                pa.workbench.setDetailState('drawing-detail', {
                  localDraftId: draft.id,
                  initialTitle: draft.title,
                  initialScene: draft.scene,
                  saveLabel: 'Attach to chat',
                } satisfies DrawingDetailState);
              }}
              title="New drawing"
              aria-label="New drawing"
            >
              <Ico d={ICON.plus} size={12} />
            </IconButton>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">{content}</div>
    </div>
  );
}

export function ExcalidrawWorkbenchDetail({
  pa,
  context,
}: {
  pa: NativeExtensionClient;
  context: { conversationId?: string | null; instanceId?: string | null };
}) {
  const detailStateKey = context.instanceId ? `drawing-detail:${context.instanceId}` : 'drawing-detail';
  const [state, setState] = useState(
    () =>
      pa.workbench.getDetailState<DrawingDetailState>(detailStateKey) ?? pa.workbench.getDetailState<DrawingDetailState>('drawing-detail'),
  );
  const [editorRevision, setEditorRevision] = useState(0);

  useEffect(() => {
    function handleStateChange(event: CustomEvent) {
      const detail = event.detail as { extensionId?: string; surfaceId?: string; state?: unknown };
      if (detail.extensionId !== 'system-excalidraw-input' || detail.surfaceId !== detailStateKey) return;
      setState((detail.state as DrawingDetailState | null) ?? null);
      setEditorRevision((current) => current + 1);
    }

    window.addEventListener('neon-pilot-extension-workbench-detail-state', handleStateChange as EventListener);
    return () => window.removeEventListener('neon-pilot-extension-workbench-detail-state', handleStateChange as EventListener);
  }, [detailStateKey]);

  useEffect(() => {
    if (state) return;
    const draft = publishDraftDrawing(pa, createDraftDrawing());
    const nextState = {
      localDraftId: draft.id,
      initialTitle: draft.title,
      initialScene: draft.scene,
      saveLabel: 'Attach to chat',
    } satisfies DrawingDetailState;
    setState(nextState);
    pa.workbench.setDetailState(detailStateKey, nextState);
  }, [detailStateKey, pa, state]);

  if (!state) {
    return <CenteredMessage eyebrow="Workbench" title="Opening drawing" />;
  }

  return (
    <ExcalidrawEditor
      key={editorRevision}
      initialTitle={state?.initialTitle}
      initialScene={state?.initialScene}
      initialAttachmentId={state?.initialAttachmentId}
      initialRevision={state?.initialRevision}
      saveLabel={state?.saveLabel ?? 'Attach to chat'}
      persistLabel="Save"
      onPersist={
        context.conversationId
          ? async (payload) => {
              const savedPayload = await persistDrawingToConversation(pa, context.conversationId as string, payload);
              removeDraftDrawing(pa, state?.localDraftId);
              pa.workbench.setDetailState(detailStateKey, {
                ...state,
                localDraftId: undefined,
                initialTitle: savedPayload.title,
                initialScene: savedPayload.scene,
                initialAttachmentId: savedPayload.attachmentId,
                initialRevision: savedPayload.revision,
              });
              pa.ui.toast('Drawing saved.');
              return savedPayload;
            }
          : undefined
      }
      onSave={(payload) => {
        if (state?.localDraftId && !payload.attachmentId) {
          publishDraftDrawing(pa, { ...createDraftDrawing(payload.scene, payload.title), id: state.localDraftId });
        }
        pa.events.publish('excalidraw:saved', payload);
        pa.ui.toast('Drawing attached to composer.');
      }}
    />
  );
}
