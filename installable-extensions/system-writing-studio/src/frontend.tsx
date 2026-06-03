import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { ChatView, ErrorState, LoadingState, ToolbarButton } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

interface MarkdownEditor {
  getMarkdown?: () => string;
  getJSON?: () => {
    type?: string;
    text?: string;
    attrs?: Record<string, unknown>;
    content?: Array<ReturnType<NonNullable<MarkdownEditor['getJSON']>>>;
  };
}

const styleElementId = 'writing-studio-runtime-style';
const writingStudioCss = `
.writing-studio{display:grid;grid-template-columns:minmax(0,1fr)22rem;height:100%;min-height:0;background:rgb(var(--color-base));color:rgb(var(--color-primary))}
.writing-studio-main{min-width:0;overflow:auto;padding:1.25rem clamp(1.25rem,3vw,3rem) 4rem}
.writing-studio-docbar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;max-width:68rem;margin:0 auto 1rem}.writing-studio-docbar-left,.writing-studio-docbar-right{display:flex;align-items:center;gap:.5rem}.writing-studio-docbar select{min-width:12rem;max-width:20rem;border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-surface));color:rgb(var(--color-primary));padding:.4rem .55rem;font:inherit;font-size:.82rem}.writing-studio-docbar input[type=file]{display:none}.writing-studio-small-button{border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-surface));color:rgb(var(--color-secondary));padding:.4rem .55rem;font:inherit;font-size:.78rem;cursor:pointer}.writing-studio-small-button:hover{color:rgb(var(--color-primary));border-color:rgb(var(--color-border-strong))}
.writing-studio-meta{max-width:68rem;margin:0 auto 1.25rem;color:rgb(var(--color-dim));font-size:.75rem;line-height:1.4}
.writing-studio-canvas{display:grid;grid-template-columns:minmax(0,48rem) minmax(13rem,18rem);align-items:start;gap:1.25rem;max-width:68rem;margin:0 auto}
.writing-studio-editor{min-height:76vh;padding:.25rem 0 5rem;outline:none;font-size:1rem;line-height:1.72}.writing-studio-editor h1,.writing-studio-editor h2,.writing-studio-editor h3{line-height:1.25}.writing-studio-editor h1{margin:0 0 1.35rem;font-size:2.15rem;font-weight:680}.writing-studio-editor h2{margin:1.8rem 0 .75rem;font-size:1.45rem;font-weight:650}.writing-studio-editor h3{margin:1.5rem 0 .65rem;font-size:1.08rem;font-weight:650}.writing-studio-editor p{margin:.9rem 0}.writing-studio-editor blockquote{margin:1.2rem 0;padding-left:1rem;border-left:2px solid rgb(var(--color-accent));color:rgb(var(--color-secondary))}
.writing-studio-mark-highlight{border-radius:3px;background:color-mix(in srgb,rgb(var(--color-accent)) 23%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,rgb(var(--color-accent)) 28%,transparent)}
.writing-studio-editor-frame.writing-studio-mark-highlight{background:transparent;box-shadow:none}.writing-studio-editor-frame.writing-studio-mark-highlight .writing-studio-editor p:first-of-type{border-radius:3px;background:color-mix(in srgb,rgb(var(--color-accent)) 18%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,rgb(var(--color-accent)) 22%,transparent)}
.writing-studio-comments{position:sticky;top:1rem;display:grid;gap:.75rem;padding-top:2.4rem}.writing-studio-comment{border-left:2px solid rgb(var(--color-accent));padding:.65rem .75rem;background:color-mix(in srgb,rgb(var(--color-surface)) 86%,transparent);box-shadow:0 8px 24px rgba(0,0,0,.14)}
.writing-studio-comment-top{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.4rem;color:rgb(var(--color-accent));font-size:.72rem;font-weight:650;text-transform:capitalize}.writing-studio-comment-top button{border:0;background:transparent;color:rgb(var(--color-secondary));cursor:pointer;font:inherit;font-size:.72rem}.writing-studio-comment blockquote{margin:0 0 .45rem;color:rgb(var(--color-primary));font-size:.78rem;line-height:1.35}.writing-studio-comment p{margin:0;color:rgb(var(--color-secondary));font-size:.8rem;line-height:1.45}.writing-studio-comment-empty{color:rgb(var(--color-dim));font-size:.8rem;line-height:1.5}
.writing-studio-rail{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;border-left:1px solid rgb(var(--color-border-subtle));background:rgb(var(--color-surface))}
.writing-studio-rail.is-collapsed{grid-template-columns:3rem;width:3rem}.writing-studio-rail.is-collapsed .writing-studio-chat-shell{display:none}.writing-studio-rail-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.5rem;min-height:2.8rem;padding:.55rem .75rem;border-bottom:1px solid rgb(var(--color-border-subtle))}
.writing-studio-rail-title{color:rgb(var(--color-secondary));font-size:.74rem;font-weight:650;text-transform:uppercase}.writing-studio-rail-tools{display:flex;align-items:center;gap:.35rem}.writing-studio-review-button{border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-surface));color:rgb(var(--color-secondary));padding:.35rem .55rem;font:inherit;font-size:.75rem;cursor:pointer}.writing-studio-review-button:hover{color:rgb(var(--color-primary));border-color:rgb(var(--color-border-strong))}.writing-studio-review-button:disabled{cursor:default;opacity:.55}.writing-studio-icon-button{display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border:0;border-radius:6px;background:transparent;color:rgb(var(--color-secondary));cursor:pointer}.writing-studio-icon-button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}
.writing-studio-chat-shell{display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0}.writing-studio-chat-view{min-height:0;overflow:auto;padding:.9rem .75rem}.writing-studio-chat-form{padding:.75rem;border-top:1px solid rgb(var(--color-border-subtle))}.writing-studio-chat-box{display:grid;gap:.55rem;border:1px solid rgb(var(--color-border-default));border-radius:8px;background:rgb(var(--color-base));padding:.55rem}.writing-studio-chat-box textarea{width:100%;max-height:9rem;resize:none;border:0;background:transparent;color:rgb(var(--color-primary));outline:none;font:inherit;font-size:.86rem;line-height:1.45}.writing-studio-chat-actions{display:flex;justify-content:flex-end}.writing-studio-muted{margin:0;color:rgb(var(--color-dim));font-size:.84rem;line-height:1.55}
.writing-studio-modal-backdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.48)}.writing-studio-modal{width:min(34rem,calc(100vw - 2rem));border:1px solid rgb(var(--color-border-default));border-radius:8px;background:rgb(var(--color-surface));box-shadow:0 24px 80px rgba(0,0,0,.35)}.writing-studio-modal-header{display:flex;align-items:center;justify-content:space-between;padding:1rem;border-bottom:1px solid rgb(var(--color-border-subtle))}.writing-studio-modal-header h2{margin:0;font-size:1rem}.writing-studio-modal-body{display:grid;gap:1rem;padding:1rem}.writing-studio-field{display:grid;gap:.4rem}.writing-studio-field label{color:rgb(var(--color-secondary));font-size:.8rem}.writing-studio-field input,.writing-studio-field textarea{border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-base));color:rgb(var(--color-primary));padding:.55rem .65rem;font:inherit;font-size:.86rem}.writing-studio-field textarea{min-height:7rem;resize:vertical}.writing-studio-modal-actions{display:flex;justify-content:flex-end;gap:.5rem;padding:0 1rem 1rem}
.writing-studio-center{display:flex;align-items:center;justify-content:center;height:100%;padding:2rem}
@media(max-width:1100px){.writing-studio-canvas{grid-template-columns:minmax(0,1fr)}.writing-studio-comments{position:static;padding-top:0}.writing-studio-comment{max-width:48rem}}
@media(max-width:860px){.writing-studio{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(18rem,42vh)}.writing-studio-rail{border-left:0;border-top:1px solid rgb(var(--color-border-subtle))}}
`;

function ensureWritingStudioStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(styleElementId)) return;
  const style = document.createElement('style');
  style.id = styleElementId;
  style.textContent = writingStudioCss;
  document.head.appendChild(style);
}

interface Annotation {
  id: string;
  kind: 'comment' | 'suggestion' | 'reaction' | 'warning';
  body: string;
  emoji?: string;
  quote: string;
  from: number;
  to: number;
  status: 'open' | 'resolved';
  createdAt: string;
  agentRunId?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  body: string;
  createdAt: string;
}

interface WritingSettings {
  reviewIntervalSeconds: number;
  reviewPrompt: string;
}

interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
  wordCount: number;
}

interface WritingEvent {
  id: string;
  type: string;
  timestamp: string;
  actorId: string;
  payload: Record<string, unknown>;
}

interface StoredState {
  id: string;
  title: string;
  markdown: string;
  updateClock: number;
  events: WritingEvent[];
  annotations: Annotation[];
  chat: ChatMessage[];
  lastAgentRunAt: string | null;
  settings: WritingSettings;
  documents?: DocumentSummary[];
  activeDocumentId?: string;
}

interface ChatViewMessage {
  type: 'user' | 'text';
  id: string;
  ts: string;
  text: string;
}

const actorId = `writer-${Math.random().toString(16).slice(2)}`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function downloadFile(fileName: string, mimeType: string, content: string | Uint8Array): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printPdf(title: string, markdown: string): void {
  const html = markdown
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const heading = text.match(/^(#{1,6})\s+(.+)$/);
      if (heading) return `<h${heading[1].length}>${heading[2]}</h${heading[1].length}>`;
      return `<p>${text.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><title>${title}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:48px auto;color:#111}</style>${html}`);
  win.document.close();
  setTimeout(() => win.print(), 250);
}

function formatTime(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function readMarkdownFromEditor(editor: MarkdownEditor): string {
  const json = typeof editor.getJSON === 'function' ? editor.getJSON() : null;
  if (json) return markdownFromNode(json).trimEnd();
  return typeof editor.getMarkdown === 'function' ? editor.getMarkdown() : '';
}

function textFromNode(node: ReturnType<NonNullable<MarkdownEditor['getJSON']>>): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textFromNode).join('');
}

