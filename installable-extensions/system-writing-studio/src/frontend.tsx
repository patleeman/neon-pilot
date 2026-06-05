import { Markdown } from '@tiptap/markdown';
import { Extension } from '@tiptap/core';
import type { FileTree as TreesModel } from '@pierre/trees';
import { FileTree as TreesFileTree } from '@pierre/trees/react';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { EditorContent, type Editor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { NativeExtensionClient } from '@neon-pilot/extensions';
import {
  buildApiPath,
  ErrorState,
  ExtensionChatRail,
  LoadingState,
  ToolbarButton,
  useFileTreeModel,
} from '@neon-pilot/extensions/ui';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
.writing-studio-filebar{display:flex;align-items:center;max-width:68rem;margin:0 auto .55rem}.writing-studio-file-name{width:min(24rem,100%);min-width:0;border:0;border-radius:6px;background:transparent;color:rgb(var(--color-secondary));padding:.28rem .4rem;font:inherit;font-size:.86rem;font-weight:560;line-height:1.2}.writing-studio-file-name:hover,.writing-studio-file-name:focus{background:rgb(var(--color-surface));color:rgb(var(--color-primary));outline:1px solid rgb(var(--color-border-subtle))}.writing-studio-file-name::placeholder{color:rgb(var(--color-dim))}
.writing-studio-inline-error{max-width:68rem;margin:0 auto .55rem;border:1px solid color-mix(in srgb,rgb(var(--color-danger)) 38%,rgb(var(--color-border-default)));border-radius:7px;background:color-mix(in srgb,rgb(var(--color-danger)) 8%,transparent);color:rgb(var(--color-danger));font-size:.78rem;line-height:1.4;padding:.45rem .6rem}
.writing-studio-formatbar{position:sticky;top:.75rem;z-index:30;display:flex;flex-wrap:wrap;align-items:center;gap:.16rem;max-width:68rem;margin:0 auto .8rem;padding:.32rem;border:1px solid rgb(var(--color-border-subtle));border-radius:8px;background:rgb(var(--color-surface));box-shadow:0 10px 26px rgba(0,0,0,.12)}.writing-studio-hidden-file{display:none}.writing-studio-format-spacer{flex:1 1 auto;min-width:.5rem}.writing-studio-format-save,.writing-studio-format-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;width:1.58rem;height:1.55rem;border:0;border-radius:5px;background:transparent;color:rgb(var(--color-secondary));cursor:pointer}.writing-studio-format-save:hover,.writing-studio-format-icon:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}.writing-studio-format-save:disabled,.writing-studio-format-icon:disabled{cursor:default;opacity:.55}.writing-studio-format-save::after{content:"";position:absolute;right:.16rem;top:.16rem;width:.34rem;height:.34rem;border-radius:999px;background:rgb(var(--color-dim))}.writing-studio-format-save.is-saved::after{background:rgb(var(--color-success))}.writing-studio-format-save.is-saving::after{background:rgb(var(--color-accent));animation:writing-studio-pulse 1s ease-in-out infinite}.writing-studio-format-save.is-unsaved::after{background:rgb(var(--color-warning))}.writing-studio-format-save.is-error::after{background:rgb(var(--color-danger))}.writing-studio-format-icon.is-running{background:color-mix(in srgb,rgb(var(--color-accent)) 16%,transparent);color:rgb(var(--color-accent));opacity:1}.writing-studio-format-icon.is-running svg{animation:writing-studio-review-spin 1.1s linear infinite}.writing-studio-format-status{max-width:10rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgb(var(--color-dim));font-size:.72rem;line-height:1}.writing-studio-format-status.is-running{color:rgb(var(--color-accent))}.writing-studio-format-status.is-complete{color:rgb(var(--color-success))}.writing-studio-format-status.is-error{color:rgb(var(--color-danger))}@keyframes writing-studio-pulse{0%,100%{opacity:.45}50%{opacity:1}}.writing-studio-format-group{display:flex;align-items:center;gap:.1rem;padding-right:.32rem;margin-right:.16rem;border-right:1px solid rgb(var(--color-border-subtle))}.writing-studio-format-group:last-child{padding-right:0;margin-right:0;border-right:0}.writing-studio-format-button{display:inline-flex;align-items:center;justify-content:center;min-width:1.58rem;height:1.55rem;border:0;border-radius:5px;background:transparent;color:rgb(var(--color-secondary));font:inherit;font-size:.67rem;font-weight:650;cursor:pointer;white-space:nowrap}.writing-studio-format-button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}.writing-studio-format-button.is-active{background:color-mix(in srgb,rgb(var(--color-accent)) 18%,transparent);color:rgb(var(--color-accent))}.writing-studio-format-button:disabled{cursor:default;opacity:.42}.writing-studio-link-popover{position:absolute;left:.32rem;top:calc(100% + .35rem);z-index:30;display:flex;align-items:center;gap:.35rem;width:min(24rem,calc(100vw - 3rem));padding:.45rem;border:1px solid rgb(var(--color-border-default));border-radius:8px;background:rgb(var(--color-surface));box-shadow:0 14px 40px rgba(0,0,0,.3)}.writing-studio-link-popover input{min-width:0;flex:1;border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-base));color:rgb(var(--color-primary));padding:.42rem .5rem;font:inherit;font-size:.78rem}.writing-studio-link-popover button{border:0;border-radius:6px;background:transparent;color:rgb(var(--color-secondary));padding:.38rem .5rem;font:inherit;font-size:.74rem;cursor:pointer}.writing-studio-link-popover button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}
.writing-studio-canvas{display:grid;grid-template-columns:minmax(0,48rem) minmax(13rem,18rem);align-items:start;gap:1.25rem;max-width:68rem;margin:0 auto}
.writing-studio-editor-frame{position:relative}.writing-studio-editor{min-height:76vh;padding:.25rem 0 5rem;outline:none;font-size:1rem;line-height:1.72}.writing-studio-editor h1,.writing-studio-editor h2,.writing-studio-editor h3{line-height:1.25}.writing-studio-editor h1{margin:0 0 1.35rem;font-size:2.15rem;font-weight:680}.writing-studio-editor h2{margin:1.8rem 0 .75rem;font-size:1.45rem;font-weight:650}.writing-studio-editor h3{margin:1.5rem 0 .65rem;font-size:1.08rem;font-weight:650}.writing-studio-editor p{margin:.9rem 0}.writing-studio-editor img{display:block;max-width:100%;height:auto;margin:1rem 0;border-radius:6px}.writing-studio-editor blockquote{margin:1.2rem 0;padding-left:1rem;border-left:2px solid rgb(var(--color-accent));color:rgb(var(--color-secondary))}
.writing-studio-selection-menu{position:absolute;z-index:35;display:flex;align-items:center;gap:.18rem;padding:.25rem;border:1px solid rgb(var(--color-border-default));border-radius:8px;background:rgb(var(--color-surface));box-shadow:0 14px 36px rgba(0,0,0,.28);transform:translateX(-50%)}.writing-studio-selection-menu button{border:0;border-radius:6px;background:transparent;color:rgb(var(--color-secondary));padding:.36rem .52rem;font:inherit;font-size:.72rem;font-weight:590;line-height:1;cursor:pointer;white-space:nowrap}.writing-studio-selection-menu button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}.writing-studio-selection-menu button:first-child{color:rgb(var(--color-accent))}
.writing-studio-mark-highlight{border-radius:3px;background:color-mix(in srgb,rgb(var(--color-accent)) 21%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,rgb(var(--color-accent)) 22%,transparent)}.writing-studio-mark-highlight[data-kind="warning"]{background:color-mix(in srgb,rgb(var(--color-warning)) 23%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,rgb(var(--color-warning)) 24%,transparent)}.writing-studio-mark-highlight[data-kind="comment"]{background:color-mix(in srgb,rgb(var(--color-secondary)) 18%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,rgb(var(--color-secondary)) 20%,transparent)}.writing-studio-mark-highlight[data-kind="reaction"]{background:color-mix(in srgb,rgb(var(--color-success)) 18%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,rgb(var(--color-success)) 20%,transparent)}
.writing-studio-comments{position:relative;min-height:76vh;padding-top:.25rem}.writing-studio-comment{--comment-tint:rgb(var(--color-accent));position:absolute;left:0;right:0;padding:.7rem .75rem;border:1px solid color-mix(in srgb,var(--comment-tint) 18%,rgb(var(--color-border-subtle)));border-radius:8px;background:color-mix(in srgb,var(--comment-tint) 7%,rgb(var(--color-surface)));box-shadow:0 8px 22px rgba(0,0,0,.12);cursor:pointer;text-align:left;transition:top .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease}.writing-studio-comment.is-active{border-color:color-mix(in srgb,var(--comment-tint) 48%,rgb(var(--color-border-default)));background:color-mix(in srgb,var(--comment-tint) 13%,rgb(var(--color-surface)));box-shadow:0 0 0 1px color-mix(in srgb,var(--comment-tint) 28%,transparent),0 12px 28px rgba(0,0,0,.18)}.writing-studio-comment.is-warning{--comment-tint:rgb(var(--color-warning))}.writing-studio-comment.is-comment{--comment-tint:rgb(var(--color-secondary))}.writing-studio-comment.is-reaction{--comment-tint:rgb(var(--color-success))}
.writing-studio-comment-top{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.45rem}.writing-studio-comment-kind{color:color-mix(in srgb,var(--comment-tint) 72%,rgb(var(--color-secondary)));font-size:.68rem;font-weight:620;text-transform:capitalize;letter-spacing:.01em}.writing-studio-comment-actions{display:flex;align-items:center;gap:.25rem}.writing-studio-comment-actions button{border:0;border-radius:5px;background:transparent;color:rgb(var(--color-secondary));cursor:pointer;font:inherit;font-size:.72rem}.writing-studio-comment-actions button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}.writing-studio-comment-discuss{padding:.22rem .4rem}.writing-studio-comment-close{display:inline-flex;align-items:center;justify-content:center;width:1.35rem;height:1.35rem;padding:0;font-size:.9rem;line-height:1}.writing-studio-comment p{margin:0;color:rgb(var(--color-secondary));font-size:.8rem;line-height:1.45}.writing-studio-suggested-edit{display:grid;gap:.45rem;margin-top:.65rem;padding:.55rem;border-radius:7px;background:color-mix(in srgb,var(--comment-tint) 8%,rgb(var(--color-base)))}.writing-studio-suggested-edit pre{margin:0;white-space:pre-wrap;color:rgb(var(--color-primary));font:inherit;font-size:.78rem;line-height:1.42}.writing-studio-apply-edit{justify-self:start;border:1px solid color-mix(in srgb,var(--comment-tint) 34%,rgb(var(--color-border-subtle)));border-radius:6px;background:color-mix(in srgb,var(--comment-tint) 12%,rgb(var(--color-surface)));color:rgb(var(--color-primary));font:inherit;font-size:.72rem;font-weight:620;padding:.32rem .55rem;cursor:pointer}.writing-studio-apply-edit:hover{background:color-mix(in srgb,var(--comment-tint) 20%,rgb(var(--color-surface-hover)))}.writing-studio-comment-empty{color:rgb(var(--color-dim));font-size:.8rem;line-height:1.5}
.writing-studio-rail{position:relative;display:grid;grid-template-rows:auto minmax(0,1fr);min-width:0;min-height:0;border-left:1px solid rgb(var(--color-border-subtle));background:rgb(var(--color-base))}
.writing-studio-rail-resizer{position:absolute;left:-4px;top:0;bottom:0;z-index:25;width:8px;cursor:col-resize}.writing-studio-rail-resizer::after{content:"";position:absolute;left:3px;top:0;bottom:0;width:1px;background:transparent}.writing-studio-rail-resizer:hover::after,.writing-studio-rail-resizer:focus-visible::after{background:rgb(var(--color-accent))}
.writing-studio-rail.is-collapsed{grid-template-columns:3rem;width:3rem}.writing-studio-rail.is-collapsed .writing-studio-chat-shell{display:none}.writing-studio-rail-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.5rem;min-height:2.8rem;padding:.55rem .75rem;border-bottom:1px solid rgb(var(--color-border-subtle))}
.writing-studio-rail-title{color:rgb(var(--color-secondary));font-size:.74rem;font-weight:650;text-transform:uppercase}.writing-studio-rail-heading{display:flex;align-items:center;gap:.55rem;min-width:0}.writing-studio-review-status{color:rgb(var(--color-dim));font-size:.72rem;white-space:nowrap}.writing-studio-review-status.is-running{color:rgb(var(--color-accent))}.writing-studio-review-status.is-complete{color:rgb(var(--color-success))}.writing-studio-rail-tools{display:flex;align-items:center;gap:.25rem}.writing-studio-icon-button{position:relative;display:inline-flex;align-items:center;justify-content:center;width:1.85rem;height:1.85rem;border:0;border-radius:6px;background:transparent;color:rgb(var(--color-secondary));cursor:pointer}.writing-studio-icon-button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}.writing-studio-icon-button:disabled{cursor:default;opacity:.45}.writing-studio-icon-button.is-running{background:color-mix(in srgb,rgb(var(--color-accent)) 16%,transparent);color:rgb(var(--color-accent));opacity:1}.writing-studio-icon-button.is-running svg{animation:writing-studio-review-spin 1.1s linear infinite}@keyframes writing-studio-review-spin{to{transform:rotate(360deg)}}.writing-studio-icon-button[data-tooltip]::after{content:attr(data-tooltip);position:absolute;right:0;top:calc(100% + .4rem);z-index:50;pointer-events:none;max-width:12rem;white-space:nowrap;border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-surface));box-shadow:0 10px 28px rgba(0,0,0,.28);color:rgb(var(--color-primary));font-size:.72rem;font-weight:500;line-height:1;padding:.42rem .5rem;opacity:0;transform:translateY(-2px);transition:opacity .12s ease,transform .12s ease}.writing-studio-icon-button[data-tooltip]:hover::after,.writing-studio-icon-button[data-tooltip]:focus-visible::after{opacity:1;transform:translateY(0)}.writing-studio-tool-menu{position:relative}.writing-studio-export-menu{position:absolute;right:0;top:2.2rem;z-index:20;display:grid;min-width:8.5rem;border:1px solid rgb(var(--color-border-default));border-radius:8px;background:rgb(var(--color-surface));box-shadow:0 12px 32px rgba(0,0,0,.28);padding:.25rem}.writing-studio-export-menu button{border:0;border-radius:6px;background:transparent;color:rgb(var(--color-secondary));padding:.45rem .55rem;text-align:left;font:inherit;font-size:.78rem;cursor:pointer}.writing-studio-export-menu button:hover{background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary))}
.writing-studio-chat-shell{min-height:0;background:rgb(var(--color-base))}.writing-studio-extension-chat{display:flex;height:100%;min-height:0;flex-direction:column;background:rgb(var(--color-base));color:rgb(var(--color-primary));user-select:text}.writing-studio-extension-chat [class*="px-8"]{padding-left:.75rem;padding-right:.75rem}.writing-studio-extension-chat [class*="sm:px-10"]{padding-left:.75rem;padding-right:.75rem}.writing-studio-muted{margin:.9rem .75rem;color:rgb(var(--color-dim));font-size:.84rem;line-height:1.55}
.writing-studio-format-actions{position:relative}.writing-studio-format-actions .writing-studio-export-menu{left:0;right:auto;top:2.05rem}.writing-studio-review-status.is-error{color:rgb(var(--color-danger))}
.writing-studio-modal-backdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.56)}.writing-studio-modal{width:min(34rem,calc(100vw - 2rem));border:1px solid rgb(var(--color-border-default));border-radius:8px;background:rgb(var(--color-surface));box-shadow:0 24px 80px rgba(0,0,0,.35)}.writing-studio-modal-header{display:flex;align-items:center;justify-content:space-between;padding:1rem;border-bottom:1px solid rgb(var(--color-border-subtle))}.writing-studio-modal-header h2{margin:0;font-size:1rem}.writing-studio-modal-body{display:grid;gap:.65rem;padding:1rem}.writing-studio-field{display:grid;gap:.4rem}.writing-studio-field label{color:rgb(var(--color-secondary));font-size:.8rem}.writing-studio-field input,.writing-studio-field textarea{border:1px solid rgb(var(--color-border-default));border-radius:6px;background:rgb(var(--color-base));color:rgb(var(--color-primary));padding:.55rem .65rem;font:inherit;font-size:.86rem}.writing-studio-field textarea{min-height:7rem;resize:vertical}.writing-studio-modal-actions{display:flex;justify-content:flex-end;gap:.5rem;padding:0 1rem 1rem}
.writing-studio-sidebar{display:grid;grid-template-rows:auto auto auto minmax(0,1fr);height:100%;min-height:0;padding:.5rem 0 .65rem;background:rgb(var(--color-base));color:rgb(var(--color-primary));gap:.38rem}.writing-studio-sidebar-header{display:flex;align-items:center;justify-content:space-between;gap:.35rem;padding:0 .45rem}.writing-studio-sidebar-title{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:rgb(var(--color-teal) / .88)}.writing-studio-sidebar-actions{display:flex;align-items:center;gap:.08rem}.writing-studio-sidebar-actions .writing-studio-icon-button{width:auto;height:auto;padding:.25rem;border-radius:6px}.writing-studio-sidebar-actions .writing-studio-icon-button svg{width:12px;height:12px}.writing-studio-sidebar-search,.writing-studio-doc-form input{width:100%;min-width:0;border:1px solid rgb(var(--color-border-subtle));border-radius:7px;background:rgb(var(--color-base));color:rgb(var(--color-primary));font:inherit;font-size:.78rem;padding:.38rem .45rem}.writing-studio-sidebar-search{width:calc(100% - .9rem);margin:0 .45rem}.writing-studio-sidebar-search:focus,.writing-studio-doc-form input:focus{outline:1px solid rgb(var(--color-accent));border-color:rgb(var(--color-accent))}.writing-studio-doc-error{min-height:1rem;margin:0 .45rem;color:rgb(var(--color-danger));font-size:.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.writing-studio-doc-form{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:.28rem;align-items:center;margin:0 .45rem}.writing-studio-doc-form.is-danger{grid-template-columns:minmax(0,1fr) auto auto;color:rgb(var(--color-danger,255 96 96));font-size:.76rem}.writing-studio-doc-form button{border:0;border-radius:6px;background:rgb(var(--color-surface-hover));color:rgb(var(--color-primary));font:inherit;font-size:.72rem;padding:.34rem .42rem;cursor:pointer}.writing-studio-doc-form button:hover{background:rgb(var(--color-border-subtle))}.writing-studio-doc-form button.is-danger{background:color-mix(in srgb,rgb(var(--color-danger,255 96 96)) 16%,rgb(var(--color-surface)));color:rgb(var(--color-primary))}.writing-studio-doc-list{display:flex;flex-direction:column;gap:.22rem;min-height:0;overflow:hidden;border:0;border-radius:0;background:transparent}.writing-studio-doc-list file-tree-container{height:100%;font-size:.78rem;background:transparent}.writing-studio-doc-empty{margin:.2rem .45rem;padding:.35rem 0;color:rgb(var(--color-dim));font-size:.78rem}.writing-studio-doc-import input[type=file]{display:none}.writing-studio-doc-inline-action{flex:0 0 auto}.writing-studio-doc-tree{flex:1 1 auto;height:100%;min-height:0;background:transparent}
.writing-studio-center{display:flex;align-items:center;justify-content:center;height:100%;padding:2rem}
@media(max-width:1100px){.writing-studio-canvas{grid-template-columns:minmax(0,1fr)}.writing-studio-comments{position:static;display:grid;gap:.65rem;min-height:0;padding-top:0}.writing-studio-comment{position:static!important;max-width:48rem}}
@media(max-width:860px){.writing-studio,.writing-studio.has-collapsed-rail{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(18rem,42vh)}.writing-studio-rail{border-left:0;border-top:1px solid rgb(var(--color-border-subtle))}.writing-studio-rail-resizer{display:none}}
`;

function ensureWritingStudioStyle(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(styleElementId);
  if (existing) {
    if (existing.textContent !== writingStudioCss) existing.textContent = writingStudioCss;
    return;
  }
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
  suggestedReplacement?: string;
  quote: string;
  anchor?: {
    before: string;
    after: string;
  };
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
  agentInstructions: string;
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
  chatConversationId?: string;
  lastAgentRunAt: string | null;
  settings: WritingSettings;
  documents?: DocumentSummary[];
  activeDocumentId?: string;
  folders?: string[];
}

type WritingIconName =
  | 'open'
  | 'new'
  | 'folderNew'
  | 'save'
  | 'export'
  | 'image'
  | 'import'
  | 'review'
  | 'settings'
  | 'rename'
  | 'delete'
  | 'clearChat'
  | 'collapse'
  | 'expand'
  | 'close';
type DocumentActionMode = 'idle' | 'new-document' | 'new-folder' | 'rename-document' | 'rename-folder' | 'delete-document' | 'delete-folder';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
type ReviewStatus = 'idle' | 'running' | 'complete' | 'error';
type FileTreeModelResult = {
  model: TreesModel;
  resetTree: (
    paths: readonly string[],
    options?: { initialExpandedPaths?: readonly string[]; initialSelectedPaths?: readonly string[] },
  ) => void;
};
type FileTreeModelOptions = {
  search: boolean;
  useNativeContextMenu: boolean;
  dragAndDrop: false;
  onSelectionChange: (paths: readonly string[]) => void;
  unsafeCSS: string;
};
interface SelectionMenuState {
  text: string;
  left: number;
  top: number;
}

interface CommentLayout {
  railHeight: number;
}

const actorId = `writer-${Math.random().toString(16).slice(2)}`;
const railWidthStorageKey = 'writing-studio:rail-width';
const modelStorageKey = 'writing-studio:model';
const documentSelectedEventName = 'writing-studio:document-selected';
const defaultRailWidth = 352;
const minRailWidth = 288;
const maxRailWidth = 620;
const useWritingStudioFileTreeModel = useFileTreeModel as unknown as (options: FileTreeModelOptions) => FileTreeModelResult;
const annotationHighlightPluginKey = new PluginKey('writingStudioAnnotationHighlight');

interface AnnotationHighlight {
  id: string;
  kind: Annotation['kind'];
  from: number;
  to: number;
}

function createAnnotationHighlightExtension(activeHighlightRef: { current: AnnotationHighlight | null }) {
  return Extension.create({
    name: 'writingStudioAnnotationHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: annotationHighlightPluginKey,
          props: {
            decorations(state) {
              const highlight = activeHighlightRef.current;
              if (!highlight || highlight.to <= highlight.from) return DecorationSet.empty;
              const from = Math.max(1, Math.min(highlight.from, state.doc.content.size));
              const to = Math.max(from, Math.min(highlight.to, state.doc.content.size));
              return DecorationSet.create(state.doc, [
                Decoration.inline(from, to, {
                  class: 'writing-studio-mark-highlight',
                  'data-kind': highlight.kind,
                  'data-annotation-id': highlight.id,
                }),
              ]);
            },
          },
        }),
      ];
    },
  });
}

const iconPaths: Record<WritingIconName, string> = {
  open: 'M3.5 6.5h5l1.4 1.8h6.6v7.2a2 2 0 0 1-2 2h-11z M3.5 6.5v-2h5l1.2 1.3h6.8v2.5',
  new: 'M9 3.5v13 M2.5 10h13',
  folderNew: 'M2.5 6h5l1.2 1.5h5.8v7h-12z M12 2.8v4.4 M9.8 5h4.4',
  save: 'M4 3.5h9l2.5 2.5v10.5h-11.5z M6 3.5v4h6 M6.5 16.5v-5h6v5',
  export: 'M9 12.5v-9 M5.5 7 9 3.5 12.5 7 M4 11v4.5h10V11',
  image: 'M3.5 4.5h11v10h-11z M6 8a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 6 8z M4.5 13l3-3 2 2 1.5-1.8 3 3.8',
  import: 'M9 3.5v9 M5.5 9 9 12.5 12.5 9 M4 6V3.5h10V6 M4 11v4.5h10V11',
  review: 'M3.5 4.5h10v8h-6l-4 3.5z M6 7.5h5 M6 10h3',
  settings:
    'M8.5 2.8 9.8 5l2.5.5.3 2.5 2 1.6-1.2 2.2.7 2.4-2.3 1.2-2-1.5-2 .8-2-1.3-2.4.6-1.1-2.4 1.5-1.9-.9-2.3 2.1-1.5.4-2.5 2.5-.5z M8.5 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
  rename: 'M3.5 13.5h3.2l7-7a1.6 1.6 0 0 0-2.2-2.2l-7 7z M10.8 5.2l2 2',
  delete: 'M4.5 5h9 M7 5V3.5h4V5 M6 7v8h6V7 M8 8.5v4 M10.5 8.5v4',
  clearChat: 'M3.5 4.5h10v7h-5l-4 3.5v-3.5h-1z M6 7.5h5 M6 9.8h3.5 M12.5 3.5l2 2 M14.5 3.5l-2 2',
  collapse: 'M6.5 4.5 10.5 8.5l-4 4',
  expand: 'M10.5 4.5 6.5 8.5l4 4',
  close: 'M4.5 4.5 12.5 12.5 M12.5 4.5 4.5 12.5',
};

function WritingIcon({ name }: { name: WritingIconName }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 17 17"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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

function WritingFormatBar({
  editor,
  saveStatus,
  saveTooltip,
  reviewStatus,
  reviewStatusText,
  onSave,
  onExport,
  onReview,
  onSettings,
  reviewBusy,
  exportMenuOpen,
  children,
}: {
  editor: Editor | null;
  saveStatus: SaveStatus;
  saveTooltip: string;
  reviewStatus: ReviewStatus;
  reviewStatusText: string;
  onSave: () => void;
  onExport: () => void;
  onReview: () => void;
  onSettings: () => void;
  reviewBusy: boolean;
  exportMenuOpen: boolean;
  children?: ReactNode;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  if (!editor) return null;
  const disabled = !editor;
  const openLinkEditor = () => {
    setLinkHref((editor.getAttributes('link').href as string | undefined) ?? '');
    setLinkOpen((open) => !open);
  };
  const applyLink = () => {
    const href = linkHref.trim();
    if (!href) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkOpen(false);
  };
  const insertImageFile = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    void fileToDataUrl(file).then((src) => {
      editor
        .chain()
        .focus()
        .setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') })
        .run();
    });
  };
  return (
    <div className="writing-studio-formatbar" aria-label="Markdown formatting" onMouseDown={(event) => event.preventDefault()}>
      <div className="writing-studio-format-group writing-studio-format-actions">
        <button
          className={`writing-studio-format-save is-${saveStatus}`}
          type="button"
          aria-label="Save document"
          title={saveTooltip}
          disabled={saveStatus === 'saving'}
          onMouseDown={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <WritingIcon name="save" />
        </button>
      </div>
      <div className="writing-studio-format-group writing-studio-format-actions">
        <button
          className="writing-studio-format-icon"
          type="button"
          aria-label="Export document"
          title="Export document"
          onMouseDown={(event) => {
            event.preventDefault();
            onExport();
          }}
        >
          <WritingIcon name="export" />
        </button>
        <button
          className={`writing-studio-format-icon ${reviewBusy ? 'is-running' : ''}`}
          type="button"
          aria-label="Review document"
          title={reviewBusy ? 'Reviewing document' : 'Review document'}
          aria-busy={reviewBusy}
          disabled={reviewBusy}
          onMouseDown={(event) => {
            event.preventDefault();
            onReview();
          }}
        >
          <WritingIcon name="review" />
        </button>
        {reviewStatusText ? <span className={`writing-studio-format-status is-${reviewStatus}`}>{reviewStatusText}</span> : null}
        <button
          className="writing-studio-format-icon"
          type="button"
          aria-label="Writing Studio settings"
          title="Settings"
          onMouseDown={(event) => {
            event.preventDefault();
            onSettings();
          }}
        >
          <WritingIcon name="settings" />
        </button>
        {exportMenuOpen ? children : null}
      </div>
      <div className="writing-studio-format-group">
        <FormatButton
          label="P"
          title="Paragraph"
          disabled={disabled}
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        />
        <FormatButton
          label="H1"
          title="Heading 1"
          disabled={disabled}
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <FormatButton
          label="H2"
          title="Heading 2"
          disabled={disabled}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <FormatButton
          label="H3"
          title="Heading 3"
          disabled={disabled}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
      </div>
      <div className="writing-studio-format-group">
        <FormatButton
          label="B"
          title="Bold"
          disabled={disabled}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <FormatButton
          label="I"
          title="Italic"
          disabled={disabled}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <FormatButton
          label="S"
          title="Strikethrough"
          disabled={disabled}
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <FormatButton
          label="`"
          title="Inline code"
          disabled={disabled}
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <FormatButton label="[]" title="Link" disabled={disabled} active={editor.isActive('link') || linkOpen} onClick={openLinkEditor} />
        <button
          className="writing-studio-format-icon"
          type="button"
          aria-label="Insert image"
          title="Insert image"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
            imageInputRef.current?.click();
          }}
        >
          <WritingIcon name="image" />
        </button>
        <input
          ref={imageInputRef}
          className="writing-studio-hidden-file"
          type="file"
          accept="image/*"
          aria-label="Image file"
          onChange={(event) => {
            insertImageFile(event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </div>
      <div className="writing-studio-format-group">
        <FormatButton
          label="•"
          title="Bulleted list"
          disabled={disabled}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <FormatButton
          label="1."
          title="Numbered list"
          disabled={disabled}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <FormatButton
          label="❝"
          title="Quote"
          disabled={disabled}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <FormatButton
          label="{ }"
          title="Code block"
          disabled={disabled}
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
      </div>
      <div className="writing-studio-format-group">
        <FormatButton
          label="HR"
          title="Horizontal rule"
          disabled={disabled}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>
      {linkOpen ? (
        <form
          className="writing-studio-link-popover"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <input
            value={linkHref}
            onChange={(event) => setLinkHref(event.target.value)}
            placeholder="https://..."
            aria-label="Link URL"
            autoFocus
          />
          <button type="submit">Apply</button>
          <button type="button" onClick={() => editor.chain().focus().unsetLink().run()}>
            Clear
          </button>
        </form>
      ) : null}
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unable to read image file.'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Unable to read image file.')));
    reader.readAsDataURL(file);
  });
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

