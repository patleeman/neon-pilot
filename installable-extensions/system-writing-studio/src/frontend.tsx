import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { ErrorState, LoadingState, ToolbarButton } from '@neon-pilot/extensions/ui';
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
.writing-studio-main{min-width:0;overflow:auto;padding:2rem clamp(1.5rem,4vw,4rem) 4rem}
.writing-studio-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;max-width:54rem;margin:0 auto 1.5rem;padding-bottom:1rem;border-bottom:1px solid rgb(var(--color-border-subtle))}
.writing-studio-header h1{margin:0;font-size:1.35rem;font-weight:650}.writing-studio-header p{margin:.35rem 0 0;color:rgb(var(--color-secondary));font-size:.8rem}.writing-studio-actions{flex:0 0 auto}
.writing-studio-editor{max-width:54rem;min-height:68vh;margin:0 auto;padding:.5rem 0 5rem;outline:none;font-size:1.02rem;line-height:1.75}.writing-studio-editor h1,.writing-studio-editor h2,.writing-studio-editor h3{line-height:1.2}.writing-studio-editor h1{margin:0 0 1.4rem;font-size:clamp(2rem,5vw,3.5rem);font-weight:720}.writing-studio-editor p{margin:1rem 0}.writing-studio-editor blockquote{margin:1.3rem 0;padding-left:1rem;border-left:3px solid rgb(var(--color-accent));color:rgb(var(--color-secondary))}
.writing-studio-rail{display:grid;grid-template-rows:minmax(0,1fr) minmax(18rem,.9fr);min-height:0;border-left:1px solid rgb(var(--color-border-subtle));background:rgb(var(--color-surface))}
.writing-studio-panel{min-height:0;overflow:auto;padding:1rem}.writing-studio-panel+.writing-studio-panel{border-top:1px solid rgb(var(--color-border-subtle))}.writing-studio-panel-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.85rem}.writing-studio-panel-header h2{margin:0;font-size:.82rem;font-weight:650;text-transform:uppercase;letter-spacing:0;color:rgb(var(--color-secondary))}.writing-studio-panel-header span{color:rgb(var(--color-dim));font-size:.75rem}.writing-studio-muted{margin:0;color:rgb(var(--color-dim));font-size:.86rem;line-height:1.55}
.writing-studio-annotation{padding:.9rem 0;border-top:1px solid rgb(var(--color-border-subtle))}.writing-studio-annotation:first-of-type{border-top:0}.writing-studio-annotation-top{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.5rem;color:rgb(var(--color-accent));font-size:.78rem;font-weight:650;text-transform:capitalize}.writing-studio-annotation-top button{border:0;background:transparent;color:rgb(var(--color-secondary));cursor:pointer;font:inherit;font-size:.76rem}.writing-studio-annotation blockquote{margin:0 0 .55rem;padding-left:.7rem;border-left:2px solid rgb(var(--color-border-default));color:rgb(var(--color-primary));font-size:.82rem;line-height:1.45}.writing-studio-annotation p,.writing-studio-message p{margin:0;color:rgb(var(--color-secondary));font-size:.84rem;line-height:1.5}
.writing-studio-chat-log{display:grid;gap:.8rem;min-height:7rem;margin-bottom:1rem}.writing-studio-message{padding-bottom:.8rem;border-bottom:1px solid rgb(var(--color-border-subtle))}.writing-studio-message strong{display:block;margin-bottom:.25rem;color:rgb(var(--color-primary));font-size:.78rem}.writing-studio-chat-form{display:grid;gap:.65rem}.writing-studio-chat-form textarea{width:100%;resize:vertical;border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-base));color:rgb(var(--color-primary));padding:.7rem;outline:none;font:inherit;font-size:.86rem;line-height:1.45}.writing-studio-center{display:flex;align-items:center;justify-content:center;height:100%;padding:2rem}
@media(max-width:960px){.writing-studio{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}.writing-studio-rail{grid-template-columns:1fr;grid-template-rows:auto auto;border-left:0;border-top:1px solid rgb(var(--color-border-subtle))}}
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

interface WritingEvent {
  id: string;
  type: string;
  timestamp: string;
  actorId: string;
  payload: Record<string, unknown>;
}

interface StoredState {
  title: string;
  markdown: string;
  updateClock: number;
  events: WritingEvent[];
  annotations: Annotation[];
  chat: ChatMessage[];
  lastAgentRunAt: string | null;
}