function markdownFromNode(node: ReturnType<NonNullable<MarkdownEditor['getJSON']>>): string {
  if (node.type === 'doc') return (node.content ?? []).map(markdownFromNode).filter(Boolean).join('\n\n');
  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? Math.min(Math.max(node.attrs.level, 1), 6) : 1;
    return `${'#'.repeat(level)} ${textFromNode(node)}`.trim();
  }
  if (node.type === 'paragraph') return textFromNode(node).trim();
  if (node.type === 'blockquote') return (node.content ?? []).map(markdownFromNode).join('\n').replace(/^/gm, '> ');
  if (node.type === 'bulletList') return (node.content ?? []).map(markdownFromNode).join('\n');
  if (node.type === 'orderedList') return (node.content ?? []).map((child, index) => `${index + 1}. ${textFromNode(child)}`).join('\n');
  if (node.type === 'listItem') return `- ${textFromNode(node)}`;
  if (node.type === 'hardBreak') return '\n';
  return textFromNode(node);
}

function markdownFromEditorElement(element: HTMLElement | null | undefined): string {
  if (!element) return '';
  const blocks = Array.from(element.children)
    .map((child) => {
      const tag = child.tagName.toLowerCase();
      const text = (child.textContent ?? '').trim();
      if (!text) return '';
      if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag.slice(1)))} ${text}`;
      if (tag === 'blockquote') return text.replace(/^/gm, '> ');
      if (tag === 'li') return `- ${text}`;
      return text;
    })
    .filter(Boolean);
  return blocks.join('\n\n');
}

function textNodesUnder(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent || parent.closest('.writing-studio-mark-highlight')) return NodeFilter.FILTER_REJECT;
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

function clearEditorHighlights(root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll('.writing-studio-mark-highlight'))) {
    if (mark instanceof HTMLElement && mark.tagName.toLowerCase() !== 'span') {
      mark.classList.remove('writing-studio-mark-highlight');
      continue;
    }
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  }
}

function highlightEditorQuotes(root: HTMLElement, annotations: Annotation[]): void {
  clearEditorHighlights(root);
  const quotes = annotations.map((annotation) => annotation.quote.trim()).filter((quote) => quote.length > 0);
  for (const quote of quotes) {
    const node = textNodesUnder(root).find((candidate) => (candidate.textContent ?? '').includes(quote));
    if (!node) continue;
    const text = node.textContent ?? '';
    const index = text.indexOf(quote);
    if (index < 0) continue;
    node.parentElement?.closest('p,h1,h2,h3,blockquote,li')?.classList.add('writing-studio-mark-highlight');
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + quote.length);
    const mark = document.createElement('span');
    mark.className = 'writing-studio-mark-highlight';
    try {
      range.surroundContents(mark);
    } catch {
      range.detach();
    }
  }
}

function useWritingDoc(initialMarkdown: string, onCrdtUpdate: (update: Uint8Array, markdown: string) => void) {
  const ydoc = useMemo(() => new Y.Doc(), []);
  const applyingRemote = useRef(false);
  const ytext = useMemo(() => ydoc.getText('markdown'), [ydoc]);

  useEffect(() => {
    applyingRemote.current = true;
    ytext.delete(0, ytext.length);
    ytext.insert(0, initialMarkdown);
    applyingRemote.current = false;
  }, [initialMarkdown, ytext]);

  useEffect(() => {
    const handler = (update: Uint8Array) => {
      if (applyingRemote.current) return;
      onCrdtUpdate(update, ytext.toString());
    };
    ydoc.on('update', handler);
    return () => ydoc.off('update', handler);
  }, [onCrdtUpdate, ydoc, ytext]);

  const replaceMarkdown = useCallback(
    (markdown: string) => {
      if (markdown === ytext.toString()) return;
      ytext.delete(0, ytext.length);
      ytext.insert(0, markdown);
    },
    [ytext],
  );

  const setMarkdownSilently = useCallback(
    (markdown: string) => {
      applyingRemote.current = true;
      ytext.delete(0, ytext.length);
      ytext.insert(0, markdown);
      applyingRemote.current = false;
    },
    [ytext],
  );

  return { replaceMarkdown, setMarkdownSilently };
}

export function WritingStudioPage({ pa }: { pa: NativeExtensionClient }) {
  ensureWritingStudioStyle();
  const [state, setState] = useState<StoredState | null>(null);
  const [visibleEventCount, setVisibleEventCount] = useState(0);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState('default');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<WritingSettings>({ reviewIntervalSeconds: 12, reviewPrompt: '' });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingEditorContent = useRef(false);

  const persistUpdate = useCallback(
    (update: Uint8Array, nextMarkdown: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void pa.extension
          .invoke('writingStudioAppendUpdate', { updateBase64: bytesToBase64(update), markdown: nextMarkdown, actorId, documentId: activeDocumentId })
          .then(() => setVisibleEventCount((current) => current + 1))
          .catch((err: Error) => setError(err.message));
      }, 250);
    },
    [activeDocumentId, pa],
  );

  const { replaceMarkdown, setMarkdownSilently } = useWritingDoc(markdown, persistUpdate);

  const editor = useEditor({
    extensions: [StarterKit, Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: false })],
    content: markdown,
    editorProps: {
      attributes: {
        class: 'writing-studio-editor',
        'aria-label': 'Writing document',
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      if (applyingEditorContent.current) return;
      const nextMarkdown = readMarkdownFromEditor(nextEditor);
      setMarkdown(nextMarkdown);
      replaceMarkdown(nextMarkdown);
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
      reviewTimer.current = setTimeout(() => {
        void runReview('periodic');
      }, Math.max(3, state?.settings.reviewIntervalSeconds ?? 12) * 1000);
    },
  });

  const syncEditorMarkdown = useCallback(() => {
    if (!editor || applyingEditorContent.current) return markdown;
    const editorElement = (editor as unknown as { view?: { dom?: HTMLElement } }).view?.dom;
    const nextMarkdown = markdownFromEditorElement(editorElement) || readMarkdownFromEditor(editor);
    if (!nextMarkdown || nextMarkdown === markdown) return markdown;
    setMarkdown(nextMarkdown);
    replaceMarkdown(nextMarkdown);
    return nextMarkdown;
  }, [editor, markdown, replaceMarkdown]);

  useEffect(() => {
    if (!editor) return;
    const editorElement = (editor as unknown as { view?: { dom?: HTMLElement } }).view?.dom;
    if (!editorElement) return;
    const handler = () => {
      setTimeout(() => {
        syncEditorMarkdown();
      }, 0);
    };
    editorElement.addEventListener('input', handler);
    editorElement.addEventListener('keyup', handler);
    editorElement.addEventListener('paste', handler);
    return () => {
      editorElement.removeEventListener('input', handler);
      editorElement.removeEventListener('keyup', handler);
      editorElement.removeEventListener('paste', handler);
    };
  }, [editor, syncEditorMarkdown]);

  const load = useCallback(async (documentId?: string) => {
    const next = (await pa.extension.invoke('writingStudioLoad', documentId ? { documentId } : {})) as StoredState;
    setState(next);
    setDocuments(next.documents ?? []);
    setActiveDocumentId(next.activeDocumentId ?? next.id ?? documentId ?? 'default');
    setSettingsDraft(next.settings);
    setVisibleEventCount(next.events.length);
    setMarkdown(next.markdown);
    setMarkdownSilently(next.markdown);
    if (editor) {
      applyingEditorContent.current = true;
      editor.commands.setContent(next.markdown, { contentType: 'markdown' });
      setTimeout(() => {
        applyingEditorContent.current = false;
      }, 250);
    }
  }, [editor, pa, setMarkdownSilently]);

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!editor || readMarkdownFromEditor(editor) === markdown) return;
    applyingEditorContent.current = true;
    const editorElement = (editor as unknown as { view?: { dom?: HTMLElement } }).view?.dom;
    if (editorElement) clearEditorHighlights(editorElement);
    editor.commands.setContent(markdown, { contentType: 'markdown' });
    setMarkdownSilently(markdown);
    setTimeout(() => {
      applyingEditorContent.current = false;
    }, 250);
  }, [editor, markdown, setMarkdownSilently]);

  useEffect(() => {
    if (!editor) return;
    const editorElement = (editor as unknown as { view?: { dom?: HTMLElement } }).view?.dom;
    if (!editorElement) return;
    const timer = setTimeout(() => {
      highlightEditorQuotes(
        editorElement,
        (state?.annotations ?? []).filter((annotation) => annotation.status === 'open'),
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [editor, markdown, state?.annotations]);

  const runReview = useCallback(
    async (trigger: string) => {
      setBusy('review');
      try {
        const currentMarkdown = syncEditorMarkdown() ?? markdown;
        const result = (await pa.extension.invoke('writingStudioRunReview', { markdown: currentMarkdown, trigger, documentId: activeDocumentId })) as { annotations: Annotation[] };
        const currentQuotes = result.annotations.map((annotation) => annotation.quote);
        setState((current) =>
          current
            ? {
                ...current,
                annotations: [
                  ...result.annotations,
                  ...current.annotations.filter(
                    (annotation) => annotation.status !== 'open' || (annotation.quote && currentMarkdown.includes(annotation.quote) && !currentQuotes.includes(annotation.quote)),
                  ),
                ],
                lastAgentRunAt: new Date().toISOString(),
              }
            : current,
        );
        const editorElement = (editor as unknown as { view?: { dom?: HTMLElement } }).view?.dom;
        if (editorElement) {
          setTimeout(() => highlightEditorQuotes(editorElement, result.annotations), 50);
        }
        setVisibleEventCount((current) => current + result.annotations.length + 2);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [activeDocumentId, editor, markdown, pa],
  );

  const sendChat = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!chatDraft.trim()) return;
      setBusy('chat');
      try {
        const currentMarkdown = syncEditorMarkdown() ?? markdown;
        const result = (await pa.extension.invoke('writingStudioSendChat', { body: chatDraft, markdown: currentMarkdown, documentId: activeDocumentId })) as { messages: ChatMessage[] };
        setState((current) => (current ? { ...current, chat: result.messages } : current));
        setVisibleEventCount((current) => current + 2);
        setChatDraft('');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [activeDocumentId, chatDraft, markdown, pa],
  );

  const resolveAnnotation = useCallback(
    async (id: string) => {
      const result = (await pa.extension.invoke('writingStudioResolveAnnotation', { id, documentId: activeDocumentId })) as { annotations: Annotation[] };
      setState((current) => (current ? { ...current, annotations: result.annotations } : current));
    },
    [activeDocumentId, pa],
  );

  const saveSettings = useCallback(async () => {
    setBusy('settings');
    try {
      const result = (await pa.extension.invoke('writingStudioSaveSettings', { ...settingsDraft, documentId: activeDocumentId })) as { settings: WritingSettings };
      setSettingsDraft(result.settings);
      setState((current) => (current ? { ...current, settings: result.settings } : current));
      setSettingsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [activeDocumentId, pa, settingsDraft]);

  const saveDocument = useCallback(async () => {
    const currentMarkdown = syncEditorMarkdown() ?? markdown;
    const result = (await pa.extension.invoke('writingStudioSaveDocument', { documentId: activeDocumentId, markdown: currentMarkdown })) as {
      document: DocumentSummary;
    };
    setDocuments((current) => [result.document, ...current.filter((doc) => doc.id !== result.document.id)]);
    setVisibleEventCount((current) => current + 1);
  }, [activeDocumentId, markdown, pa, syncEditorMarkdown]);

  const createDocument = useCallback(async () => {
    const next = (await pa.extension.invoke('writingStudioCreateDocument', { title: 'Untitled' })) as StoredState;
    setState(next);
    setDocuments(next.documents ?? []);
    setActiveDocumentId(next.activeDocumentId ?? next.id ?? 'default');
    setMarkdown(next.markdown);
    setMarkdownSilently(next.markdown);
    editor?.commands.setContent(next.markdown, { contentType: 'markdown' });
  }, [editor, pa, setMarkdownSilently]);

  const importDocument = useCallback(
    async (file: File) => {
      const text = await file.text();
      const next = (await pa.extension.invoke('writingStudioImportDocument', { title: file.name.replace(/\.[^.]+$/, ''), markdown: text })) as StoredState;
      setState(next);
      setDocuments(next.documents ?? []);
      setActiveDocumentId(next.activeDocumentId ?? next.id ?? 'default');
      setMarkdown(next.markdown);
      setMarkdownSilently(next.markdown);
      editor?.commands.setContent(next.markdown, { contentType: 'markdown' });
    },
    [editor, pa, setMarkdownSilently],
  );

  const exportDocument = useCallback(
    async (format: 'markdown' | 'html' | 'rtf' | 'docx' | 'pdf') => {
      const currentMarkdown = syncEditorMarkdown() ?? markdown;
      if (format === 'pdf') {
        printPdf(state?.title ?? 'Draft', currentMarkdown);
        return;
      }
      await saveDocument();
      const result = (await pa.extension.invoke('writingStudioExportDocument', { documentId: activeDocumentId, format })) as {
        fileName: string;
        mimeType: string;
        content: string;
        encoding: 'text' | 'base64';
      };
      downloadFile(result.fileName, result.mimeType, result.encoding === 'base64' ? base64ToBytes(result.content) : result.content);
    },
    [activeDocumentId, markdown, pa, saveDocument, state?.title, syncEditorMarkdown],
  );

  if (loading) {
    return (
      <div className="writing-studio-center">
        <LoadingState label="Loading Writing Studio..." />
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="writing-studio-center">
        <ErrorState message={error} />
      </div>
    );
  }

  const openAnnotations = (state?.annotations ?? []).filter((annotation) => annotation.status === 'open');
  const resolvedCount = (state?.annotations ?? []).filter((annotation) => annotation.status === 'resolved').length;
  const eventCount = visibleEventCount;
  const chatMessages: ChatViewMessage[] = (state?.chat ?? []).map((message) => ({
    type: message.role === 'user' ? 'user' : 'text',
    id: message.id,
    ts: message.createdAt,
    text: message.body,
  }));

  return (
    <main className={`writing-studio ${railCollapsed ? 'has-collapsed-rail' : ''}`}>
      <section className="writing-studio-main">
        <div className="writing-studio-docbar">
          <div className="writing-studio-docbar-left">
            <select value={activeDocumentId} onChange={(event) => void load(event.target.value)} aria-label="Writing document">
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
            <button className="writing-studio-small-button" type="button" onClick={() => void createDocument()}>
              New
            </button>
            <label className="writing-studio-small-button">
              Import
              <input
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void importDocument(file);
                }}
              />
            </label>
            <button className="writing-studio-small-button" type="button" onClick={() => void saveDocument()}>
              Save
            </button>
          </div>
          <div className="writing-studio-docbar-right">
            <select value="" onChange={(event) => {
              const format = event.target.value as 'markdown' | 'html' | 'rtf' | 'docx' | 'pdf';
              event.target.value = '';
              if (format) void exportDocument(format);
            }} aria-label="Export document">
              <option value="">Export</option>
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="rtf">RTF</option>
              <option value="docx">DOCX</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>
        <div className="writing-studio-meta">
          {eventCount} replay events · Last review {formatTime(state?.lastAgentRunAt ?? null)} · {resolvedCount} resolved
        </div>
        <div className="writing-studio-canvas">
          <div className={`writing-studio-editor-frame ${openAnnotations.length ? 'writing-studio-mark-highlight' : ''}`}>
            <EditorContent editor={editor} />
          </div>
          <aside className="writing-studio-comments" aria-label="Document comments">
            {openAnnotations.length === 0 ? (
              <p className="writing-studio-comment-empty">Comments will appear beside the draft as the agent reads.</p>
            ) : (
              openAnnotations.map((annotation) => (
                <article key={annotation.id} className={`writing-studio-comment is-${annotation.kind}`}>
                  <div className="writing-studio-comment-top">
                    <span>{annotation.emoji ?? annotation.kind}</span>
                    <button type="button" onClick={() => void resolveAnnotation(annotation.id)}>
                      Resolve
                    </button>
                  </div>
                  <blockquote>{annotation.quote}</blockquote>
                  <p>{annotation.body}</p>
                </article>
              ))
            )}
          </aside>
        </div>
      </section>

      <aside className={`writing-studio-rail ${railCollapsed ? 'is-collapsed' : ''}`}>
        <div className="writing-studio-rail-toolbar">
          {!railCollapsed && <span className="writing-studio-rail-title">Chat</span>}
          <div className="writing-studio-rail-tools">
            {!railCollapsed && (
              <button className="writing-studio-review-button" type="button" onClick={() => void runReview('manual')} disabled={busy === 'review'}>
                {busy === 'review' ? 'Reviewing' : 'Review'}
              </button>
            )}
            {!railCollapsed && (
              <button className="writing-studio-icon-button" type="button" aria-label="Writing Studio settings" onClick={() => setSettingsOpen(true)}>
                ⚙
              </button>
            )}
            <button
              className="writing-studio-icon-button"
              type="button"
              aria-label={railCollapsed ? 'Expand chat' : 'Collapse chat'}
              onClick={() => setRailCollapsed((collapsed) => !collapsed)}
            >
              {railCollapsed ? '‹' : '›'}
            </button>
          </div>
        </div>
        <section className="writing-studio-chat-shell">
          <div className="writing-studio-chat-view">
            {chatMessages.length === 0 ? (
              <p className="writing-studio-muted">Ask for help with the draft, or ask the agent to add comments to the canvas.</p>
            ) : (
              <ChatView messages={chatMessages} isStreaming={busy === 'chat'} layout="compact" />
            )}
          </div>
          <form className="writing-studio-chat-form" onSubmit={sendChat}>
            <div className="writing-studio-chat-box">
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                rows={3}
                placeholder="Ask about the draft..."
              />
              <div className="writing-studio-chat-actions">
                <ToolbarButton type="submit" disabled={busy === 'chat' || !chatDraft.trim()}>
                  {busy === 'chat' ? 'Sending...' : 'Send'}
                </ToolbarButton>
              </div>
            </div>
          </form>
        </section>
      </aside>

      {settingsOpen && (
        <div className="writing-studio-modal-backdrop" role="dialog" aria-modal="true" aria-label="Writing Studio settings">
          <div className="writing-studio-modal">
            <div className="writing-studio-modal-header">
              <h2>Writing Studio settings</h2>
              <button className="writing-studio-icon-button" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
                ×
              </button>
            </div>
            <div className="writing-studio-modal-body">
              <div className="writing-studio-field">
                <label htmlFor="writing-studio-review-interval">Review cadence, seconds</label>
                <input
                  id="writing-studio-review-interval"
                  type="number"
                  min={3}
                  max={300}
                  value={settingsDraft.reviewIntervalSeconds}
                  onChange={(event) =>
                    setSettingsDraft((draft) => ({ ...draft, reviewIntervalSeconds: Number(event.target.value) || draft.reviewIntervalSeconds }))
                  }
                />
              </div>
              <div className="writing-studio-field">
                <label htmlFor="writing-studio-review-prompt">Review prompt</label>
                <textarea
                  id="writing-studio-review-prompt"
                  value={settingsDraft.reviewPrompt}
                  onChange={(event) => setSettingsDraft((draft) => ({ ...draft, reviewPrompt: event.target.value }))}
                />
              </div>
            </div>
            <div className="writing-studio-modal-actions">
              <ToolbarButton type="button" onClick={() => setSettingsOpen(false)}>
                Cancel
              </ToolbarButton>
              <ToolbarButton type="button" onClick={() => void saveSettings()} disabled={busy === 'settings'}>
                {busy === 'settings' ? 'Saving...' : 'Save'}
              </ToolbarButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
