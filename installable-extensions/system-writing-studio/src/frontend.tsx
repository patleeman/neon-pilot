import { Markdown } from '@tiptap/markdown';
import type { FileTree as TreesModel } from '@pierre/trees';
import { FileTree as TreesFileTree } from '@pierre/trees/react';
import { EditorContent, type Editor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { buildApiPath, ChatRailComposer, ChatView, ErrorState, LoadingState, ToolbarButton, useFileTreeModel } from '@neon-pilot/extensions/ui';
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

interface MarkdownEditor {
  getMarkdown?: () => string;
  getJSON?: () => {
    type?: string;
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
    content?: Array<ReturnType<NonNullable<MarkdownEditor['getJSON']>>>;
  };
}

const styleElementId = 'writing-studio-runtime-style';
const writingStudioCss = `
.writing-studio{display:grid;grid-template-columns:minmax(0,1fr)var(--writing-studio-rail-width,22rem);height:100%;min-height:0;background:rgb(var(--color-base));color:rgb(var(--color-primary))}
.writing-studio.has-collapsed-rail{grid-template-columns:minmax(0,1fr)3rem}
.writing-studio-main{min-width:0;overflow:auto;padding:2.25rem clamp(1.25rem,3vw,3rem) 4rem}
.writing-studio-meta{display:flex;align-items:center;justify-content:space-between;gap:1rem;max-width:68rem;margin:0 auto 1.25rem;color:rgb(var(--color-dim));font-size:.75rem;line-height:1.4}.writing-studio-save-status{display:inline-flex;align-items:center;gap:.35rem;white-space:nowrap}.writing-studio-save-status::before{content:"";width:.42rem;height:.42rem;border-radius:999px;background:rgb(var(--color-dim))}.writing-studio-save-status.is-saved::before{background:rgb(var(--color-success))}.writing-studio-save-status.is-saving::before{background:rgb(var(--color-accent));animation:writing-studio-pulse 1s ease-in-out infinite}.writing-studio-save-status.is-unsaved::before{background:rgb(var(--color-warning))}.writing-studio-save-status.is-error::before{background:rgb(var(--color-danger))}@keyframes writing-studio-pulse{0%,100%{opacity:.45}50%{opacity:1}}
.writing-studio-formatbar{position:sticky;top:0;z-index:15;display:flex;align-items:center;gap:.18rem;max-width:68rem;margin:-.55rem auto 1rem;padding:.35rem 0;background:linear-gradient(rgb(var(--color-base)) 78%,transparent)}.writing-studio-format-group{display:flex;align-items:center;gap:.12rem;padding-right:.35rem;margin-right:.25rem;border-right:1px solid rgb(var(--color-border-subtle))}.writing-studio-format-group:last-child{border-right:0}.writing-studio-format-button{display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border:0;border-radius:5px;background:transparent;color:rgb(var(--color-secondary));font:inherit;font-size:.74rem;font-weight:650;cursor:pointer}.writing-studio-format-button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}.writing-studio-format-button.is-active{background:color-mix(in srgb,rgb(var(--color-accent)) 18%,transparent);color:rgb(var(--color-accent))}.writing-studio-format-button:disabled{cursor:default;opacity:.42}
.writing-studio-canvas{display:grid;grid-template-columns:minmax(0,48rem) minmax(13rem,18rem);align-items:start;gap:1.25rem;max-width:68rem;margin:0 auto}
.writing-studio-editor{min-height:76vh;padding:.25rem 0 5rem;outline:none;font-size:1rem;line-height:1.72}.writing-studio-editor h1,.writing-studio-editor h2,.writing-studio-editor h3{line-height:1.25}.writing-studio-editor h1{margin:0 0 1.35rem;font-size:2.15rem;font-weight:680}.writing-studio-editor h2{margin:1.8rem 0 .75rem;font-size:1.45rem;font-weight:650}.writing-studio-editor h3{margin:1.5rem 0 .65rem;font-size:1.08rem;font-weight:650}.writing-studio-editor p{margin:.9rem 0}.writing-studio-editor blockquote{margin:1.2rem 0;padding-left:1rem;border-left:2px solid rgb(var(--color-accent));color:rgb(var(--color-secondary))}
.writing-studio-mark-highlight{border-radius:3px;background:color-mix(in srgb,rgb(var(--color-accent)) 23%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,rgb(var(--color-accent)) 28%,transparent)}
.writing-studio-editor-frame.writing-studio-mark-highlight{background:transparent;box-shadow:none}.writing-studio-editor-frame.writing-studio-mark-highlight .writing-studio-editor p:first-of-type{border-radius:3px;background:color-mix(in srgb,rgb(var(--color-accent)) 18%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,rgb(var(--color-accent)) 22%,transparent)}
.writing-studio-comments{position:sticky;top:1rem;display:grid;gap:.75rem;padding-top:2.4rem}.writing-studio-comment{border-left:2px solid rgb(var(--color-accent));padding:.65rem .75rem;background:color-mix(in srgb,rgb(var(--color-surface)) 86%,transparent);box-shadow:0 8px 24px rgba(0,0,0,.14)}
.writing-studio-comment-top{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.4rem;color:rgb(var(--color-accent));font-size:.72rem;font-weight:650;text-transform:capitalize}.writing-studio-comment-top button{border:0;background:transparent;color:rgb(var(--color-secondary));cursor:pointer;font:inherit;font-size:.72rem}.writing-studio-comment blockquote{margin:0 0 .45rem;color:rgb(var(--color-primary));font-size:.78rem;line-height:1.35}.writing-studio-comment p{margin:0;color:rgb(var(--color-secondary));font-size:.8rem;line-height:1.45}.writing-studio-comment-empty{color:rgb(var(--color-dim));font-size:.8rem;line-height:1.5}
.writing-studio-rail{position:relative;display:grid;grid-template-rows:auto minmax(0,1fr);min-width:0;min-height:0;border-left:1px solid rgb(var(--color-border-subtle));background:rgb(var(--color-surface))}
.writing-studio-rail-resizer{position:absolute;left:-4px;top:0;bottom:0;z-index:25;width:8px;cursor:col-resize}.writing-studio-rail-resizer::after{content:"";position:absolute;left:3px;top:0;bottom:0;width:1px;background:transparent}.writing-studio-rail-resizer:hover::after,.writing-studio-rail-resizer:focus-visible::after{background:rgb(var(--color-accent))}
.writing-studio-rail.is-collapsed{grid-template-columns:3rem;width:3rem}.writing-studio-rail.is-collapsed .writing-studio-chat-shell{display:none}.writing-studio-rail-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.5rem;min-height:2.8rem;padding:.55rem .75rem;border-bottom:1px solid rgb(var(--color-border-subtle))}
.writing-studio-rail-title{color:rgb(var(--color-secondary));font-size:.74rem;font-weight:650;text-transform:uppercase}.writing-studio-rail-tools{display:flex;align-items:center;gap:.25rem}.writing-studio-icon-button{position:relative;display:inline-flex;align-items:center;justify-content:center;width:1.85rem;height:1.85rem;border:0;border-radius:6px;background:transparent;color:rgb(var(--color-secondary));cursor:pointer}.writing-studio-icon-button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}.writing-studio-icon-button:disabled{cursor:default;opacity:.45}.writing-studio-icon-button[data-tooltip]::after{content:attr(data-tooltip);position:absolute;right:0;top:calc(100% + .4rem);z-index:50;pointer-events:none;max-width:12rem;white-space:nowrap;border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-surface));box-shadow:0 10px 28px rgba(0,0,0,.28);color:rgb(var(--color-primary));font-size:.72rem;font-weight:500;line-height:1;padding:.42rem .5rem;opacity:0;transform:translateY(-2px);transition:opacity .12s ease,transform .12s ease}.writing-studio-icon-button[data-tooltip]:hover::after,.writing-studio-icon-button[data-tooltip]:focus-visible::after{opacity:1;transform:translateY(0)}.writing-studio-tool-menu{position:relative}.writing-studio-export-menu{position:absolute;right:0;top:2.2rem;z-index:20;display:grid;min-width:8.5rem;border:1px solid rgb(var(--color-border-default));border-radius:8px;background:rgb(var(--color-surface));box-shadow:0 12px 32px rgba(0,0,0,.28);padding:.25rem}.writing-studio-export-menu button{border:0;border-radius:6px;background:transparent;color:rgb(var(--color-secondary));padding:.45rem .55rem;text-align:left;font:inherit;font-size:.78rem;cursor:pointer}.writing-studio-export-menu button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}
.writing-studio-chat-shell{display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0}.writing-studio-chat-view{min-height:0;overflow:auto;padding:.9rem .75rem}.writing-studio-chat-composer{border-top:1px solid rgb(var(--color-border-subtle))}.writing-studio-chat-composer [class*="px-8"]{padding-left:.75rem;padding-right:.75rem}.writing-studio-chat-composer [class*="sm:px-10"]{padding-left:.75rem;padding-right:.75rem}.writing-studio-chat-meta{display:flex;align-items:center;justify-content:space-between;gap:.5rem;min-height:1rem;padding:.25rem .9rem .75rem;color:rgb(var(--color-dim));font-size:.66rem;font-family:var(--font-mono,monospace)}.writing-studio-muted{margin:0;color:rgb(var(--color-dim));font-size:.84rem;line-height:1.55}
.writing-studio-modal-backdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.48)}.writing-studio-modal{width:min(34rem,calc(100vw - 2rem));border:1px solid rgb(var(--color-border-default));border-radius:8px;background:rgb(var(--color-surface));box-shadow:0 24px 80px rgba(0,0,0,.35)}.writing-studio-modal.is-docs{width:min(42rem,calc(100vw - 2rem))}.writing-studio-modal-header{display:flex;align-items:center;justify-content:space-between;padding:1rem;border-bottom:1px solid rgb(var(--color-border-subtle))}.writing-studio-modal-header h2{margin:0;font-size:1rem}.writing-studio-modal-body{display:grid;gap:1rem;padding:1rem}.writing-studio-field{display:grid;gap:.4rem}.writing-studio-field label{color:rgb(var(--color-secondary));font-size:.8rem}.writing-studio-field input,.writing-studio-field textarea,.writing-studio-doc-search{border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-base));color:rgb(var(--color-primary));padding:.55rem .65rem;font:inherit;font-size:.86rem}.writing-studio-field textarea{min-height:7rem;resize:vertical}.writing-studio-modal-actions{display:flex;justify-content:flex-end;gap:.5rem;padding:0 1rem 1rem}.writing-studio-doc-list{height:min(52vh,28rem);min-height:14rem;overflow:hidden}.writing-studio-doc-list file-tree-container{height:100%;font-size:.8rem}.writing-studio-doc-empty{padding:.35rem .1rem}.writing-studio-doc-import input[type=file]{display:none}
.writing-studio-center{display:flex;align-items:center;justify-content:center;height:100%;padding:2rem}
@media(max-width:1100px){.writing-studio-canvas{grid-template-columns:minmax(0,1fr)}.writing-studio-comments{position:static;padding-top:0}.writing-studio-comment{max-width:48rem}}
@media(max-width:860px){.writing-studio,.writing-studio.has-collapsed-rail{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(18rem,42vh)}.writing-studio-rail{border-left:0;border-top:1px solid rgb(var(--color-border-subtle))}.writing-studio-rail-resizer{display:none}}
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
  fileName: string;
  folderPath: string;
  path: string;
  updatedAt: string;
  wordCount: number;
}

interface WritingModelInfo {
  id: string;
  provider: string;
  name: string;
  context: number;
  input?: Array<'text' | 'image'>;
  reasoning?: boolean;
  supportedServiceTiers?: string[];
}

interface WritingModelState {
  currentModel?: string;
  currentThinkingLevel?: string;
  models?: WritingModelInfo[];
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
  fileName: string;
  folderPath: string;
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

type WritingIconName = 'open' | 'new' | 'save' | 'export' | 'review' | 'settings' | 'collapse' | 'expand' | 'close';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
type FileTreeModelResult = {
  model: TreesModel;
  resetTree: (paths: readonly string[], options?: { initialExpandedPaths?: readonly string[]; initialSelectedPaths?: readonly string[] }) => void;
};
type FileTreeModelOptions = {
  search: boolean;
  useNativeContextMenu: boolean;
  dragAndDrop: false;
  onSelectionChange: (paths: readonly string[]) => void;
  unsafeCSS: string;
};

const actorId = `writer-${Math.random().toString(16).slice(2)}`;
const railWidthStorageKey = 'writing-studio:rail-width';
const modelStorageKey = 'writing-studio:model';
const thinkingLevelStorageKey = 'writing-studio:thinking-level';
const defaultRailWidth = 352;
const minRailWidth = 288;
const maxRailWidth = 620;
const useWritingStudioFileTreeModel = useFileTreeModel as unknown as (options: FileTreeModelOptions) => FileTreeModelResult;

const iconPaths: Record<WritingIconName, string> = {
  open: 'M3.5 6.5h5l1.4 1.8h6.6v7.2a2 2 0 0 1-2 2h-11z M3.5 6.5v-2h5l1.2 1.3h6.8v2.5',
  new: 'M9 3.5v13 M2.5 10h13',
  save: 'M4 3.5h9l2.5 2.5v10.5h-11.5z M6 3.5v4h6 M6.5 16.5v-5h6v5',
  export: 'M9 12.5v-9 M5.5 7 9 3.5 12.5 7 M4 11v4.5h10V11',
  review: 'M3.5 4.5h10v8h-6l-4 3.5z M6 7.5h5 M6 10h3',
  settings: 'M8.5 2.8 9.8 5l2.5.5.3 2.5 2 1.6-1.2 2.2.7 2.4-2.3 1.2-2-1.5-2 .8-2-1.3-2.4.6-1.1-2.4 1.5-1.9-.9-2.3 2.1-1.5.4-2.5 2.5-.5z M8.5 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
  collapse: 'M6.5 4.5 10.5 8.5l-4 4',
  expand: 'M10.5 4.5 6.5 8.5l4 4',
  close: 'M4.5 4.5 12.5 12.5 M12.5 4.5 4.5 12.5',
};

function WritingIcon({ name }: { name: WritingIconName }) {
  return (
    <svg width="15" height="15" viewBox="0 0 17 17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={iconPaths[name]} />
    </svg>
  );
}

function FormatButton({
  label,
  title,
  active,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`writing-studio-format-button ${active ? 'is-active' : ''}`}
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

function WritingFormatBar({ editor }: { editor: Editor | null }) {
  const disabled = !editor;
  return (
    <div className="writing-studio-formatbar" aria-label="Document formatting">
      <div className="writing-studio-format-group">
        <FormatButton label="P" title="Paragraph" disabled={disabled} active={Boolean(editor?.isActive('paragraph'))} onClick={() => editor?.chain().focus().setParagraph().run()} />
        <FormatButton label="H1" title="Heading 1" disabled={disabled} active={Boolean(editor?.isActive('heading', { level: 1 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} />
        <FormatButton label="H2" title="Heading 2" disabled={disabled} active={Boolean(editor?.isActive('heading', { level: 2 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
      </div>
      <div className="writing-studio-format-group">
        <FormatButton label="B" title="Bold" disabled={disabled} active={Boolean(editor?.isActive('bold'))} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <FormatButton label="I" title="Italic" disabled={disabled} active={Boolean(editor?.isActive('italic'))} onClick={() => editor?.chain().focus().toggleItalic().run()} />
      </div>
      <div className="writing-studio-format-group">
        <FormatButton label="•" title="Bulleted list" disabled={disabled} active={Boolean(editor?.isActive('bulletList'))} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <FormatButton label="1." title="Numbered list" disabled={disabled} active={Boolean(editor?.isActive('orderedList'))} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
        <FormatButton label="❝" title="Quote" disabled={disabled} active={Boolean(editor?.isActive('blockquote'))} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
      </div>
    </div>
  );
}

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

function readStringSetting(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStringSetting(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Ignore local storage failures.
  }
}

function readRailWidth(): number {
  const value = Number(readStringSetting(railWidthStorageKey));
  return Number.isFinite(value) ? Math.min(maxRailWidth, Math.max(minRailWidth, value)) : defaultRailWidth;
}

function modelSelectionValue(model: WritingModelInfo, models: WritingModelInfo[]): string {
  const duplicateId = models.some((other) => other.id === model.id && other.provider !== model.provider);
  return duplicateId ? `${model.provider}/${model.id}` : model.id;
}

function documentTreePath(doc: DocumentSummary): string {
  const folderPath = doc.folderPath?.trim() || 'Drafts';
  const fileName = doc.fileName?.trim() || `${doc.title || 'Draft'}.md`;
  return doc.path?.trim() || `${folderPath}/${fileName}`;
}

function folderPathsFor(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  return parts.slice(0, -1).map((_, index) => `${parts.slice(0, index + 1).join('/')}/`);
}

function readMarkdownFromEditor(editor: MarkdownEditor): string {
  const json = typeof editor.getJSON === 'function' ? editor.getJSON() : null;
  if (json) return markdownFromNode(json).trimEnd();
  return typeof editor.getMarkdown === 'function' ? editor.getMarkdown() : '';
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_{}[\]])/g, '\\$1');
}

function textFromNode(node: ReturnType<NonNullable<MarkdownEditor['getJSON']>>): string {
  if (typeof node.text === 'string') {
    let text = escapeMarkdownText(node.text);
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') text = `**${text}**`;
      if (mark.type === 'italic') text = `_${text}_`;
      if (mark.type === 'code') text = `\`${text.replace(/`/g, '\\`')}\``;
    }
    return text;
  }
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
  if (node.type === 'bulletList') return (node.content ?? []).map((child) => `- ${markdownFromNode(child).replace(/\n/g, '\n  ')}`).join('\n');
  if (node.type === 'orderedList') return (node.content ?? []).map((child, index) => `${index + 1}. ${markdownFromNode(child).replace(/\n/g, '\n   ')}`).join('\n');
  if (node.type === 'listItem') return (node.content ?? []).map(markdownFromNode).filter(Boolean).join('\n');
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
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState('default');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [documentSearch, setDocumentSearch] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [railWidth, setRailWidth] = useState(readRailWidth);
  const [models, setModels] = useState<WritingModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState(() => readStringSetting(modelStorageKey));
  const [currentThinkingLevel, setCurrentThinkingLevel] = useState(() => readStringSetting(thinkingLevelStorageKey));
  const [settingsDraft, setSettingsDraft] = useState<WritingSettings>({ reviewIntervalSeconds: 12, reviewPrompt: '' });
  const [, setFormatStateVersion] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingEditorContent = useRef(false);
  const documentIdByTreePathRef = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    fetch(buildApiPath('/models'))
      .then((response) => {
        if (!response.ok) throw new Error(`Model list failed: ${response.status}`);
        return response.json() as Promise<WritingModelState>;
      })
      .then((result) => {
        if (cancelled) return;
        const nextModels = Array.isArray(result.models) ? result.models : [];
        setModels(nextModels);
        setCurrentModel((current) => {
          const stored = current || readStringSetting(modelStorageKey);
          const next = stored || result.currentModel || (nextModels[0] ? modelSelectionValue(nextModels[0], nextModels) : '');
          writeStringSetting(modelStorageKey, next);
          return next;
        });
        setCurrentThinkingLevel((current) => {
          const stored = current || readStringSetting(thinkingLevelStorageKey);
          const next = stored || result.currentThinkingLevel || '';
          writeStringSetting(thinkingLevelStorageKey, next);
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRailResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const maxWidth = Math.min(maxRailWidth, Math.max(minRailWidth, Math.floor(window.innerWidth * 0.55)));

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(maxWidth, Math.max(minRailWidth, Math.round(window.innerWidth - moveEvent.clientX)));
      setRailWidth(nextWidth);
      writeStringSetting(railWidthStorageKey, String(nextWidth));
    };

    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize, { once: true });
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setCurrentModel(modelId);
    writeStringSetting(modelStorageKey, modelId);
  }, []);

  const handleSelectThinkingLevel = useCallback((thinkingLevel: string) => {
    setCurrentThinkingLevel(thinkingLevel);
    writeStringSetting(thinkingLevelStorageKey, thinkingLevel);
  }, []);

  const persistUpdate = useCallback(
    (update: Uint8Array, nextMarkdown: string) => {
      setSaveStatus('unsaved');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setSaveStatus('saving');
        void pa.extension
          .invoke('writingStudioAppendUpdate', { updateBase64: bytesToBase64(update), markdown: nextMarkdown, actorId, documentId: activeDocumentId })
          .then(() => {
            setVisibleEventCount((current) => current + 1);
            setSaveStatus('saved');
          })
          .catch((err: Error) => {
            setSaveStatus('error');
            setError(err.message);
          });
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
      setFormatStateVersion((version) => version + 1);
      const nextMarkdown = readMarkdownFromEditor(nextEditor);
      setMarkdown(nextMarkdown);
      replaceMarkdown(nextMarkdown);
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
      reviewTimer.current = setTimeout(() => {
        void runReview('periodic');
      }, Math.max(3, state?.settings.reviewIntervalSeconds ?? 12) * 1000);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const refreshFormatState = () => setFormatStateVersion((version) => version + 1);
    editor.on('selectionUpdate', refreshFormatState);
    editor.on('transaction', refreshFormatState);
    return () => {
      editor.off('selectionUpdate', refreshFormatState);
      editor.off('transaction', refreshFormatState);
    };
  }, [editor]);

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
    setSaveStatus('saved');
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

  const handleTreeSelectionChange = useCallback(
    (paths: readonly string[]) => {
      const selectedPath = paths[0];
      if (!selectedPath || selectedPath.endsWith('/')) return;
      const documentId = documentIdByTreePathRef.current.get(selectedPath);
      if (!documentId) return;
      setDocumentsOpen(false);
      void load(documentId);
    },
    [load],
  );

  const { model: documentTreeModel, resetTree: resetDocumentTree } = useWritingStudioFileTreeModel({
    search: false,
    useNativeContextMenu: false,
    dragAndDrop: false,
    onSelectionChange: handleTreeSelectionChange,
    unsafeCSS: `
      :host{--tree-row-height:26px}
      .row{font-size:12px}
      .row[aria-selected="true"]{background:rgb(var(--color-surface-hover))}
    `,
  });

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
        const result = (await pa.extension.invoke('writingStudioRunReview', {
          markdown: currentMarkdown,
          trigger,
          documentId: activeDocumentId,
          modelRef: currentModel || undefined,
        })) as { annotations: Annotation[] };
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
    [activeDocumentId, currentModel, editor, markdown, pa, syncEditorMarkdown],
  );

  const sendChat = useCallback(
    async (body: string) => {
      if (!body.trim()) return;
      setBusy('chat');
      try {
        const currentMarkdown = syncEditorMarkdown() ?? markdown;
        const result = (await pa.extension.invoke('writingStudioSendChat', { body, markdown: currentMarkdown, documentId: activeDocumentId })) as { messages: ChatMessage[] };
        setState((current) => (current ? { ...current, chat: result.messages } : current));
        setVisibleEventCount((current) => current + 2);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [activeDocumentId, markdown, pa, syncEditorMarkdown],
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
    setSaveStatus('saving');
    const currentMarkdown = syncEditorMarkdown() ?? markdown;
    try {
      const result = (await pa.extension.invoke('writingStudioSaveDocument', { documentId: activeDocumentId, markdown: currentMarkdown })) as {
        document: DocumentSummary;
      };
      setDocuments((current) => [result.document, ...current.filter((doc) => doc.id !== result.document.id)]);
      setVisibleEventCount((current) => current + 1);
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeDocumentId, markdown, pa, syncEditorMarkdown]);

  const createDocument = useCallback(async () => {
    const next = (await pa.extension.invoke('writingStudioCreateDocument', { title: 'Untitled', fileName: 'untitled.md', folderPath: 'Drafts' })) as StoredState;
    setState(next);
    setDocuments(next.documents ?? []);
    setActiveDocumentId(next.activeDocumentId ?? next.id ?? 'default');
    setMarkdown(next.markdown);
    setMarkdownSilently(next.markdown);
    setSaveStatus('saved');
    editor?.commands.setContent(next.markdown, { contentType: 'markdown' });
  }, [editor, pa, setMarkdownSilently]);

  const importDocument = useCallback(
    async (file: File) => {
      const text = await file.text();
      const next = (await pa.extension.invoke('writingStudioImportDocument', {
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        folderPath: 'Imports',
        markdown: text,
      })) as StoredState;
      setState(next);
      setDocuments(next.documents ?? []);
      setActiveDocumentId(next.activeDocumentId ?? next.id ?? 'default');
      setMarkdown(next.markdown);
      setMarkdownSilently(next.markdown);
      setSaveStatus('saved');
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

  const filteredDocuments = useMemo(() => documents.filter((doc) => {
    const query = documentSearch.trim().toLowerCase();
    if (!query) return true;
    return `${doc.title} ${doc.fileName} ${doc.folderPath} ${documentTreePath(doc)}`.toLowerCase().includes(query);
  }), [documentSearch, documents]);
  const documentTree = useMemo(() => {
    const filePaths: string[] = [];
    const folderPaths = new Set<string>();
    const documentIdByPath = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const doc of filteredDocuments) {
      const basePath = documentTreePath(doc);
      const count = (counts.get(basePath) ?? 0) + 1;
      counts.set(basePath, count);
      const treePath = count === 1 ? basePath : basePath.replace(/(\.[^/.]+)?$/, `-${count}$1`);
      for (const folderPath of folderPathsFor(treePath)) folderPaths.add(folderPath);
      filePaths.push(treePath);
      documentIdByPath.set(treePath, doc.id);
    }
    const activeDoc = filteredDocuments.find((doc) => doc.id === activeDocumentId);
    const activePath = activeDoc ? Array.from(documentIdByPath.entries()).find(([, id]) => id === activeDoc.id)?.[0] : undefined;
    return {
      paths: [...folderPaths, ...filePaths],
      expandedPaths: [...folderPaths],
      selectedPaths: activePath ? [activePath] : [],
      documentIdByPath,
    };
  }, [activeDocumentId, filteredDocuments]);

  useEffect(() => {
    documentIdByTreePathRef.current = documentTree.documentIdByPath;
    resetDocumentTree(documentTree.paths, { initialExpandedPaths: documentTree.expandedPaths, initialSelectedPaths: documentTree.selectedPaths });
  }, [documentTree, resetDocumentTree]);

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
  const saveStatusLabel = saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? 'Unsaved' : 'Save failed';
  const layoutStyle = { '--writing-studio-rail-width': `${railWidth}px` } as CSSProperties;

  return (
    <main className={`writing-studio ${railCollapsed ? 'has-collapsed-rail' : ''}`} style={layoutStyle}>
      <section className="writing-studio-main">
        <div className="writing-studio-meta">
          <span>{eventCount} replay events · Last review {formatTime(state?.lastAgentRunAt ?? null)} · {resolvedCount} resolved</span>
          <span className={`writing-studio-save-status is-${saveStatus}`}>{saveStatusLabel}</span>
        </div>
        <WritingFormatBar editor={editor} />
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
        {!railCollapsed && (
          <div
            className="writing-studio-rail-resizer"
            role="separator"
            aria-label="Resize chat sidebar"
            aria-orientation="vertical"
            tabIndex={0}
            onPointerDown={handleRailResizeStart}
          />
        )}
        <div className="writing-studio-rail-toolbar">
          {!railCollapsed && <span className="writing-studio-rail-title">Chat</span>}
          <div className="writing-studio-rail-tools">
            {!railCollapsed && (
              <button className="writing-studio-icon-button" type="button" aria-label="Open document" data-tooltip="Open document" onClick={() => setDocumentsOpen(true)}>
                <WritingIcon name="open" />
              </button>
            )}
            {!railCollapsed && (
              <button className="writing-studio-icon-button" type="button" aria-label="New document" data-tooltip="New document" onClick={() => void createDocument()}>
                <WritingIcon name="new" />
              </button>
            )}
            {!railCollapsed && (
              <button className="writing-studio-icon-button" type="button" aria-label="Save document" data-tooltip="Save document" onClick={() => void saveDocument()}>
                <WritingIcon name="save" />
              </button>
            )}
            {!railCollapsed && (
              <div className="writing-studio-tool-menu">
                <button className="writing-studio-icon-button" type="button" aria-label="Export document" data-tooltip="Export document" onClick={() => setExportMenuOpen((open) => !open)}>
                  <WritingIcon name="export" />
                </button>
                {exportMenuOpen && (
                  <div className="writing-studio-export-menu">
                    {(['markdown', 'html', 'rtf', 'docx', 'pdf'] as const).map((format) => (
                      <button key={format} type="button" onClick={() => {
                        setExportMenuOpen(false);
                        void exportDocument(format);
                      }}>
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!railCollapsed && (
              <button className="writing-studio-icon-button" type="button" aria-label="Review document" data-tooltip="Review document" onClick={() => void runReview('manual')} disabled={busy === 'review'}>
                <WritingIcon name="review" />
              </button>
            )}
            {!railCollapsed && (
              <button className="writing-studio-icon-button" type="button" aria-label="Writing Studio settings" data-tooltip="Settings" onClick={() => setSettingsOpen(true)}>
                <WritingIcon name="settings" />
              </button>
            )}
            <button
              className="writing-studio-icon-button"
              type="button"
              aria-label={railCollapsed ? 'Expand chat' : 'Collapse chat'}
              data-tooltip={railCollapsed ? 'Expand chat' : 'Collapse chat'}
              onClick={() => setRailCollapsed((collapsed) => !collapsed)}
            >
              <WritingIcon name={railCollapsed ? 'expand' : 'collapse'} />
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
          <div className="writing-studio-chat-composer" aria-label="Writing Studio chat composer">
            <ChatRailComposer
              conversationId={null}
              workspaceCwd={null}
              isStreaming={busy === 'chat'}
              models={models}
              currentModel={currentModel}
              currentThinkingLevel={currentThinkingLevel}
              tokens={null}
              contextUsage={null}
              onSubmit={(text: string) => {
                void sendChat(text);
              }}
              onAbortStream={() => setBusy(null)}
              onSelectModel={handleSelectModel}
              onSelectThinkingLevel={handleSelectThinkingLevel}
              composerMeta={<></>}
            />
          </div>
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

      {documentsOpen && (
        <div className="writing-studio-modal-backdrop" role="dialog" aria-modal="true" aria-label="Open writing document">
          <div className="writing-studio-modal is-docs">
            <div className="writing-studio-modal-header">
              <h2>Open document</h2>
              <div className="writing-studio-rail-tools writing-studio-doc-import">
                <label className="writing-studio-icon-button" data-tooltip="Import markdown" aria-label="Import markdown">
                  <WritingIcon name="open" />
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,text/markdown,text/plain"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) {
                        setDocumentsOpen(false);
                        void importDocument(file);
                      }
                    }}
                  />
                </label>
                <button className="writing-studio-icon-button" type="button" aria-label="Close documents" data-tooltip="Close" onClick={() => setDocumentsOpen(false)}>
                  <WritingIcon name="close" />
                </button>
              </div>
            </div>
            <div className="writing-studio-modal-body">
              <input
                className="writing-studio-doc-search"
                value={documentSearch}
                onChange={(event) => setDocumentSearch(event.target.value)}
                placeholder="Search documents..."
                aria-label="Search documents"
                autoFocus
              />
              <div className="writing-studio-doc-list">
                {filteredDocuments.length === 0 ? (
                  <p className="writing-studio-muted writing-studio-doc-empty">No documents match that search.</p>
                ) : (
                  <TreesFileTree className="writing-studio-doc-tree" model={documentTreeModel} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