const actorId = `writer-${Math.random().toString(16).slice(2)}`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingEditorContent = useRef(false);

  const persistUpdate = useCallback(
    (update: Uint8Array, nextMarkdown: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void pa.extension
          .invoke('writingStudioAppendUpdate', { updateBase64: bytesToBase64(update), markdown: nextMarkdown, actorId })
          .then(() => setVisibleEventCount((current) => current + 1))
          .catch((err: Error) => setError(err.message));
      }, 250);
    },
    [pa],
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
      }, 4000);
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

  const load = useCallback(async () => {
    const next = (await pa.extension.invoke('writingStudioLoad', {})) as StoredState;
    setState(next);
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
    editor.commands.setContent(markdown, { contentType: 'markdown' });
    setMarkdownSilently(markdown);
    setTimeout(() => {
      applyingEditorContent.current = false;
    }, 250);
  }, [editor, markdown, setMarkdownSilently]);

  const runReview = useCallback(
    async (trigger: string) => {
      setBusy('review');
      try {
        const currentMarkdown = syncEditorMarkdown() ?? markdown;
        const result = (await pa.extension.invoke('writingStudioRunReview', { markdown: currentMarkdown, trigger })) as { annotations: Annotation[] };
        setState((current) =>
          current
            ? {
                ...current,
                annotations: [...result.annotations, ...current.annotations],
                lastAgentRunAt: new Date().toISOString(),
              }
            : current,
        );
        setVisibleEventCount((current) => current + result.annotations.length + 2);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [markdown, pa],
  );

  const sendChat = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!chatDraft.trim()) return;
      setBusy('chat');
      try {
        const currentMarkdown = syncEditorMarkdown() ?? markdown;
        const result = (await pa.extension.invoke('writingStudioSendChat', { body: chatDraft, markdown: currentMarkdown })) as { messages: ChatMessage[] };
        setState((current) => (current ? { ...current, chat: result.messages } : current));
        setVisibleEventCount((current) => current + 2);
        setChatDraft('');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [chatDraft, markdown, pa],
  );

  const resolveAnnotation = useCallback(
    async (id: string) => {
      const result = (await pa.extension.invoke('writingStudioResolveAnnotation', { id })) as { annotations: Annotation[] };
      setState((current) => (current ? { ...current, annotations: result.annotations } : current));
    },
    [pa],
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

  return (
    <main className="writing-studio">
      <section className="writing-studio-main">
        <header className="writing-studio-header">
          <div>
            <h1>Writing Studio</h1>
            <p>{eventCount} replay events · Last review {formatTime(state?.lastAgentRunAt ?? null)} · {resolvedCount} resolved</p>
          </div>
          <div className="writing-studio-actions">
            <ToolbarButton onClick={() => void runReview('manual')} disabled={busy === 'review'}>
              {busy === 'review' ? 'Reviewing...' : 'Review'}
            </ToolbarButton>
          </div>
        </header>

        <EditorContent editor={editor} />
      </section>

      <aside className="writing-studio-rail">
        <section className="writing-studio-panel annotations">
          <div className="writing-studio-panel-header">
            <h2>Annotations</h2>
            <span>{openAnnotations.length}</span>
          </div>
          {openAnnotations.length === 0 ? (
            <p className="writing-studio-muted">No open annotations. Keep writing or run a review.</p>
          ) : (
            openAnnotations.map((annotation) => (
              <article key={annotation.id} className={`writing-studio-annotation is-${annotation.kind}`}>
                <div className="writing-studio-annotation-top">
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
        </section>

        <section className="writing-studio-panel chat">
          <div className="writing-studio-panel-header">
            <h2>Chat</h2>
            <span>{state?.chat.length ?? 0}</span>
          </div>
          <div className="writing-studio-chat-log">
            {(state?.chat ?? []).length === 0 ? (
              <p className="writing-studio-muted">Ask for help with the draft without moving focus away from the document.</p>
            ) : (
              state?.chat.map((message) => (
                <div key={message.id} className={`writing-studio-message is-${message.role}`}>
                  <strong>{message.role === 'user' ? 'You' : 'Agent'}</strong>
                  <p>{message.body}</p>
                </div>
              ))
            )}
          </div>
          <form className="writing-studio-chat-form" onSubmit={sendChat}>
            <textarea
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              rows={3}
              placeholder="Ask about the draft..."
            />
            <ToolbarButton type="submit" disabled={busy === 'chat' || !chatDraft.trim()}>
              {busy === 'chat' ? 'Sending...' : 'Send'}
            </ToolbarButton>
          </form>
        </section>
      </aside>
    </main>
  );
}
