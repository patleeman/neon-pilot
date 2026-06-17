import '@excalidraw/excalidraw/index.css';
import './style.css';

import { Excalidraw, exportToBlob, serializeAsJSON } from '@excalidraw/excalidraw';
import { createRoot } from 'react-dom/client';
import { useMemo, useRef, useState } from 'react';

type SceneData = {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

type AttachmentRecord = {
  id: string;
  currentRevision?: number;
  latestRevision?: {
    revision?: number;
    sourceName?: string;
    sourceMimeType?: string;
    previewName?: string;
    previewMimeType?: string;
  };
};

const SOURCE_MIME_TYPE = 'application/vnd.excalidraw+json';
const PREVIEW_MIME_TYPE = 'image/png';
const params = new URLSearchParams(window.location.search);
const conversationId = params.get('conversationId')?.trim() ?? '';
const attachmentId = params.get('attachmentId')?.trim() ?? '';

function fileBase(title: string): string {
  return (
    title
      .trim()
      .replace(/\s+/gu, '-')
      .replace(/[^a-zA-Z0-9._-]+/gu, '-')
      .replace(/-+/gu, '-')
      .replace(/^-+|-+$/gu, '') || 'drawing'
  );
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function download(name: string, mimeType: string, data: string | Blob) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read preview.'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.readAsDataURL(blob);
  });
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: 'application/json', 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

function App() {
  const [title, setTitle] = useState('Drawing');
  const [status, setStatus] = useState(conversationId ? 'Ready' : 'Local draft');
  const [busy, setBusy] = useState(false);
  const sceneRef = useRef<SceneData>({ elements: [], appState: {}, files: {} });
  const currentAttachmentId = useRef(attachmentId);

  const canSaveToConversation = Boolean(conversationId);
  const names = useMemo(() => {
    const base = fileBase(title);
    return { source: `${base}.excalidraw`, preview: `${base}.png` };
  }, [title]);

  async function buildSerialized() {
    const scene = sceneRef.current;
    const sourceJson = serializeAsJSON(scene.elements as never, scene.appState as never, scene.files as never, 'local');
    const previewBlob = await exportToBlob({
      elements: scene.elements as never,
      appState: {
        ...scene.appState,
        exportBackground: true,
        exportWithDarkMode: false,
        exportEmbedScene: false,
      } as never,
      files: scene.files as never,
      mimeType: PREVIEW_MIME_TYPE,
      exportPadding: 16,
    });
    return {
      sourceJson,
      sourceData: encodeBase64(sourceJson),
      previewBlob,
      previewData: await blobToBase64(previewBlob),
    };
  }

  async function saveToConversation() {
    if (!conversationId || busy) return;
    setBusy(true);
    setStatus('Saving...');
    try {
      const serialized = await buildSerialized();
      const input = {
        kind: 'excalidraw',
        title,
        sourceData: serialized.sourceData,
        sourceName: names.source,
        sourceMimeType: SOURCE_MIME_TYPE,
        previewData: serialized.previewData,
        previewName: names.preview,
        previewMimeType: PREVIEW_MIME_TYPE,
      };
      const path = currentAttachmentId.current
        ? `/.neon/api/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(currentAttachmentId.current)}`
        : `/.neon/api/conversations/${encodeURIComponent(conversationId)}/attachments`;
      const result = await readJson<{ attachment?: AttachmentRecord }>(path, {
        method: currentAttachmentId.current ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      });
      if (result.attachment?.id) currentAttachmentId.current = result.attachment.id;
      setStatus(result.attachment?.currentRevision ? `Saved rev ${result.attachment.currentRevision}` : 'Saved');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function downloadSource() {
    if (busy) return;
    setBusy(true);
    try {
      download(names.source, SOURCE_MIME_TYPE, (await buildSerialized()).sourceJson);
      setStatus('Downloaded source');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function downloadPng() {
    if (busy) return;
    setBusy(true);
    try {
      download(names.preview, PREVIEW_MIME_TYPE, (await buildSerialized()).previewBlob);
      setStatus('Downloaded PNG');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="drawing-shell">
      <header className="toolbar">
        <div className="title-group">
          <label htmlFor="drawing-title">Drawing</label>
          <input
            id="drawing-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Drawing title"
          />
        </div>
        <div className="actions">
          <span className="status">{status}</span>
          <button type="button" onClick={() => void downloadSource()} disabled={busy}>
            Source
          </button>
          <button type="button" onClick={() => void downloadPng()} disabled={busy}>
            PNG
          </button>
          <button type="button" onClick={() => void saveToConversation()} disabled={!canSaveToConversation || busy}>
            {busy ? 'Working...' : 'Save'}
          </button>
        </div>
      </header>
      <section className="canvas" aria-label="Excalidraw canvas">
        <Excalidraw
          theme="dark"
          UIOptions={{
            canvasActions: {
              export: false,
              saveToActiveFile: false,
              loadScene: false,
              toggleTheme: false,
            },
          }}
          initialData={{ appState: { theme: 'dark', viewBackgroundColor: '#10141b' } }}
          onChange={(elements, appState, files) => {
            sceneRef.current = {
              elements: [...elements],
              appState: { ...appState },
              files: { ...files },
            };
          }}
        />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