function formatTime(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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

function modelSelectionValues(models: WritingModelInfo[]): Set<string> {
  const values = new Set<string>();
  for (const model of models) {
    values.add(model.id);
    values.add(modelSelectionValue(model, models));
    if (model.provider) values.add(`${model.provider}/${model.id}`);
  }
  return values;
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

function escapeMarkdownAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function markdownImageFromAttrs(attrs: Record<string, unknown> | undefined): string {
  const src = typeof attrs?.src === 'string' ? attrs.src.trim() : '';
  if (!src) return '';
  const alt = typeof attrs?.alt === 'string' ? escapeMarkdownText(attrs.alt) : '';
  const title = typeof attrs?.title === 'string' && attrs.title.trim() ? ` "${escapeMarkdownAttribute(attrs.title.trim())}"` : '';
  return `![${alt}](${src}${title})`;
}

function textFromNode(node: ReturnType<NonNullable<MarkdownEditor['getJSON']>>): string {
  if (node.type === 'image') return markdownImageFromAttrs(node.attrs);
  if (typeof node.text === 'string') {
    let text = escapeMarkdownText(node.text);
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') text = `**${text}**`;
      if (mark.type === 'italic') text = `_${text}_`;
      if (mark.type === 'strike') text = `~~${text}~~`;
      if (mark.type === 'code') text = `\`${text.replace(/`/g, '\\`')}\``;
      if (mark.type === 'link' && typeof mark.attrs?.href === 'string') text = `[${text}](${mark.attrs.href})`;
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
  if (node.type === 'image') return markdownImageFromAttrs(node.attrs);
  if (node.type === 'blockquote') return (node.content ?? []).map(markdownFromNode).join('\n').replace(/^/gm, '> ');
  if (node.type === 'bulletList')
    return (node.content ?? []).map((child) => `- ${markdownFromNode(child).replace(/\n/g, '\n  ')}`).join('\n');
  if (node.type === 'orderedList')
    return (node.content ?? []).map((child, index) => `${index + 1}. ${markdownFromNode(child).replace(/\n/g, '\n   ')}`).join('\n');
  if (node.type === 'listItem') return (node.content ?? []).map(markdownFromNode).filter(Boolean).join('\n');
  if (node.type === 'codeBlock')
    return `\`\`\`${typeof node.attrs?.language === 'string' ? node.attrs.language : ''}\n${textFromNode(node)}\n\`\`\``;
  if (node.type === 'horizontalRule') return '---';
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

function quoteCandidatesForAnnotation(annotation: Annotation): string[] {
  const raw = annotation.quote.trim();
  const withoutMarkdownHeading = raw.replace(/^#{1,6}\s+/, '').trim();
  return Array.from(new Set([raw, withoutMarkdownHeading].filter((quote) => quote.length > 0)));
}

function quoteForChat(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
}

function normalizeAnchorText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function editorTextIndex(editor: Editor): Array<{ text: string; from: number; to: number; start: number; end: number }> {
  const entries: Array<{ text: string; from: number; to: number; start: number; end: number }> = [];
  let offset = 0;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const text = node.text;
    entries.push({ text, from: pos, to: pos + text.length, start: offset, end: offset + text.length });
    offset += text.length;
    return true;
  });
  return entries;
}

function documentPositionForTextOffset(
  entries: Array<{ text: string; from: number; to: number; start: number; end: number }>,
  target: number,
): number | null {
  for (const entry of entries) {
    if (target <= entry.end) return entry.from + Math.max(0, Math.min(entry.text.length, target - entry.start));
  }
  return entries.at(-1)?.to ?? null;
}

function findAnnotationSelection(editor: Editor, annotation: Annotation): { from: number; to: number } | null {
  const quotes = quoteCandidatesForAnnotation(annotation);
  const textEntries = editorTextIndex(editor);
  const renderedText = textEntries.map((entry) => entry.text).join('');
  for (const quote of quotes) {
    const normalizedQuote = normalizeAnchorText(quote);
    const index = renderedText.indexOf(normalizedQuote);
    if (index < 0) continue;
    const from = documentPositionForTextOffset(textEntries, index);
    const to = documentPositionForTextOffset(textEntries, index + normalizedQuote.length);
    if (from !== null && to !== null && to > from) return { from, to };
  }
  const before = normalizeAnchorText(annotation.anchor?.before ?? '');
  const after = normalizeAnchorText(annotation.anchor?.after ?? '');
  if (before || after) {
    const beforeIndex = before ? renderedText.indexOf(before) : -1;
    const afterIndex = after ? renderedText.indexOf(after, Math.max(0, beforeIndex)) : -1;
    if ((before ? beforeIndex >= 0 : true) && (after ? afterIndex >= 0 : true)) {
      const start = before ? beforeIndex + before.length : Math.max(0, afterIndex - annotation.quote.length);
      const end = after ? afterIndex : Math.min(renderedText.length, start + annotation.quote.length);
      const from = documentPositionForTextOffset(textEntries, start);
      const to = documentPositionForTextOffset(textEntries, end);
      if (from !== null && to !== null && to > from) return { from, to };
    }
  }
  return null;
}

function scrollAnnotationIntoView(editor: Editor, annotation: Annotation): void {
  const selection = findAnnotationSelection(editor, annotation);
  if (!selection) return;
  const scrollContainer = editor.view.dom.closest('.writing-studio-main');
  if (!(scrollContainer instanceof HTMLElement)) return;
  try {
    const start = editor.view.coordsAtPos(selection.from);
    const end = editor.view.coordsAtPos(selection.to);
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetTop = Math.min(start.top, end.top);
    const offset = targetTop - containerRect.top - scrollContainer.clientHeight * 0.32;
    scrollContainer.scrollTo({ top: scrollContainer.scrollTop + offset, behavior: 'smooth' });
  } catch {
    const domAtPos = editor.view.domAtPos(selection.from);
    const element =
      domAtPos.node instanceof HTMLElement
        ? domAtPos.node
        : domAtPos.node.parentElement instanceof HTMLElement
          ? domAtPos.node.parentElement
          : null;
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

function emitDocumentSelected(documentId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(documentSelectedEventName, { detail: { documentId } }));
}

function buildDocumentTreeState(
  documents: DocumentSummary[],
  folders: string[],
  search: string,
  activeDocumentId: string,
): {
  filteredDocuments: DocumentSummary[];
  paths: string[];
  expandedPaths: string[];
  selectedPaths: string[];
  documentIdByPath: Map<string, string>;
  folderPathByPath: Map<string, string>;
} {
  const query = search.trim().toLowerCase();
  const filteredDocuments = documents.filter((doc) => {
    if (!query) return true;
    return `${doc.title} ${doc.fileName} ${doc.folderPath} ${documentTreePath(doc)}`.toLowerCase().includes(query);
  });
  const filteredFolders = folders.filter((folder) => !query || folder.toLowerCase().includes(query));
  const filePaths: string[] = [];
  const folderPaths = new Set<string>();
  const documentIdByPath = new Map<string, string>();
  const folderPathByPath = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const folder of filteredFolders) {
    const folderTreePath = `${folder.replace(/\/+$/, '')}/`;
    for (const folderPath of folderPathsFor(`${folderTreePath}placeholder.md`)) {
      folderPaths.add(folderPath);
      folderPathByPath.set(folderPath, folderPath.replace(/\/$/, ''));
    }
  }

  for (const doc of filteredDocuments) {
    const basePath = documentTreePath(doc);
    const count = (counts.get(basePath) ?? 0) + 1;
    counts.set(basePath, count);
    const treePath = count === 1 ? basePath : basePath.replace(/(\.[^/.]+)?$/, `-${count}$1`);
    for (const folderPath of folderPathsFor(treePath)) {
      folderPaths.add(folderPath);
      folderPathByPath.set(folderPath, folderPath.replace(/\/$/, ''));
    }
    filePaths.push(treePath);
    documentIdByPath.set(treePath, doc.id);
  }

  const activeDoc = filteredDocuments.find((doc) => doc.id === activeDocumentId);
  const activePath = activeDoc ? Array.from(documentIdByPath.entries()).find(([, id]) => id === activeDoc.id)?.[0] : undefined;
  return {
    filteredDocuments,
    paths: [...folderPaths, ...filePaths],
    expandedPaths: [...folderPaths],
    selectedPaths: activePath ? [activePath] : [],
    documentIdByPath,
    folderPathByPath,
  };
}

export function WritingStudioSidebar({ pa }: { pa: NativeExtensionClient }) {
  ensureWritingStudioStyle();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState('default');
  const [search, setSearch] = useState('');
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<DocumentActionMode>('idle');
  const [actionValue, setActionValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const documentIdByTreePathRef = useRef(new Map<string, string>());
  const folderPathByTreePathRef = useRef(new Map<string, string>());
  const previousActiveDocumentIdRef = useRef(activeDocumentId);

  const handleTreeSelectionChange = useCallback((paths: readonly string[]) => {
    setSelectedTreePath(paths[0] ?? null);
    setActionMode('idle');
    setActionValue('');
  }, []);

  const { model: documentTreeModel, resetTree: resetDocumentTree } = useWritingStudioFileTreeModel({
    search: false,
    useNativeContextMenu: false,
    dragAndDrop: false,
    onSelectionChange: handleTreeSelectionChange,
    unsafeCSS: `
      :host{
        --trees-bg-override:transparent;
        --trees-fg-override:rgb(var(--color-primary));
        --trees-fg-muted-override:rgb(var(--color-secondary));
        --trees-selected-bg-override:color-mix(in srgb,rgb(var(--color-accent)) 16%,transparent);
        --trees-border-color-override:transparent;
        --trees-padding-inline-override:0px;
        --trees-item-padding-x-override:0px;
        --trees-item-margin-x-override:0px;
        --trees-level-gap-override:2px;
        --trees-font-size-override:12px;
        --trees-item-height:24px;
        --trees-icon-width-override:13px;
        --trees-scrollbar-gutter-override:4px;
        color:rgb(var(--color-primary));
        background:transparent;
      }
      *,[data-type='tree'],[data-type='group'],[data-type='list'],[data-type='row']{background:transparent!important}
      button[data-type='item']{font-size:12px;color:rgb(var(--color-primary));padding-inline-start:0}
      button[data-type='item']:hover{background:rgb(var(--color-surface-hover))}
      button[data-type='item'][data-item-selected]{background:color-mix(in srgb,rgb(var(--color-accent)) 16%,transparent);color:rgb(var(--color-primary))}
      [data-item-section='icon']{color:rgb(var(--color-secondary))}
    `,
  });

  useEffect(() => {
    documentTreeModel.setIcons({ set: 'minimal', colored: false });
  }, [documentTreeModel]);

  const refreshDocuments = useCallback(
    async (nextActiveDocumentId?: string) => {
      const result = (await pa.extension.invoke('writingStudioListDocuments', {})) as {
        documents: DocumentSummary[];
        activeDocumentId?: string;
        folders?: string[];
      };
      setDocuments(result.documents ?? []);
      setFolders(result.folders ?? []);
      setActiveDocumentId(nextActiveDocumentId ?? result.activeDocumentId ?? 'default');
    },
    [pa],
  );

  useEffect(() => {
    refreshDocuments().catch((err: Error) => setError(err.message));
  }, [refreshDocuments]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ documentId?: string }>).detail;
      if (detail?.documentId) {
        setActiveDocumentId(detail.documentId);
        void refreshDocuments(detail.documentId).catch((err: Error) => setError(err.message));
      }
    };
    window.addEventListener(documentSelectedEventName, handler);
    return () => window.removeEventListener(documentSelectedEventName, handler);
  }, [refreshDocuments]);

  const documentTree = useMemo(() => buildDocumentTreeState(documents, folders, search, activeDocumentId), [activeDocumentId, documents, folders, search]);
  const activeTreePath = documentTree.selectedPaths[0] ?? null;

  useEffect(() => {
    documentIdByTreePathRef.current = documentTree.documentIdByPath;
    folderPathByTreePathRef.current = documentTree.folderPathByPath;
    const resetOptions = {
      initialExpandedPaths: documentTree.expandedPaths,
      initialSelectedPaths: documentTree.selectedPaths,
    };
    resetDocumentTree(documentTree.paths, resetOptions);
    const frame = window.requestAnimationFrame(() => {
      resetDocumentTree(documentTree.paths, resetOptions);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [documentTree, resetDocumentTree]);

  useEffect(() => {
    const selectionStillExists =
      selectedTreePath &&
      (documentTree.documentIdByPath.has(selectedTreePath) || documentTree.folderPathByPath.has(selectedTreePath));
    if (!selectionStillExists) setSelectedTreePath(activeTreePath);
  }, [activeTreePath, documentTree.documentIdByPath, documentTree.folderPathByPath, selectedTreePath]);

  useEffect(() => {
    if (previousActiveDocumentIdRef.current === activeDocumentId) return;
    previousActiveDocumentIdRef.current = activeDocumentId;
    setSelectedTreePath(activeTreePath);
  }, [activeDocumentId, activeTreePath]);

  const selectedDocument = useMemo(() => {
    const documentId = selectedTreePath ? documentIdByTreePathRef.current.get(selectedTreePath) : undefined;
    return documentId ? (documents.find((doc) => doc.id === documentId) ?? null) : null;
  }, [documents, selectedTreePath]);
  const selectedFolder = useMemo(
    () => (selectedTreePath ? (folderPathByTreePathRef.current.get(selectedTreePath) ?? null) : null),
    [selectedTreePath],
  );

  const openSelectedDocument = useCallback(() => {
    const documentId = selectedTreePath ? documentIdByTreePathRef.current.get(selectedTreePath) : undefined;
    if (!documentId) return;
    setActiveDocumentId(documentId);
    emitDocumentSelected(documentId);
  }, [selectedTreePath]);

  const openDocumentFromDoubleClick = useCallback(() => {
    openSelectedDocument();
  }, [openSelectedDocument]);

  const importDocument = useCallback(
    async (file: File) => {
      const text = await file.text();
      const next = (await pa.extension.invoke('writingStudioImportDocument', {
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        folderPath: selectedFolder ?? 'Imports',
        markdown: text,
      })) as StoredState;
      setDocuments(next.documents ?? []);
      setFolders(next.folders ?? []);
      const nextDocumentId = next.activeDocumentId ?? next.id ?? 'default';
      setActiveDocumentId(nextDocumentId);
      emitDocumentSelected(nextDocumentId);
    },
    [pa, selectedFolder],
  );

  const beginDocumentAction = useCallback(
    (mode: DocumentActionMode) => {
      setActionMode(mode);
      if (mode === 'new-document') setActionValue('untitled.md');
      else if (mode === 'new-folder') setActionValue('New Folder');
      else if (mode === 'rename-document') setActionValue(selectedDocument?.fileName ?? '');
      else if (mode === 'rename-folder') setActionValue(selectedFolder?.split('/').at(-1) ?? '');
      else setActionValue('');
    },
    [selectedDocument?.fileName, selectedFolder],
  );

  const runDocumentAction = useCallback(async () => {
    const value = actionValue.trim();
    try {
      setError(null);
      if (actionMode === 'new-document') {
        const folderPath = selectedFolder ?? selectedDocument?.folderPath ?? 'Drafts';
        const next = (await pa.extension.invoke('writingStudioCreateDocument', {
          title: value.replace(/\.[^.]+$/, '') || 'Untitled',
          fileName: value || 'untitled.md',
          folderPath,
        })) as StoredState;
        setDocuments(next.documents ?? []);
        setFolders(next.folders ?? []);
        const nextDocumentId = next.activeDocumentId ?? next.id ?? 'default';
        setActiveDocumentId(nextDocumentId);
        emitDocumentSelected(nextDocumentId);
      } else if (actionMode === 'new-folder') {
        const parent = selectedFolder ?? selectedDocument?.folderPath ?? 'Drafts';
        const folderPath = value.includes('/') ? value : `${parent}/${value || 'New Folder'}`;
        const index = (await pa.extension.invoke('writingStudioCreateFolder', { folderPath })) as {
          documents: DocumentSummary[];
          folders?: string[];
        };
        setDocuments(index.documents ?? []);
        setFolders(index.folders ?? []);
      } else if (actionMode === 'rename-document' && selectedDocument) {
        const next = (await pa.extension.invoke('writingStudioRenameDocument', {
          documentId: selectedDocument.id,
          fileName: value || selectedDocument.fileName,
        })) as StoredState;
        setDocuments(next.documents ?? []);
        setFolders(next.folders ?? []);
        if (selectedDocument.id === activeDocumentId) emitDocumentSelected(selectedDocument.id);
      } else if (actionMode === 'delete-document' && selectedDocument) {
        const next = (await pa.extension.invoke('writingStudioDeleteDocument', { documentId: selectedDocument.id })) as StoredState;
        setDocuments(next.documents ?? []);
        setFolders(next.folders ?? []);
        const nextDocumentId = next.activeDocumentId ?? next.id ?? 'default';
        setActiveDocumentId(nextDocumentId);
        emitDocumentSelected(nextDocumentId);
      } else if (actionMode === 'rename-folder' && selectedFolder) {
        const parentParts = selectedFolder.split('/').slice(0, -1);
        const nextFolderPath = value.includes('/') ? value : [...parentParts, value || 'Folder'].filter(Boolean).join('/');
        const index = (await pa.extension.invoke('writingStudioRenameFolder', { folderPath: selectedFolder, nextFolderPath })) as {
          documents: DocumentSummary[];
          folders?: string[];
        };
        setDocuments(index.documents ?? []);
        setFolders(index.folders ?? []);
      } else if (actionMode === 'delete-folder' && selectedFolder) {
        const index = (await pa.extension.invoke('writingStudioDeleteFolder', { folderPath: selectedFolder })) as {
          documents: DocumentSummary[];
          folders?: string[];
        };
        setDocuments(index.documents ?? []);
        setFolders(index.folders ?? []);
      }
      setActionMode('idle');
      setActionValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [actionMode, actionValue, activeDocumentId, pa, selectedDocument, selectedFolder]);

  const actionLabel =
    actionMode === 'rename-document' || actionMode === 'rename-folder'
      ? 'Rename'
      : actionMode === 'new-document' || actionMode === 'new-folder'
        ? 'Create'
        : '';
  const actionForm =
    actionMode === 'delete-document' || actionMode === 'delete-folder' ? (
      <div className="writing-studio-doc-form writing-studio-doc-inline-action is-danger">
        <span>Delete {actionMode === 'delete-document' ? selectedDocument?.fileName : `${selectedFolder}/`}?</span>
        <button className="is-danger" type="button" onClick={() => void runDocumentAction()}>
          Delete
        </button>
        <button type="button" onClick={() => beginDocumentAction('idle')}>
          Cancel
        </button>
      </div>
    ) : actionMode !== 'idle' ? (
      <div className="writing-studio-doc-form writing-studio-doc-inline-action">
        <input
          value={actionValue}
          onChange={(event) => setActionValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void runDocumentAction();
            if (event.key === 'Escape') beginDocumentAction('idle');
          }}
          aria-label={actionMode.includes('folder') ? 'Folder name' : 'Document file name'}
          placeholder={actionMode.includes('folder') ? 'Folder name' : 'filename.md'}
          autoFocus
        />
        <button type="button" onClick={() => void runDocumentAction()}>
          {actionLabel}
        </button>
        <button type="button" onClick={() => beginDocumentAction('idle')}>
          Cancel
        </button>
      </div>
    ) : null;

  return (
    <aside className="writing-studio-sidebar" aria-label="Writing Studio documents">
      <div className="writing-studio-sidebar-header">
        <span className="writing-studio-sidebar-title">Documents</span>
        <div className="writing-studio-sidebar-actions writing-studio-doc-import">
          <button
            className="writing-studio-icon-button"
            type="button"
            aria-label="Open selected document"
            data-tooltip="Open selected document"
            disabled={!selectedDocument}
            onClick={openSelectedDocument}
          >
            <WritingIcon name="open" />
          </button>
          <button className="writing-studio-icon-button" type="button" aria-label="New document" data-tooltip="New document" onClick={() => beginDocumentAction('new-document')}>
            <WritingIcon name="new" />
          </button>
          <button className="writing-studio-icon-button" type="button" aria-label="New folder" data-tooltip="New folder" onClick={() => beginDocumentAction('new-folder')}>
            <WritingIcon name="folderNew" />
          </button>
          <button
            className="writing-studio-icon-button"
            type="button"
            aria-label="Rename selected item"
            data-tooltip="Rename selected item"
            disabled={!selectedDocument && !selectedFolder}
            onClick={() => beginDocumentAction(selectedDocument ? 'rename-document' : 'rename-folder')}
          >
            <WritingIcon name="rename" />
          </button>
          <button
            className="writing-studio-icon-button"
            type="button"
            aria-label="Delete selected item"
            data-tooltip="Delete selected item"
            disabled={!selectedDocument && !selectedFolder}
            onClick={() => beginDocumentAction(selectedDocument ? 'delete-document' : 'delete-folder')}
          >
            <WritingIcon name="delete" />
          </button>
          <label className="writing-studio-icon-button" data-tooltip="Import markdown" aria-label="Import markdown">
            <WritingIcon name="import" />
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
        </div>
      </div>
      <input
        className="writing-studio-sidebar-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search documents..."
        aria-label="Search Writing Studio documents"
      />
      {actionForm}
      {error ? (
        <div className="writing-studio-doc-error" title={error} role="status">
          {error}
        </div>
      ) : null}
      <div className="writing-studio-doc-list" onDoubleClick={openDocumentFromDoubleClick}>
        {documentTree.filteredDocuments.length === 0 ? (
          <p className="writing-studio-doc-empty">No documents match that search.</p>
        ) : (
          <TreesFileTree className="writing-studio-doc-tree" model={documentTreeModel} />
        )}
      </div>
    </aside>
  );
}

export function WritingStudioPage({ pa }: { pa: NativeExtensionClient }) {
  ensureWritingStudioStyle();
  const [state, setState] = useState<StoredState | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState('default');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, setDocumentFolders] = useState<string[]>([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('idle');
  const [lastReviewCount, setLastReviewCount] = useState(0);
  const [reviewStartedAt, setReviewStartedAt] = useState<number | null>(null);
  const [reviewElapsedSeconds, setReviewElapsedSeconds] = useState(0);
  const [fileNameDraft, setFileNameDraft] = useState('');
  const [railWidth, setRailWidth] = useState(readRailWidth);
  const [currentModel, setCurrentModel] = useState(() => readStringSetting(modelStorageKey));
  const [settingsDraft, setSettingsDraft] = useState<WritingSettings>({
    reviewIntervalSeconds: 12,
    reviewPrompt: '',
    agentInstructions:
      'Keep the document in focus. Be useful, specific, and alive on the page. Prefer concrete edits, margin comments, and approved-edit suggestions over abstract writing advice. If you claim to edit, rewrite, or provide a final version of the document, update the canvas with writing_studio_update_canvas before you answer.',
  });
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const [chatDraftInsertion, setChatDraftInsertion] = useState<{ id: string; text: string } | null>(null);
  const [commentLayout, setCommentLayout] = useState<CommentLayout>({ railHeight: 0 });
  const [commentPositions, setCommentPositions] = useState<Record<string, number>>({});
  const [, setFormatStateVersion] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingEditorContent = useRef(false);
  const activeHighlightRef = useRef<AnnotationHighlight | null>(null);
  const editorFrameRef = useRef<HTMLDivElement>(null);
  const commentsRailRef = useRef<HTMLElement>(null);
  const commentCardRefs = useRef(new Map<string, HTMLElement>());
  const fileNameDraftRef = useRef('');
  const dismissedSelectionTextRef = useRef('');
  const activeDocumentIdRef = useRef(activeDocumentId);

  const updateFileNameDraft = useCallback((value: string) => {
    fileNameDraftRef.current = value;
    setFileNameDraft(value);
  }, []);

  useEffect(() => {
    activeDocumentIdRef.current = activeDocumentId;
  }, [activeDocumentId]);

  useEffect(() => {
    return () => {
      if (reviewStatusTimer.current) clearTimeout(reviewStatusTimer.current);
    };
  }, []);

  useEffect(() => {
    if (reviewStatus !== 'running' || reviewStartedAt === null) return;
    setReviewElapsedSeconds(Math.max(0, Math.floor((Date.now() - reviewStartedAt) / 1000)));
    const timer = window.setInterval(() => {
      setReviewElapsedSeconds(Math.max(0, Math.floor((Date.now() - reviewStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [reviewStartedAt, reviewStatus]);

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
        setCurrentModel((current) => {
          const stored = current || readStringSetting(modelStorageKey);
          const availableValues = modelSelectionValues(nextModels);
          const hostCurrent = result.currentModel && availableValues.has(result.currentModel) ? result.currentModel : '';
          const fallback = hostCurrent || (nextModels[0] ? modelSelectionValue(nextModels[0], nextModels) : '');
          const next = stored && availableValues.has(stored) ? stored : fallback;
          writeStringSetting(modelStorageKey, next);
          return next;
        });
      })
      .catch(() => undefined);
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

  const persistUpdate = useCallback(
    (update: Uint8Array, nextMarkdown: string) => {
      setSaveStatus('unsaved');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setSaveStatus('saving');
        void pa.extension
          .invoke('writingStudioAppendUpdate', {
            updateBase64: bytesToBase64(update),
            markdown: nextMarkdown,
            actorId,
            documentId: activeDocumentId,
          })
          .then(() => {
            setSaveStatus('saved');
            setLastSavedAt(new Date().toISOString());
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
    extensions: [
      StarterKit.configure({ link: false }),
      Image.configure({ allowBase64: true, inline: false }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: false }),
      createAnnotationHighlightExtension(activeHighlightRef),
    ],
    content: markdown,
    editorProps: {
      attributes: {
        class: 'writing-studio-editor',
        'aria-label': 'Writing document',
      },
      handlePaste: (_view, event) => {
        const image = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
        if (!image) return false;
        event.preventDefault();
        void fileToDataUrl(image).then((src) =>
          editor
            ?.chain()
            .focus()
            .setImage({ src, alt: image.name.replace(/\.[^.]+$/, '') })
            .run(),
        );
        return true;
      },
      handleDrop: (_view, event) => {
        const image = Array.from(event.dataTransfer?.files ?? []).find((file) => file.type.startsWith('image/'));
        if (!image) return false;
        event.preventDefault();
        void fileToDataUrl(image).then((src) =>
          editor
            ?.chain()
            .focus()
            .setImage({ src, alt: image.name.replace(/\.[^.]+$/, '') })
            .run(),
        );
        return true;
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      if (applyingEditorContent.current) return;
      setFormatStateVersion((version) => version + 1);
      const nextMarkdown = readMarkdownFromEditor(nextEditor);
      setMarkdown(nextMarkdown);
      replaceMarkdown(nextMarkdown);
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
      reviewTimer.current = setTimeout(
        () => {
          void runReview('periodic');
        },
        Math.max(3, state?.settings.reviewIntervalSeconds ?? 12) * 1000,
      );
    },
  });

  const updateSelectionMenu = useCallback(() => {
    if (!editor) {
      setSelectionMenu(null);
      return;
    }
    const frame = editor.view.dom.closest('.writing-studio-editor-frame')?.getBoundingClientRect();
    if (!frame) {
      setSelectionMenu(null);
      return;
    }

    const { from, to, empty } = editor.state.selection;
    let text = empty || to <= from ? '' : editor.state.doc.textBetween(from, to, '\n').trim();
    let rect: DOMRect | null = null;

    if (text) {
      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        rect = {
          left: Math.min(start.left, end.left),
          right: Math.max(start.right, end.right),
          top: Math.min(start.top, end.top),
          bottom: Math.max(start.bottom, end.bottom),
          width: Math.abs(end.right - start.left),
          height: Math.abs(end.bottom - start.top),
          x: Math.min(start.left, end.left),
          y: Math.min(start.top, end.top),
          toJSON: () => ({}),
        } as DOMRect;
      } catch {
        rect = null;
      }
    }

    if (!text) {
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const anchor = selection?.anchorNode instanceof Node ? selection.anchorNode : null;
      if (!selection || selection.isCollapsed || !range || !anchor || !editor.view.dom.contains(anchor)) {
        setSelectionMenu(null);
        return;
      }
      text = selection.toString().trim();
      rect = range.getBoundingClientRect();
    }

    if (!text || text === dismissedSelectionTextRef.current || !rect || rect.width === 0 || rect.height === 0) {
      setSelectionMenu(null);
      return;
    }

    const left = Math.min(Math.max(rect.left + rect.width / 2 - frame.left, 5), frame.width - 5);
    const top = rect.top - frame.top > 56 ? rect.top - frame.top - 42 : rect.bottom - frame.top + 8;
    setSelectionMenu({ text, left, top });
  }, [editor]);

  const clearSelectionMenu = useCallback(() => {
    dismissedSelectionTextRef.current = selectionMenu?.text.trim() ?? '';
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
    if (editor && !editor.state.selection.empty) editor.commands.setTextSelection(editor.state.selection.to);
  }, [editor, selectionMenu?.text]);

  useEffect(() => {
    if (!editor) return;
    const refreshFormatState = () => {
      setFormatStateVersion((version) => version + 1);
      window.setTimeout(updateSelectionMenu, 0);
    };
    editor.on('selectionUpdate', refreshFormatState);
    editor.on('transaction', refreshFormatState);
    return () => {
      editor.off('selectionUpdate', refreshFormatState);
      editor.off('transaction', refreshFormatState);
    };
  }, [editor, updateSelectionMenu]);

  const syncEditorMarkdown = useCallback(() => {
    if (!editor || applyingEditorContent.current) return markdown;
    const editorElement = (editor as unknown as { view?: { dom?: HTMLElement } }).view?.dom;
    const nextMarkdown = readMarkdownFromEditor(editor) || markdownFromEditorElement(editorElement);
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

  const load = useCallback(
    async (documentId?: string) => {
      const next = (await pa.extension.invoke('writingStudioLoad', documentId ? { documentId } : {})) as StoredState;
      setState(next);
      setDocuments(next.documents ?? []);
      setDocumentFolders(next.folders ?? []);
      setActiveDocumentId(next.activeDocumentId ?? next.id ?? documentId ?? 'default');
      setSettingsDraft(next.settings);
      setSaveStatus('saved');
      const activeDoc = (next.documents ?? []).find((doc) => doc.id === (next.activeDocumentId ?? next.id ?? documentId));
      updateFileNameDraft(activeDoc?.fileName ?? next.fileName ?? '');
      setLastSavedAt(activeDoc?.updatedAt ?? new Date().toISOString());
      setActiveAnnotationId(null);
      setMarkdown(next.markdown);
      setMarkdownSilently(next.markdown);
      if (editor) {
        applyingEditorContent.current = true;
        editor.commands.setContent(next.markdown, { contentType: 'markdown' });
        setTimeout(() => {
          applyingEditorContent.current = false;
        }, 250);
      }
    },
    [editor, pa, setMarkdownSilently, updateFileNameDraft],
  );

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ documentId?: string }>).detail;
      if (detail?.documentId) void load(detail.documentId).catch((err: Error) => setError(err.message));
    };
    window.addEventListener(documentSelectedEventName, handler);
    return () => window.removeEventListener(documentSelectedEventName, handler);
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

  useEffect(() => {
    if (!editor) return;
    const openAnnotations = (state?.annotations ?? []).filter((annotation) => annotation.status === 'open');
    const activeAnnotation = openAnnotations.find((annotation) => annotation.id === activeAnnotationId);
    const selection = activeAnnotation ? findAnnotationSelection(editor, activeAnnotation) : null;
    activeHighlightRef.current =
      activeAnnotation && selection
        ? { id: activeAnnotation.id, kind: activeAnnotation.kind, from: selection.from, to: selection.to }
        : null;
    editor.view.dispatch(editor.state.tr.setMeta(annotationHighlightPluginKey, true));
  }, [activeAnnotationId, editor, markdown, state?.annotations]);

  const updateCommentLayout = useCallback(() => {
    if (!editor) return;
    const editorFrame = editorFrameRef.current;
    if (!editorFrame) return;
    const openAnnotations = (state?.annotations ?? []).filter((annotation) => annotation.status === 'open');
    if (openAnnotations.length === 0) {
      setCommentPositions({});
      setCommentLayout({ railHeight: 0 });
      return;
    }

    const frameRect = editorFrame.getBoundingClientRect();
    const positioned = openAnnotations.map((annotation, index) => {
      let top = index * 132;
      const selection = findAnnotationSelection(editor, annotation);
      if (selection) {
        try {
          const start = editor.view.coordsAtPos(selection.from);
          const end = editor.view.coordsAtPos(selection.to);
          top = Math.max(0, Math.min(start.top, end.top) - frameRect.top);
        } catch {
          top = index * 132;
        }
      }
      return { annotation, top, index };
    });

    positioned.sort((a, b) => a.top - b.top || a.index - b.index);

    const nextPositions: Record<string, number> = {};
    let bottom = 0;
    for (const item of positioned) {
      const cardHeight = commentCardRefs.current.get(item.annotation.id)?.offsetHeight ?? 116;
      const top = Math.max(item.top, bottom);
      nextPositions[item.annotation.id] = top;
      bottom = top + cardHeight + 10;
    }

    setCommentPositions((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextPositions);
      if (currentKeys.length === nextKeys.length && nextKeys.every((key) => Math.abs((current[key] ?? -1) - nextPositions[key]) < 0.5)) {
        return current;
      }
      return nextPositions;
    });
    setCommentLayout((current) => {
      const railHeight = Math.max(bottom, editorFrame.offsetHeight, 0);
      return Math.abs(current.railHeight - railHeight) < 0.5 ? current : { railHeight };
    });
  }, [editor, state?.annotations]);

  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateCommentLayout);
    };
    schedule();
    editor.on('update', schedule);
    editor.on('transaction', schedule);
    window.addEventListener('resize', schedule);
    const resizeObserver = new ResizeObserver(schedule);
    if (editorFrameRef.current) resizeObserver.observe(editorFrameRef.current);
    for (const card of commentCardRefs.current.values()) resizeObserver.observe(card);
    return () => {
      window.cancelAnimationFrame(frame);
      editor.off('update', schedule);
      editor.off('transaction', schedule);
      window.removeEventListener('resize', schedule);
      resizeObserver.disconnect();
    };
  }, [editor, state?.annotations, updateCommentLayout]);

  const runReview = useCallback(
    async (trigger: string, options?: { reviewPrompt?: string }) => {
      setBusy('review');
      setReviewStatus('running');
      setReviewStartedAt(Date.now());
      setReviewElapsedSeconds(0);
      setError(null);
      if (reviewStatusTimer.current) clearTimeout(reviewStatusTimer.current);
      try {
        const currentMarkdown = syncEditorMarkdown() ?? markdown;
        const result = (await withTimeout(
          pa.extension.invoke('writingStudioRunReview', {
            markdown: currentMarkdown,
            trigger,
            documentId: activeDocumentId,
            modelRef: currentModel || undefined,
            reviewPrompt: options?.reviewPrompt,
          }) as Promise<{ annotations: Annotation[] }>,
          65_000,
          'Writing Studio review timed out before the agent returned comments.',
        )) as { annotations: Annotation[] };
        if (result.annotations.length === 0) throw new Error('Writing Studio review returned no comments.');
        const currentQuotes = result.annotations.map((annotation) => annotation.quote);
        setState((current) =>
          current
            ? {
                ...current,
                annotations: [
                  ...result.annotations,
                  ...current.annotations.filter(
                    (annotation) =>
                      annotation.status !== 'open' ||
                      (annotation.quote && currentMarkdown.includes(annotation.quote) && !currentQuotes.includes(annotation.quote)),
                  ),
                ],
                lastAgentRunAt: new Date().toISOString(),
              }
            : current,
        );
        setActiveAnnotationId(result.annotations[0]?.id ?? null);
        setLastReviewCount(result.annotations.length);
        setReviewStatus('complete');
        setReviewStartedAt(null);
      } catch (err) {
        setReviewStatus('error');
        setReviewStartedAt(null);
        reviewStatusTimer.current = setTimeout(() => setReviewStatus('idle'), 5000);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [activeDocumentId, currentModel, editor, markdown, pa, syncEditorMarkdown],
  );

  const ensureChatSession = useCallback(async () => {
    const result = (await pa.extension.invoke('writingStudioEnsureChatSession', {
      documentId: activeDocumentId,
      modelRef: currentModel || undefined,
    })) as { conversationId: string };
    setState((current) => (current ? { ...current, chatConversationId: result.conversationId } : current));
    return result.conversationId;
  }, [activeDocumentId, currentModel, pa]);

  const handleChatModelChange = useCallback((modelId: string) => {
    if (!modelId) return;
    writeStringSetting(modelStorageKey, modelId);
    setCurrentModel(modelId);
  }, []);

  const refreshDocumentAfterChatTurn = useCallback(async () => {
    await load(activeDocumentIdRef.current);
  }, [load]);

  const clearChat = useCallback(async () => {
    setBusy('clear-chat');
    setError(null);
    try {
      const result = (await pa.extension.invoke('writingStudioClearChat', {
        documentId: activeDocumentId,
        modelRef: currentModel || undefined,
      })) as { messages: ChatMessage[]; conversationId: string };
      setState((current) => (current ? { ...current, chat: result.messages, chatConversationId: result.conversationId } : current));
      setChatDraftInsertion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy((current) => (current === 'clear-chat' ? null : current));
    }
  }, [activeDocumentId, currentModel, pa]);

  useEffect(() => {
    if (!state || state.chatConversationId) return;
    let cancelled = false;
    ensureChatSession()
      .then((conversationId) => {
        if (cancelled) return;
        setState((current) => (current ? { ...current, chatConversationId: conversationId } : current));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [ensureChatSession, state?.chatConversationId, state?.id]);

  const getChatContextMessages = useCallback(
    async () => {
      const currentMarkdown = syncEditorMarkdown() ?? markdown;
      const openAnnotations = (state?.annotations ?? [])
        .filter((annotation) => annotation.status === 'open')
        .slice(0, 16)
        .map((annotation) => {
          const replacement = annotation.suggestedReplacement ? ` Suggested replacement: "${annotation.suggestedReplacement}"` : '';
          return `- ${annotation.kind} (${annotation.id}): "${annotation.quote}" — ${annotation.body}${replacement}`;
        })
        .join('\n');
      return [
        {
          customType: 'writing_studio_context',
          content: [
            'Writing Studio context for this turn.',
            `Document id: ${activeDocumentId}`,
            `File: ${state?.fileName ?? 'untitled.md'}`,
            '',
            'Agent instructions:',
            state?.settings.agentInstructions ?? '',
            '',
            'Current markdown:',
            currentMarkdown,
            '',
            'Open comments:',
            openAnnotations || '(none)',
            '',
            'Use Writing Studio tools when the user asks to edit the canvas, add/update/dismiss comments, apply approved edits, review the draft, or update your Writing Studio instructions.',
            'If you rewrite text, provide a final edited document, say you made edits, or resolve comments by changing prose, you must call writing_studio_update_canvas with the full updated markdown before your final answer. Do not present edited markdown only in chat when the user asked for document edits.',
          ].join('\n'),
        },
      ];
    },
    [activeDocumentId, markdown, state?.annotations, state?.fileName, state?.settings.agentInstructions, syncEditorMarkdown],
  );

  const selectAnnotation = useCallback(
    (annotation: Annotation) => {
      setActiveAnnotationId(annotation.id);
      if (editor) scrollAnnotationIntoView(editor, annotation);
    },
    [editor],
  );

  const discussAnnotation = useCallback((annotation: Annotation) => {
    const lines = ['Can we discuss this annotation?', '', quoteForChat(annotation.quote), '', `${annotation.kind}: ${annotation.body}`];
    setChatDraftInsertion({ id: `annotation-${annotation.id}-${Date.now()}`, text: lines.join('\n') });
  }, []);

  const sendSelectionToChat = useCallback(
    (intent: 'discuss' | 'enhance') => {
      const text = selectionMenu?.text.trim();
      if (!text) return;
      clearSelectionMenu();
      const prompt =
        intent === 'enhance'
          ? 'Can you suggest a stronger version of this passage? Preserve my voice, then explain the tradeoffs.'
          : 'Can we discuss this passage?';
      setChatDraftInsertion({ id: `selection-${intent}-${Date.now()}`, text: [prompt, '', quoteForChat(text)].join('\n') });
    },
    [clearSelectionMenu, selectionMenu?.text],
  );

  const reviewSelection = useCallback(() => {
    const text = selectionMenu?.text.trim();
    if (!text) return;
    clearSelectionMenu();
    setBusy('review');
    setReviewStatus('running');
    setReviewStartedAt(Date.now());
    setReviewElapsedSeconds(0);
    setError(null);
    if (reviewStatusTimer.current) clearTimeout(reviewStatusTimer.current);
    const currentMarkdown = syncEditorMarkdown() ?? markdown;
    void pa.extension
      .invoke('writingStudioReviewSelection', {
        markdown: currentMarkdown,
        selectedText: text,
        documentId: activeDocumentId,
        modelRef: currentModel || undefined,
      })
      .then((result) => {
        const annotations = (result as { annotations?: Annotation[] }).annotations ?? [];
        if (annotations.length === 0) throw new Error('Writing Studio selected-text review returned no comments.');
        setState((current) =>
          current
            ? {
                ...current,
                annotations: [...annotations, ...current.annotations.filter((annotation) => !annotations.some((next) => next.quote === annotation.quote))],
                lastAgentRunAt: new Date().toISOString(),
              }
            : current,
        );
        setActiveAnnotationId(annotations[0]?.id ?? null);
        setLastReviewCount(annotations.length);
        setReviewStatus('complete');
        setReviewStartedAt(null);
      })
      .catch((err) => {
        setReviewStatus('error');
        setReviewStartedAt(null);
        reviewStatusTimer.current = setTimeout(() => setReviewStatus('idle'), 5000);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setBusy(null);
      });
  }, [activeDocumentId, clearSelectionMenu, currentModel, markdown, pa, selectionMenu?.text, syncEditorMarkdown]);

  const resolveAnnotation = useCallback(
    async (id: string) => {
      const result = (await pa.extension.invoke('writingStudioResolveAnnotation', { id, documentId: activeDocumentId })) as {
        annotations: Annotation[];
      };
      setState((current) => (current ? { ...current, annotations: result.annotations } : current));
      setActiveAnnotationId((current) => (current === id ? null : current));
    },
    [activeDocumentId, pa],
  );

  const applyAnnotationEdit = useCallback(
    async (annotation: Annotation) => {
      if (!annotation.suggestedReplacement?.trim()) return;
      setBusy('apply-annotation');
      try {
        const next = (await pa.extension.invoke('writingStudioApplyAnnotationEdit', {
          id: annotation.id,
          documentId: activeDocumentId,
        })) as StoredState;
        setState(next);
        setDocuments(next.documents ?? []);
        setDocumentFolders(next.folders ?? []);
        setActiveDocumentId(next.activeDocumentId ?? next.id ?? activeDocumentId);
        setActiveAnnotationId(null);
        setMarkdown(next.markdown);
        setMarkdownSilently(next.markdown);
        setSaveStatus('saved');
        setLastSavedAt(new Date().toISOString());
        if (editor) {
          applyingEditorContent.current = true;
          editor.commands.setContent(next.markdown, { contentType: 'markdown' });
          setTimeout(() => {
            applyingEditorContent.current = false;
          }, 250);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [activeDocumentId, editor, pa, setMarkdownSilently],
  );

  const saveSettings = useCallback(async () => {
    setBusy('settings');
    try {
      const result = (await pa.extension.invoke('writingStudioSaveSettings', { ...settingsDraft, documentId: activeDocumentId })) as {
        settings: WritingSettings;
      };
      setSettingsDraft(result.settings);
      setState((current) => (current ? { ...current, settings: result.settings } : current));
      setSettingsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [activeDocumentId, pa, settingsDraft]);

  const saveDocument = useCallback(
    async (nextFileName?: string) => {
      setSaveStatus('saving');
      const currentMarkdown = syncEditorMarkdown() ?? markdown;
      const fileName = nextFileName ?? fileNameDraftRef.current ?? fileNameDraft;
      try {
        const result = (await pa.extension.invoke('writingStudioSaveDocument', {
          documentId: activeDocumentId,
          markdown: currentMarkdown,
          fileName,
        })) as {
          document: DocumentSummary;
        };
        setDocuments((current) => [result.document, ...current.filter((doc) => doc.id !== result.document.id)]);
        setState((current) =>
          current
            ? { ...current, fileName: result.document.fileName, folderPath: result.document.folderPath, title: result.document.title }
            : current,
        );
        updateFileNameDraft(result.document.fileName);
        setSaveStatus('saved');
        setLastSavedAt(result.document.updatedAt ?? new Date().toISOString());
      } catch (err) {
        setSaveStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [activeDocumentId, fileNameDraft, markdown, pa, syncEditorMarkdown, updateFileNameDraft],
  );

  const exportDocument = useCallback(
    async (format: 'markdown' | 'html' | 'rtf' | 'docx') => {
      syncEditorMarkdown();
      await saveDocument();
      const result = (await pa.extension.invoke('writingStudioExportDocument', { documentId: activeDocumentId, format })) as {
        fileName: string;
        mimeType: string;
        content: string;
        encoding: 'text' | 'base64';
      };
      downloadFile(result.fileName, result.mimeType, result.encoding === 'base64' ? base64ToBytes(result.content) : result.content);
    },
    [activeDocumentId, pa, saveDocument, syncEditorMarkdown],
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
  const chatConversationId = state?.chatConversationId ?? null;
  const saveTooltip =
    saveStatus === 'saved'
      ? `Saved${lastSavedAt ? ` at ${formatTime(lastSavedAt)}` : ''}`
      : saveStatus === 'saving'
        ? 'Saving...'
        : saveStatus === 'unsaved'
          ? `Unsaved changes${lastSavedAt ? ` · Last saved ${formatTime(lastSavedAt)}` : ''}`
          : `Save failed${lastSavedAt ? ` · Last saved ${formatTime(lastSavedAt)}` : ''}`;
  const reviewStatusText =
    reviewStatus === 'running'
      ? `Reviewing ${reviewElapsedSeconds}s`
      : reviewStatus === 'complete'
        ? `Reviewed ${lastReviewCount}`
        : reviewStatus === 'error'
          ? 'Review failed'
          : '';
  const layoutStyle = { '--writing-studio-rail-width': `${railWidth}px` } as CSSProperties;

  return (
    <main className={`writing-studio ${railCollapsed ? 'has-collapsed-rail' : ''}`} style={layoutStyle}>
      <section className="writing-studio-main">
        <div className="writing-studio-filebar">
          <input
            className="writing-studio-file-name"
            value={fileNameDraft}
            onChange={(event) => {
              updateFileNameDraft(event.target.value);
              setSaveStatus('unsaved');
            }}
            onBlur={(event) => {
              const nextFileName = event.currentTarget.value;
              if (nextFileName.trim()) void saveDocument(nextFileName);
              else updateFileNameDraft(state?.fileName ?? 'draft.md');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (event.currentTarget.value.trim()) void saveDocument(event.currentTarget.value);
                event.currentTarget.blur();
              }
            }}
            placeholder="filename.md"
            aria-label="File name"
            spellCheck={false}
          />
        </div>
        {error ? <div className="writing-studio-inline-error">{error}</div> : null}
        <WritingFormatBar
          editor={editor}
          saveStatus={saveStatus}
          saveTooltip={saveTooltip}
          reviewStatus={reviewStatus}
          reviewStatusText={reviewStatusText}
          onSave={() => void saveDocument()}
          onExport={() => setExportMenuOpen((open) => !open)}
          onReview={() => void runReview('manual')}
          onSettings={() => setSettingsOpen(true)}
          reviewBusy={busy === 'review'}
          exportMenuOpen={exportMenuOpen}
        >
          <div className="writing-studio-export-menu">
            {(['markdown', 'html', 'rtf', 'docx'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setExportMenuOpen(false);
                  void exportDocument(format);
                }}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </WritingFormatBar>
        <div className="writing-studio-canvas">
          <div
            ref={editorFrameRef}
            className="writing-studio-editor-frame"
            onMouseUp={() => {
              dismissedSelectionTextRef.current = '';
              window.setTimeout(updateSelectionMenu, 0);
            }}
            onKeyUp={() => {
              dismissedSelectionTextRef.current = '';
              window.setTimeout(updateSelectionMenu, 0);
            }}
          >
            {selectionMenu ? (
              <div
                className="writing-studio-selection-menu"
                style={{ left: selectionMenu.left, top: selectionMenu.top }}
                role="menu"
                aria-label="Selected text actions"
                onMouseDown={(event) => event.preventDefault()}
                onMouseUp={(event) => event.stopPropagation()}
              >
                <button type="button" role="menuitem" onClick={() => sendSelectionToChat('discuss')}>
                  Discuss
                </button>
                <button type="button" role="menuitem" onClick={reviewSelection}>
                  Review
                </button>
                <button type="button" role="menuitem" onClick={() => sendSelectionToChat('enhance')}>
                  Improve
                </button>
              </div>
            ) : null}
            <EditorContent editor={editor} />
          </div>
          <aside
            ref={commentsRailRef}
            className="writing-studio-comments"
            aria-label="Document comments"
            style={openAnnotations.length > 0 ? { minHeight: Math.max(commentLayout.railHeight, 0) } : undefined}
          >
            {openAnnotations.length === 0 ? (
              <p className="writing-studio-comment-empty">Comments will appear beside the draft as the agent reads.</p>
            ) : (
              openAnnotations.map((annotation) => (
                <article
                  key={annotation.id}
                  ref={(node) => {
                    if (node) {
                      commentCardRefs.current.set(annotation.id, node);
                    } else {
                      commentCardRefs.current.delete(annotation.id);
                    }
                  }}
                  className={`writing-studio-comment is-${annotation.kind} ${activeAnnotationId === annotation.id ? 'is-active' : ''}`}
                  data-annotation-quote={annotation.quote}
                  style={{ top: commentPositions[annotation.id] ?? 0 }}
                  onClick={() => selectAnnotation(annotation)}
                >
                  <div className="writing-studio-comment-top">
                    <span className="writing-studio-comment-kind">{annotation.emoji ?? annotation.kind}</span>
                    <div className="writing-studio-comment-actions">
                      <button
                        className="writing-studio-comment-discuss"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectAnnotation(annotation);
                          discussAnnotation(annotation);
                        }}
                      >
                        Discuss
                      </button>
                      <button
                        className="writing-studio-comment-close"
                        type="button"
                        aria-label="Resolve annotation"
                        title="Resolve annotation"
                        onClick={(event) => {
                          event.stopPropagation();
                          void resolveAnnotation(annotation.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <p>{annotation.body}</p>
                  {annotation.suggestedReplacement?.trim() ? (
                    <div className="writing-studio-suggested-edit">
                      <pre>{annotation.suggestedReplacement}</pre>
                      <button
                        className="writing-studio-apply-edit"
                        type="button"
                        disabled={busy === 'apply-annotation'}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectAnnotation(annotation);
                          void applyAnnotationEdit(annotation);
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  ) : null}
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
          {!railCollapsed && (
            <div className="writing-studio-rail-heading">
              <span className="writing-studio-rail-title">Chat</span>
              {reviewStatusText ? <span className={`writing-studio-review-status is-${reviewStatus}`}>{reviewStatusText}</span> : null}
            </div>
          )}
          <div className="writing-studio-rail-tools">
            <button
              className="writing-studio-icon-button"
              type="button"
              aria-label="Start new chat"
              data-tooltip="Start new chat"
              disabled={busy === 'clear-chat' || !chatConversationId}
              onClick={() => void clearChat()}
            >
              <WritingIcon name="clearChat" />
            </button>
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
          <ExtensionChatRail
            conversationId={chatConversationId}
            workspaceCwd={null}
            className="writing-studio-extension-chat"
            emptyState={<p className="writing-studio-muted">Ask for help with the draft, or ask the agent to add comments to the canvas.</p>}
            externalDraft={chatDraftInsertion}
            getContextMessages={getChatContextMessages}
            onModelChange={handleChatModelChange}
            onTurnComplete={refreshDocumentAfterChatTurn}
            onError={setError}
          />
        </section>
      </aside>

      {settingsOpen && (
        <div
          className="writing-studio-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Writing Studio settings"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <div className="writing-studio-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="writing-studio-modal-header">
              <h2>Writing Studio settings</h2>
              <button
                className="writing-studio-icon-button"
                type="button"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
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
                    setSettingsDraft((draft) => ({
                      ...draft,
                      reviewIntervalSeconds: Number(event.target.value) || draft.reviewIntervalSeconds,
                    }))
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
              <div className="writing-studio-field">
                <label htmlFor="writing-studio-agent-instructions">Agent instructions</label>
                <textarea
                  id="writing-studio-agent-instructions"
                  value={settingsDraft.agentInstructions}
                  onChange={(event) => setSettingsDraft((draft) => ({ ...draft, agentInstructions: event.target.value }))}
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
