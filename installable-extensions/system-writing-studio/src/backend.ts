import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { runAgentTask } from '@neon-pilot/extensions/backend/agent';
import * as Y from 'yjs';

type EventType =
  | 'yjs_update'
  | 'annotation_added'
  | 'annotation_updated'
  | 'annotation_resolved'
  | 'chat_message'
  | 'chat_cleared'
  | 'settings_updated'
  | 'agent_run_started'
  | 'agent_run_completed';
type AnnotationKind = 'comment' | 'suggestion' | 'reaction' | 'warning';

export interface AnnotationAnchor {
  before: string;
  after: string;
}

export interface WritingEvent {
  id: string;
  type: EventType;
  timestamp: string;
  actorId: string;
  payload: Record<string, unknown>;
}

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  body: string;
  emoji?: string;
  suggestedReplacement?: string;
  quote: string;
  anchor?: AnnotationAnchor;
  from: number;
  to: number;
  status: 'open' | 'resolved';
  createdAt: string;
  agentRunId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  body: string;
  createdAt: string;
}

export interface WritingSettings {
  reviewIntervalSeconds: number;
  reviewPrompt: string;
  agentInstructions: string;
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
  reviewCursorChunk?: number;
  settings: WritingSettings;
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

interface DocumentIndex {
  activeDocumentId: string;
  documents: DocumentSummary[];
  folders: string[];
}

type ExportFormat = 'markdown' | 'html' | 'rtf' | 'docx';

const DEFAULT_DOCUMENT_ID = 'default';
const INDEX_KEY = 'documents/index';
const legacyStateKey = 'documents/default';
const documentKey = (id: string) => `documents/by-id/${id}`;

const seedMarkdown = `# Draft

Start writing here. The agent will keep the document in focus and add comments, suggestions, or reactions in the margin.
`;

const defaultReviewPrompt =
  'Read like a generous collaborator with taste. Leave lively marginalia: notice energy, friction, specificity, rhythm, and places where the draft wants a stronger choice. Avoid generic proofreading unless the text truly needs it.';
const defaultAgentInstructions =
  'Keep the document in focus. Be useful, specific, and alive on the page. Prefer concrete edits, margin comments, and approved-edit suggestions over abstract writing advice. If you claim to edit, rewrite, or provide a final version of the document, update the canvas with writing_studio_update_canvas before you answer.';

const defaultSettings: WritingSettings = {
  reviewIntervalSeconds: 12,
  reviewPrompt: defaultReviewPrompt,
  agentInstructions: defaultAgentInstructions,
};
const writingStudioAgentToolNames = [
  'writing_studio_get_canvas',
  'writing_studio_update_canvas',
  'writing_studio_add_annotation',
  'writing_studio_update_annotation',
  'writing_studio_resolve_annotation',
  'writing_studio_apply_annotation_edit',
  'writing_studio_get_agent_instructions',
  'writing_studio_update_agent_instructions',
];
const reviewChunkTargetLength = 3200;
const fullReviewTimeoutMs = 55_000;
const selectionReviewTimeoutMs = 35_000;

interface ReviewChunk {
  index: number;
  total: number;
  start: number;
  end: number;
  text: string;
}

function isUnavailableAgentModelError(error: unknown): boolean {
  return error instanceof Error && /Agent conversation model is not available/i.test(error.message);
}

function isUnsupportedActiveToolUpdateError(error: unknown): boolean {
  return error instanceof Error && /does not support active tool updates/i.test(error.message);
}

interface WritingStudioAgentTaskInput {
  cwd?: string;
  modelRef?: string;
  thinkingLevel?: string | null;
  prompt: string;
  tools?: 'none' | 'default';
  allowedToolNames?: string[];
  timeoutMs?: number;
}

function readAgentTurnText(result: unknown): string {
  if (typeof result !== 'object' || result === null) return '';
  const text = (result as { text?: unknown }).text;
  return typeof text === 'string' ? text.trim() : '';
}

async function runWritingStudioToolTask(
  input: WritingStudioAgentTaskInput,
  ctx: ExtensionBackendContext,
): Promise<{ text: string }> {
  try {
    const result = await runAgentTask(
      {
        ...(input.cwd ?? ctx.toolContext?.cwd ? { cwd: input.cwd ?? ctx.toolContext?.cwd } : {}),
        prompt: input.prompt,
        ...(input.modelRef ? { modelRef: input.modelRef } : {}),
        ...(input.thinkingLevel !== undefined ? { thinkingLevel: input.thinkingLevel } : {}),
        tools: 'default',
        allowedToolNames: input.allowedToolNames ?? writingStudioAgentToolNames,
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      },
      ctx,
    );
    return { text: readAgentTurnText(result) };
  } catch (error) {
    if (!input.modelRef || !isUnavailableAgentModelError(error)) throw error;
    return runWritingStudioToolTask({ ...input, modelRef: undefined }, ctx);
  }
}

function buildReviewChunks(markdown: string, targetLength = reviewChunkTargetLength): ReviewChunk[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [{ index: 0, total: 1, start: 0, end: 0, text: '' }];
  if (markdown.length <= targetLength) return [{ index: 0, total: 1, start: 0, end: markdown.length, text: markdown }];

  const chunks: Array<Omit<ReviewChunk, 'index' | 'total'>> = [];
  let start = 0;
  while (start < markdown.length) {
    const idealEnd = Math.min(markdown.length, start + targetLength);
    let end = idealEnd;
    if (idealEnd < markdown.length) {
      const paragraphBreak = markdown.lastIndexOf('\n\n', idealEnd);
      const sentenceBreak = markdown.lastIndexOf('. ', idealEnd);
      const candidate =
        paragraphBreak > start + targetLength * 0.55
          ? paragraphBreak + 2
          : sentenceBreak > start + targetLength * 0.55
            ? sentenceBreak + 2
            : idealEnd;
      end = Math.max(start + 1, candidate);
    }
    const text = markdown.slice(start, end).trim();
    if (text) chunks.push({ start, end, text });
    start = end;
  }
  const total = Math.max(1, chunks.length);
  return chunks.map((chunk, index) => ({ ...chunk, index, total }));
}

function reviewChunkForState(state: StoredState, selectedText?: string): ReviewChunk {
  if (selectedText?.trim()) {
    const from = state.markdown.indexOf(selectedText);
    return {
      index: 0,
      total: 1,
      start: Math.max(0, from),
      end: Math.max(0, from) + selectedText.length,
      text: selectedText,
    };
  }
  const chunks = buildReviewChunks(state.markdown);
  const cursor = state.reviewCursorChunk % chunks.length;
  return chunks[cursor] ?? chunks[0];
}

function nextReviewCursor(current: number, total: number): number {
  if (total <= 1) return 0;
  return (current + 1) % total;
}
function nowIso(): string {
  return new Date().toISOString();
}

function slugFileName(value: string, fallback = 'draft.md'): string {
  const base = value
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[/\\:]+/g, ' ')
    .replace(/[^a-z0-9 _.-]+/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const fileName = base || fallback.replace(/\.md$/i, '') || 'draft';
  return /\.md$/i.test(fileName) ? fileName : `${fileName}.md`;
}

function normalizeFolderPath(value: unknown): string {
  const raw = typeof value === 'string' ? value : 'Drafts';
  const clean = raw
    .split(/[\\/]+/)
    .map((part) =>
      part
        .trim()
        .replace(/[^a-z0-9 _.-]+/gi, '')
        .replace(/\s+/g, ' '),
    )
    .filter(Boolean)
    .join('/');
  return clean || 'Drafts';
}

function documentPath(folderPath: string, fileName: string): string {
  return `${normalizeFolderPath(folderPath)}/${slugFileName(fileName)}`;
}

function folderAncestors(folderPath: string): string[] {
  const parts = normalizeFolderPath(folderPath).split('/').filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}

function normalizeFolderList(folders: unknown): string[] {
  const values = Array.isArray(folders) ? folders : [];
  const next = new Set<string>();
  for (const value of values) {
    for (const folder of folderAncestors(normalizeFolderPath(value))) next.add(folder);
  }
  return [...next].sort((a, b) => a.localeCompare(b));
}

function foldersFromDocuments(documents: DocumentSummary[], folders: string[] = []): string[] {
  const next = new Set<string>(normalizeFolderList(folders));
  for (const doc of documents) for (const folder of folderAncestors(doc.folderPath)) next.add(folder);
  return [...next].sort((a, b) => a.localeCompare(b));
}

function defaultState(
  id = DEFAULT_DOCUMENT_ID,
  title = 'Draft',
  markdown = seedMarkdown,
  fileName = `${title}.md`,
  folderPath = 'Drafts',
): StoredState {
  return {
    id,
    title,
    fileName: slugFileName(fileName, 'draft.md'),
    folderPath: normalizeFolderPath(folderPath),
    markdown,
    updateClock: 0,
    events: [],
    annotations: [],
    chat: [],
    lastAgentRunAt: null,
    reviewCursorChunk: 0,
    settings: defaultSettings,
  };
}

function wordCount(markdown: string): number {
  return markdown.trim().split(/\s+/).filter(Boolean).length;
}

function titleFromMarkdown(markdown: string, fallback = 'Draft'): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.slice(0, 80);
  const firstLine = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine || fallback).slice(0, 80);
}

function summarize(state: StoredState): DocumentSummary {
  const updated = state.events.at(-1)?.timestamp ?? state.lastAgentRunAt ?? nowIso();
  return {
    id: state.id,
    title: state.title || titleFromMarkdown(state.markdown),
    fileName: state.fileName,
    folderPath: state.folderPath,
    path: documentPath(state.folderPath, state.fileName),
    updatedAt: updated,
    wordCount: wordCount(state.markdown),
  };
}

async function readIndex(ctx: ExtensionBackendContext): Promise<DocumentIndex> {
  const stored = await ctx.storage.get<DocumentIndex>(INDEX_KEY).catch(() => null);
  if (stored && typeof stored === 'object' && Array.isArray(stored.documents) && typeof stored.activeDocumentId === 'string') {
    return {
      activeDocumentId: stored.activeDocumentId || DEFAULT_DOCUMENT_ID,
      documents: stored.documents
        .filter((doc) => doc && typeof doc.id === 'string' && typeof doc.title === 'string')
        .map((doc) => ({
          ...doc,
          fileName: typeof doc.fileName === 'string' && doc.fileName.trim() ? slugFileName(doc.fileName) : slugFileName(doc.title),
          folderPath: normalizeFolderPath(doc.folderPath),
          path: documentPath(normalizeFolderPath(doc.folderPath), typeof doc.fileName === 'string' ? doc.fileName : doc.title),
        })),
      folders: foldersFromDocuments(stored.documents, normalizeFolderList((stored as { folders?: unknown }).folders)),
    };
  }
  const legacy = await ctx.storage.get<StoredState>(legacyStateKey).catch(() => null);
  const state = legacy && typeof legacy === 'object' ? normalizeState(DEFAULT_DOCUMENT_ID, legacy) : defaultState();
  await ctx.storage.put(documentKey(state.id), state);
  const index = { activeDocumentId: state.id, documents: [summarize(state)], folders: foldersFromDocuments([summarize(state)]) };
  await ctx.storage.put(INDEX_KEY, index);
  return index;
}

async function writeIndex(ctx: ExtensionBackendContext, index: DocumentIndex): Promise<void> {
  await ctx.storage.put(INDEX_KEY, { ...index, folders: foldersFromDocuments(index.documents, index.folders) });
}

function normalizeSettings(value: unknown): WritingSettings {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const reviewIntervalSeconds =
    typeof record.reviewIntervalSeconds === 'number' && Number.isFinite(record.reviewIntervalSeconds)
      ? Math.min(Math.max(Math.round(record.reviewIntervalSeconds), 3), 300)
      : defaultSettings.reviewIntervalSeconds;
  const reviewPrompt =
    typeof record.reviewPrompt === 'string' && record.reviewPrompt.trim() ? record.reviewPrompt.trim() : defaultSettings.reviewPrompt;
  const agentInstructions =
    typeof record.agentInstructions === 'string' && record.agentInstructions.trim()
      ? record.agentInstructions.trim().slice(0, 12_000)
      : defaultSettings.agentInstructions;
  return { reviewIntervalSeconds, reviewPrompt, agentInstructions };
}

function textAnchorForQuote(markdown: string, from: number, quote: string): AnnotationAnchor {
  const before = markdown
    .slice(Math.max(0, from - 80), from)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-60);
  const after = markdown
    .slice(from + quote.length, from + quote.length + 80)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return { before, after };
}

function normalizeAnnotation(value: unknown, markdown: string): Annotation {
  const annotation = value as Annotation;
  const quote = typeof annotation.quote === 'string' ? annotation.quote : '';
  const from = typeof annotation.from === 'number' && Number.isFinite(annotation.from) ? annotation.from : markdown.indexOf(quote);
  const storedAnchor = annotation.anchor as AnnotationAnchor | undefined;
  const anchor =
    storedAnchor && typeof storedAnchor === 'object' && typeof storedAnchor.before === 'string' && typeof storedAnchor.after === 'string'
      ? storedAnchor
      : from >= 0 && quote
        ? textAnchorForQuote(markdown, from, quote)
        : undefined;
  return { ...annotation, ...(anchor ? { anchor } : {}) };
}

function normalizeState(id: string, stored: Partial<StoredState>): StoredState {
  const title =
    typeof stored.title === 'string' && stored.title.trim() ? stored.title.trim() : titleFromMarkdown(stored.markdown ?? seedMarkdown);
  const fileName = typeof stored.fileName === 'string' && stored.fileName.trim() ? stored.fileName : title;
  return {
    ...defaultState(id),
    ...stored,
    id,
    title,
    fileName: slugFileName(fileName),
    folderPath: normalizeFolderPath(stored.folderPath),
    markdown: typeof stored.markdown === 'string' ? stored.markdown : seedMarkdown,
    events: Array.isArray(stored.events) ? stored.events : [],
    annotations: Array.isArray(stored.annotations)
      ? stored.annotations.map((annotation) =>
          normalizeAnnotation(annotation, typeof stored.markdown === 'string' ? stored.markdown : seedMarkdown),
        )
      : [],
    chat: Array.isArray(stored.chat) ? stored.chat : [],
    reviewCursorChunk:
      typeof stored.reviewCursorChunk === 'number' && Number.isSafeInteger(stored.reviewCursorChunk) && stored.reviewCursorChunk >= 0
        ? stored.reviewCursorChunk
        : 0,
    settings: normalizeSettings(stored.settings),
  };
}

async function readState(ctx: ExtensionBackendContext, documentId?: string): Promise<StoredState> {
  const index = await readIndex(ctx);
  const id = documentId?.trim() || index.activeDocumentId || DEFAULT_DOCUMENT_ID;
  const stored = await ctx.storage.get<StoredState>(documentKey(id)).catch(() => null);
  if (!stored || typeof stored !== 'object') {
    if (id === DEFAULT_DOCUMENT_ID) {
      const legacy = await ctx.storage.get<StoredState>(legacyStateKey).catch(() => null);
      if (legacy && typeof legacy === 'object') return normalizeState(id, legacy);
    }
    return defaultState(id);
  }
  return normalizeState(id, stored);
}

async function writeState(ctx: ExtensionBackendContext, state: StoredState): Promise<void> {
  await ctx.storage.put(documentKey(state.id), state);
  const index = await readIndex(ctx);
  const summary = summarize(state);
  const documents = [summary, ...index.documents.filter((doc) => doc.id !== state.id)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  await writeIndex(ctx, { activeDocumentId: state.id, documents, folders: index.folders });
}

function event(type: EventType, actorId: string, payload: Record<string, unknown>): WritingEvent {
  return { id: randomUUID(), type, actorId, timestamp: nowIso(), payload };
}

function markdownSnapshotPayload(markdown: string, payload: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...payload, markdownSnapshot: markdown, markdownLength: markdown.length };
}

function applyMarkdownSnapshot(ydoc: Y.Doc, markdown: string): void {
  const ytext = ydoc.getText('markdown');
  ydoc.transact(() => {
    ytext.delete(0, ytext.length);
    ytext.insert(0, markdown);
  });
}

function replayMarkdownFromEvents(events: WritingEvent[]): string {
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText('markdown');
  let markdown = '';
  for (const item of events) {
    if (item.type !== 'yjs_update') continue;
    const snapshot = item.payload.markdownSnapshot;
    if (typeof snapshot === 'string') {
      applyMarkdownSnapshot(ydoc, snapshot);
      markdown = snapshot;
      continue;
    }
    const updateBase64 = item.payload.updateBase64;
    if (typeof updateBase64 !== 'string' || !updateBase64.trim()) continue;
    try {
      Y.applyUpdate(ydoc, Buffer.from(updateBase64, 'base64'));
      markdown = ytext.toString();
    } catch {
      // Older validation fixtures stored placeholder bytes. Keep them in the
      // event log, but ignore them for CRDT replay.
    }
  }
  return markdown;
}

async function ensureHostChatConversation(
  state: StoredState,
  ctx: ExtensionBackendContext,
  modelRef?: string,
  options: { configureTools?: boolean; ensureLive?: boolean } = {},
): Promise<string> {
  if (!ctx.conversations?.create) {
    throw new Error('Writing Studio chat requires the host conversation capability.');
  }
  const configureTools = options.configureTools !== false;
  const shouldEnsureLive = options.ensureLive !== false;
  const conversationHasWritingStudioTools = async (conversationId: string): Promise<boolean | null> => {
    if (!configureTools || !ctx.conversations?.get) return null;
    try {
      const detail = await ctx.conversations.get(conversationId);
      const toolNames = detail && typeof detail === 'object' ? (detail as { toolNames?: unknown }).toolNames : undefined;
      if (!Array.isArray(toolNames)) return null;
      const activeTools = new Set(toolNames.filter((toolName): toolName is string => typeof toolName === 'string'));
      return writingStudioAgentToolNames.every((toolName) => activeTools.has(toolName));
    } catch {
      return null;
    }
  };
  const applyConversationTools = async (conversationId: string): Promise<boolean> => {
    if (!configureTools) return true;
    const hasRequiredTools = await conversationHasWritingStudioTools(conversationId);
    if (hasRequiredTools === true) return true;
    if (ctx.conversations?.setActiveTools) {
      try {
        await ctx.conversations.setActiveTools(conversationId, writingStudioAgentToolNames);
        return true;
      } catch {
        return hasRequiredTools !== false;
      }
    }
    return hasRequiredTools !== false;
  };
  const appendConversationContext = async (conversationId: string): Promise<void> => {
    await Promise.resolve(
      ctx.conversations?.appendCustomEntry?.(conversationId, 'writing_studio_agent_context', {
        documentId: state.id,
        fileName: state.fileName,
        instructions: state.settings.agentInstructions,
        createdAt: nowIso(),
      }),
    ).catch(() => undefined);
  };
  if (state.chatConversationId) {
    if (!shouldEnsureLive) return state.chatConversationId;
    try {
      const ensured = await ctx.conversations.ensureLive?.(
        state.chatConversationId,
        ctx.toolContext?.cwd ? { cwd: ctx.toolContext.cwd } : undefined,
      );
      if (ensured?.conversationId) state.chatConversationId = ensured.conversationId;
      if (await applyConversationTools(state.chatConversationId)) {
        await appendConversationContext(state.chatConversationId);
        return state.chatConversationId;
      }
      state.chatConversationId = undefined;
    } catch {
      state.chatConversationId = undefined;
    }
  }

  const cwd = ctx.toolContext?.cwd;
  let conversation;
  try {
    conversation = await ctx.conversations.create({
      ...(cwd ? { cwd } : {}),
      live: true,
      title: `Writing Studio: ${state.fileName}`,
      model: modelRef ?? null,
      ...(configureTools ? { allowedToolNames: writingStudioAgentToolNames } : {}),
    });
  } catch (error) {
    if (!configureTools || !isUnsupportedActiveToolUpdateError(error)) throw error;
    conversation = await ctx.conversations.create({
      ...(cwd ? { cwd } : {}),
      live: true,
      title: `Writing Studio: ${state.fileName}`,
      model: modelRef ?? null,
    });
  }
  state.chatConversationId = conversation.conversationId;
  await appendConversationContext(conversation.conversationId);
  return conversation.conversationId;
}

async function runReviewThroughChat(
  state: StoredState,
  ctx: ExtensionBackendContext,
  input: {
    runId: string;
    trigger: string;
    modelRef?: string;
    selectedText?: string;
    reviewPrompt?: string;
  },
): Promise<{ annotations: Annotation[] }> {
  await ensureHostChatConversation(state, ctx, input.modelRef);
  const existingIds = new Set(state.annotations.map((annotation) => annotation.id));
  const reviewPrompt = input.reviewPrompt?.trim() || state.settings.reviewPrompt;
  const selectedText = input.selectedText?.trim();
  const reviewChunk = reviewChunkForState(state, selectedText);
  const agentInstructions = state.settings.agentInstructions.slice(0, 800);
  const prompt = selectedText
    ? `Review this selected passage from the active Writing Studio document.

Use the Writing Studio tools, not JSON. Do not call writing_studio_get_canvas; the selected passage is included below. Do not describe annotations in prose. Emit raw function calls only, using this shape:
<function_calls><invoke name="writing_studio_add_annotation"><parameter name="quote">exact quote from the passage</parameter><parameter name="body">your comment</parameter><parameter name="kind">comment</parameter></invoke></function_calls>
Call writing_studio_add_annotation once, anchored to an exact quote from the selected passage. Do not review text outside the selected passage. If you suggest a concrete replacement, include a suggestedReplacement parameter. Your task is not complete until the writing_studio_add_annotation tool call succeeds.

Review prompt:
${reviewPrompt}

Agent instructions:
${agentInstructions}

Selected passage:
${reviewChunk.text}`
    : `Review the active Writing Studio document.

Use the Writing Studio tools, not JSON. Do not call writing_studio_get_canvas; the document excerpt is included below. Do not describe annotations in prose. Emit raw function calls only, using this shape:
<function_calls><invoke name="writing_studio_add_annotation"><parameter name="quote">exact quote from the excerpt</parameter><parameter name="body">your comment</parameter><parameter name="kind">comment</parameter></invoke></function_calls>
Add 3-6 useful margin comments across this excerpt, starting near the top and moving downward. Each call must use an exact quote from the excerpt. If you suggest a concrete replacement, include a suggestedReplacement parameter. Your task is not complete until at least 3 writing_studio_add_annotation tool calls succeed, unless the excerpt is too short for that many distinct comments.

Review region: ${reviewChunk.index + 1} of ${reviewChunk.total}
Excerpt character range: [${reviewChunk.start}, ${reviewChunk.end})

Review prompt:
${reviewPrompt}

Agent instructions:
${agentInstructions}

Document excerpt:
${reviewChunk.text}`;

  let resultText = '';
  try {
    const result = await runWritingStudioToolTask(
      {
        prompt,
        timeoutMs: selectedText ? selectionReviewTimeoutMs : fullReviewTimeoutMs,
        modelRef: input.modelRef,
        thinkingLevel: 'low',
        allowedToolNames: ['writing_studio_add_annotation'],
      },
      ctx,
    );
    resultText = result.text.trim();
  } catch (error) {
    throw new Error(`Writing Studio review failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const refreshed = await readState(ctx, state.id);
  const annotations = refreshed.annotations.filter((annotation) => annotation.status === 'open' && !existingIds.has(annotation.id));
  if (annotations.length === 0) {
    const diagnostic = resultText ? ` Agent response: ${resultText.slice(0, 500)}` : '';
    throw new Error(`Writing Studio review did not add any annotations.${diagnostic}`);
  }
  for (const annotation of annotations) annotation.agentRunId = input.runId;
  const nextCursor = selectedText ? refreshed.reviewCursorChunk : nextReviewCursor(reviewChunk.index, reviewChunk.total);
  refreshed.annotations = refreshed.annotations.map((annotation) =>
    annotations.some((added) => added.id === annotation.id) ? { ...annotation, agentRunId: input.runId } : annotation,
  );
  refreshed.reviewCursorChunk = nextCursor;
  refreshed.lastAgentRunAt = nowIso();
  refreshed.events.push(
    event('agent_run_completed', 'agent', {
      runId: input.runId,
      trigger: input.trigger,
      annotationCount: annotations.length,
      reviewChunk: selectedText
        ? { selected: true, start: reviewChunk.start, end: reviewChunk.end }
        : { index: reviewChunk.index, total: reviewChunk.total, start: reviewChunk.start, end: reviewChunk.end, nextCursor },
    }),
  );
  await writeState(ctx, refreshed);
  await Promise.resolve(
    ctx.conversations?.appendTranscriptBlock?.({
      conversationId: refreshed.chatConversationId ?? state.chatConversationId ?? '',
      blockType: 'writing_studio_review',
      title: `Reviewed ${annotations.length}`,
      blockId: `writing-studio-review:${input.runId}`,
      data: {
        documentId: refreshed.id,
        runId: input.runId,
        trigger: input.trigger,
        annotationCount: annotations.length,
        annotations: annotations.map((annotation) => ({
          id: annotation.id,
          kind: annotation.kind,
          quote: annotation.quote,
          body: annotation.body,
          suggestedReplacement: annotation.suggestedReplacement,
        })),
      },
    }),
  ).catch(() => undefined);
  return { annotations };
}

export async function ensureChatSession(input: unknown, ctx: ExtensionBackendContext): Promise<{ conversationId: string }> {
  const payload = input as { documentId?: string; modelRef?: string };
  const state = await readState(ctx, payload.documentId);
  const modelRef = typeof payload.modelRef === 'string' && payload.modelRef.trim() ? payload.modelRef.trim() : undefined;
  const conversationId = await ensureHostChatConversation(state, ctx, modelRef);
  await writeState(ctx, state);
  return { conversationId };
}

function readDocumentId(input: unknown): string | undefined {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>).documentId : undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function listDocuments(_input: unknown, ctx: ExtensionBackendContext): Promise<DocumentIndex> {
  return readIndex(ctx);
}

export async function createFolder(input: unknown, ctx: ExtensionBackendContext): Promise<DocumentIndex> {
  const payload = input as { folderPath?: string };
  const folderPath = normalizeFolderPath(payload.folderPath);
  const index = await readIndex(ctx);
  await writeIndex(ctx, { ...index, folders: [...index.folders, folderPath] });
  return readIndex(ctx);
}

type StoredStateWithIndex = StoredState & { documents: DocumentSummary[]; activeDocumentId: string; folders: string[] };

export async function load(input: unknown, ctx: ExtensionBackendContext): Promise<StoredStateWithIndex> {
  const state = await readState(ctx, readDocumentId(input));
  if (ctx.conversations?.create) {
    const previousChatConversationId = state.chatConversationId;
    await ensureHostChatConversation(state, ctx, undefined, { configureTools: false, ensureLive: false });
    if (state.chatConversationId !== previousChatConversationId) await writeState(ctx, state);
  }
  const index = await readIndex(ctx);
  if (index.activeDocumentId !== state.id) await writeIndex(ctx, { ...index, activeDocumentId: state.id });
  const refreshed = await readIndex(ctx);
  return { ...state, documents: refreshed.documents, activeDocumentId: state.id, folders: refreshed.folders };
}

export async function appendUpdate(input: unknown, ctx: ExtensionBackendContext): Promise<{ ok: true; clock: number }> {
  const payload = input as { updateBase64?: string; markdown?: string; actorId?: string; documentId?: string };
  if (!payload.updateBase64 || typeof payload.updateBase64 !== 'string') throw new Error('updateBase64 is required.');
  if (typeof payload.markdown !== 'string') throw new Error('markdown is required.');
  const state = await readState(ctx, payload.documentId);
  state.markdown = payload.markdown;
  state.title = titleFromMarkdown(state.markdown, state.title);
  state.updateClock += 1;
  state.events.push(
    event('yjs_update', payload.actorId ?? 'user', {
      updateBase64: payload.updateBase64,
      markdownSnapshot: state.markdown,
      markdownLength: payload.markdown.length,
      clock: state.updateClock,
    }),
  );
  await writeState(ctx, state);
  return { ok: true, clock: state.updateClock };
}

export async function runReview(input: unknown, ctx: ExtensionBackendContext): Promise<{ annotations: Annotation[]; runId: string }> {
  const payload = input as { markdown?: string; trigger?: string; reviewPrompt?: string; documentId?: string; modelRef?: string };
  const state = await readState(ctx, payload.documentId);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  state.title = titleFromMarkdown(state.markdown, state.title);
  const reviewSettings =
    typeof payload.reviewPrompt === 'string' && payload.reviewPrompt.trim()
      ? normalizeSettings({ ...state.settings, reviewPrompt: payload.reviewPrompt })
      : state.settings;
  const runId = randomUUID();
  const modelRef = typeof payload.modelRef === 'string' && payload.modelRef.trim() ? payload.modelRef.trim() : undefined;
  state.events.push(event('agent_run_started', 'agent', { runId, trigger: payload.trigger ?? 'manual' }));
  state.settings = reviewSettings;
  await writeState(ctx, state);
  const { annotations } = await runReviewThroughChat(state, ctx, {
    runId,
    trigger: payload.trigger ?? 'manual',
    modelRef,
    reviewPrompt: reviewSettings.reviewPrompt,
  });
  return { annotations, runId };
}

export async function reviewSelection(input: unknown, ctx: ExtensionBackendContext): Promise<{ annotations: Annotation[]; runId: string }> {
  const payload = input as { markdown?: string; selectedText?: string; documentId?: string; reviewPrompt?: string; modelRef?: string };
  const selectedText = typeof payload.selectedText === 'string' ? payload.selectedText.trim() : '';
  if (!selectedText) throw new Error('Selected text is required.');
  const state = await readState(ctx, payload.documentId);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  if (!state.markdown.includes(selectedText)) {
    throw new Error('Selected text no longer matches the current document.');
  }
  state.title = titleFromMarkdown(state.markdown, state.title);
  const runId = randomUUID();
  state.events.push(event('agent_run_started', 'agent', { runId, trigger: 'selection' }));
  const modelRef = typeof payload.modelRef === 'string' && payload.modelRef.trim() ? payload.modelRef.trim() : undefined;
  await writeState(ctx, state);
  const { annotations } = await runReviewThroughChat(state, ctx, {
    runId,
    trigger: 'selection',
    modelRef,
    selectedText,
    reviewPrompt: typeof payload.reviewPrompt === 'string' && payload.reviewPrompt.trim() ? payload.reviewPrompt.trim() : undefined,
  });
  return { annotations, runId };
}

export async function getCanvas(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{
  documentId: string;
  title: string;
  fileName: string;
  folderPath: string;
  markdown: string;
  annotations: Annotation[];
  documents: DocumentSummary[];
}> {
  const state = await readState(ctx, readDocumentId(input));
  const index = await readIndex(ctx);
  return {
    documentId: state.id,
    title: state.title,
    fileName: state.fileName,
    folderPath: state.folderPath,
    markdown: state.markdown,
    annotations: state.annotations,
    documents: index.documents,
  };
}

export async function updateCanvas(input: unknown, ctx: ExtensionBackendContext): Promise<{ ok: true; document: DocumentSummary }> {
  const payload = input as { documentId?: string; markdown?: string; title?: string; fileName?: string; folderPath?: string };
  if (typeof payload.markdown !== 'string') throw new Error('markdown is required.');
  const state = await readState(ctx, payload.documentId);
  state.markdown = payload.markdown;
  state.title =
    typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : titleFromMarkdown(state.markdown, state.title);
  if (typeof payload.fileName === 'string' && payload.fileName.trim()) state.fileName = slugFileName(payload.fileName);
  if (typeof payload.folderPath === 'string') state.folderPath = normalizeFolderPath(payload.folderPath);
  state.updateClock += 1;
  state.events.push(event('yjs_update', 'agent', markdownSnapshotPayload(state.markdown, { agentEditedCanvas: true, clock: state.updateClock })));
  await writeState(ctx, state);
  return { ok: true, document: summarize(state) };
}

export async function addAnnotation(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ annotation: Annotation; annotations: Annotation[] }> {
  const payload = input as {
    documentId?: string;
    quote?: string;
    body?: string;
    kind?: AnnotationKind;
    emoji?: string;
    suggestedReplacement?: string;
  };
  const quote = typeof payload.quote === 'string' ? payload.quote.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!quote) throw new Error('quote is required.');
  if (!body) throw new Error('body is required.');
  const state = await readState(ctx, payload.documentId);
  const from = state.markdown.indexOf(quote);
  if (from < 0) throw new Error('quote must exactly match text in the current canvas.');
  const kind: AnnotationKind =
    payload.kind === 'suggestion' || payload.kind === 'reaction' || payload.kind === 'warning' || payload.kind === 'comment'
      ? payload.kind
      : 'comment';
  const annotation: Annotation = {
    id: randomUUID(),
    kind,
    body,
    ...(typeof payload.emoji === 'string' && payload.emoji.trim() ? { emoji: payload.emoji.trim().slice(0, 8) } : {}),
    ...(typeof payload.suggestedReplacement === 'string' && payload.suggestedReplacement.trim()
      ? { suggestedReplacement: payload.suggestedReplacement.trim() }
      : {}),
    quote,
    anchor: textAnchorForQuote(state.markdown, from, quote),
    from,
    to: from + quote.length,
    status: 'open',
    createdAt: nowIso(),
  };
  state.annotations.unshift(annotation);
  state.events.push(event('annotation_added', 'agent', { annotation }));
  await writeState(ctx, state);
  return { annotation, annotations: state.annotations };
}

export async function updateAnnotation(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ annotation: Annotation; annotations: Annotation[] }> {
  const payload = input as {
    documentId?: string;
    id?: string;
    quote?: string;
    body?: string;
    kind?: AnnotationKind;
    emoji?: string;
    suggestedReplacement?: string | null;
  };
  if (!payload.id) throw new Error('Annotation id is required.');
  const state = await readState(ctx, payload.documentId);
  const existing = state.annotations.find((annotation) => annotation.id === payload.id);
  if (!existing) throw new Error('Annotation not found.');
  const nextQuote = typeof payload.quote === 'string' && payload.quote.trim() ? payload.quote.trim() : existing.quote;
  const from = state.markdown.indexOf(nextQuote);
  if (from < 0) throw new Error('quote must exactly match text in the current canvas.');
  const nextKind: AnnotationKind =
    payload.kind === 'suggestion' || payload.kind === 'reaction' || payload.kind === 'warning' || payload.kind === 'comment'
      ? payload.kind
      : existing.kind;
  const nextBody = typeof payload.body === 'string' && payload.body.trim() ? payload.body.trim() : existing.body;
  const nextEmoji = typeof payload.emoji === 'string' ? payload.emoji.trim().slice(0, 8) : existing.emoji;
  const nextSuggestedReplacement =
    payload.suggestedReplacement === null
      ? undefined
      : typeof payload.suggestedReplacement === 'string'
        ? payload.suggestedReplacement.trim() || undefined
        : existing.suggestedReplacement;
  const updated: Annotation = {
    ...existing,
    quote: nextQuote,
    anchor: textAnchorForQuote(state.markdown, from, nextQuote),
    body: nextBody,
    kind: nextKind,
    ...(nextEmoji ? { emoji: nextEmoji } : {}),
    ...(nextSuggestedReplacement ? { suggestedReplacement: nextSuggestedReplacement } : {}),
    from,
    to: from + nextQuote.length,
  };
  if (!nextSuggestedReplacement) delete updated.suggestedReplacement;
  state.annotations = state.annotations.map((annotation) => (annotation.id === payload.id ? updated : annotation));
  state.events.push(event('annotation_updated', 'agent', { annotation: updated }));
  await writeState(ctx, state);
  return { annotation: updated, annotations: state.annotations };
}

export async function applyAnnotationEdit(input: unknown, ctx: ExtensionBackendContext): Promise<StoredStateWithIndex> {
  const payload = input as { documentId?: string; id?: string };
  if (!payload.id) throw new Error('Annotation id is required.');
  const state = await readState(ctx, payload.documentId);
  const annotation = state.annotations.find((item) => item.id === payload.id);
  if (!annotation) throw new Error('Annotation not found.');
  if (!annotation.suggestedReplacement?.trim()) throw new Error('Annotation has no suggested replacement.');
  const from = state.markdown.indexOf(annotation.quote);
  if (from < 0) throw new Error('The annotated text changed; the edit can no longer be applied safely.');
  const to = from + annotation.quote.length;
  state.markdown = `${state.markdown.slice(0, from)}${annotation.suggestedReplacement}${state.markdown.slice(to)}`;
  state.title = titleFromMarkdown(state.markdown, state.title);
  state.updateClock += 1;
  state.annotations = state.annotations.map((item) =>
    item.id === annotation.id ? { ...item, status: 'resolved' as const, from, to: from + annotation.suggestedReplacement!.length } : item,
  );
  state.events.push(
    event('yjs_update', 'user', {
      appliedAnnotationEdit: true,
      annotationId: annotation.id,
      markdownSnapshot: state.markdown,
      markdownLength: state.markdown.length,
      clock: state.updateClock,
    }),
    event('annotation_resolved', 'user', { annotationId: annotation.id, appliedEdit: true }),
  );
  await writeState(ctx, state);
  const index = await readIndex(ctx);
  return { ...state, documents: index.documents, activeDocumentId: state.id, folders: index.folders };
}

export async function clearChat(input: unknown, ctx: ExtensionBackendContext): Promise<{ messages: ChatMessage[]; conversationId: string }> {
  const payload = input as { documentId?: string; modelRef?: string };
  const state = await readState(ctx, payload.documentId);
  if (state.chatConversationId) {
    await Promise.resolve(ctx.conversations?.abort?.(state.chatConversationId)).catch(() => undefined);
    state.chatConversationId = undefined;
  }
  state.chat = [];
  state.events.push(event('chat_cleared', 'user', {}));
  const modelRef = typeof payload.modelRef === 'string' && payload.modelRef.trim() ? payload.modelRef.trim() : undefined;
  const conversationId = await ensureHostChatConversation(state, ctx, modelRef);
  await writeState(ctx, state);
  return { messages: state.chat, conversationId };
}

export async function saveSettings(input: unknown, ctx: ExtensionBackendContext): Promise<{ settings: WritingSettings }> {
  const state = await readState(ctx, readDocumentId(input));
  state.settings = normalizeSettings({
    ...state.settings,
    ...(input && typeof input === 'object' ? (input as Record<string, unknown>) : {}),
  });
  state.events.push(event('settings_updated', 'user', { settings: state.settings }));
  await writeState(ctx, state);
  return { settings: state.settings };
}

export async function getAgentInstructions(input: unknown, ctx: ExtensionBackendContext): Promise<{ instructions: string }> {
  const state = await readState(ctx, readDocumentId(input));
  return { instructions: state.settings.agentInstructions };
}

export async function replayDocument(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ documentId: string; markdown: string; eventCount: number; updateEventCount: number; matchesLatest: boolean }> {
  const state = await readState(ctx, readDocumentId(input));
  const markdown = replayMarkdownFromEvents(state.events);
  const updateEventCount = state.events.filter((item) => item.type === 'yjs_update').length;
  return {
    documentId: state.id,
    markdown,
    eventCount: state.events.length,
    updateEventCount,
    matchesLatest: markdown === state.markdown,
  };
}

export async function updateAgentInstructions(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ instructions: string; settings: WritingSettings }> {
  const payload = input as { documentId?: string; instructions?: string; append?: boolean };
  const incoming = typeof payload.instructions === 'string' ? payload.instructions.trim() : '';
  if (!incoming) throw new Error('instructions are required.');
  const state = await readState(ctx, payload.documentId);
  const nextInstructions = payload.append ? `${state.settings.agentInstructions.trim()}\n\n${incoming}`.trim() : incoming;
  state.settings = normalizeSettings({ ...state.settings, agentInstructions: nextInstructions });
  state.events.push(event('settings_updated', 'agent', { agentInstructions: state.settings.agentInstructions }));
  await writeState(ctx, state);
  return { instructions: state.settings.agentInstructions, settings: state.settings };
}

export async function resolveAnnotation(input: unknown, ctx: ExtensionBackendContext): Promise<{ annotations: Annotation[] }> {
  const payload = input as { id?: string };
  if (!payload.id) throw new Error('Annotation id is required.');
  const state = await readState(ctx, readDocumentId(input));
  state.annotations = state.annotations.map((annotation) =>
    annotation.id === payload.id ? { ...annotation, status: 'resolved' as const } : annotation,
  );
  state.events.push(event('annotation_resolved', 'user', { annotationId: payload.id }));
  await writeState(ctx, state);
  return { annotations: state.annotations };
}

export async function createDocument(input: unknown, ctx: ExtensionBackendContext): Promise<StoredStateWithIndex> {
  const payload = input as { title?: string; markdown?: string; fileName?: string; folderPath?: string };
  const markdown =
    typeof payload.markdown === 'string'
      ? payload.markdown
      : `# ${typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : 'Untitled'}\n\n`;
  const title = titleFromMarkdown(markdown, payload.title || 'Untitled');
  const state = defaultState(randomUUID(), title, markdown, payload.fileName || title, payload.folderPath || 'Drafts');
  state.events.push(event('yjs_update', 'user', markdownSnapshotPayload(markdown, { imported: false, clock: 0 })));
  await writeState(ctx, state);
  const index = await readIndex(ctx);
  return { ...state, documents: index.documents, activeDocumentId: state.id, folders: index.folders };
}

export async function renameDocument(input: unknown, ctx: ExtensionBackendContext): Promise<StoredStateWithIndex> {
  const payload = input as { documentId?: string; fileName?: string; folderPath?: string };
  const state = await readState(ctx, payload.documentId);
  if (typeof payload.fileName === 'string' && payload.fileName.trim()) state.fileName = slugFileName(payload.fileName);
  if (typeof payload.folderPath === 'string') state.folderPath = normalizeFolderPath(payload.folderPath);
  state.updateClock += 1;
  state.events.push(
    event('yjs_update', 'user', {
      renamedDocument: true,
      fileName: state.fileName,
      folderPath: state.folderPath,
      markdownSnapshot: state.markdown,
      markdownLength: state.markdown.length,
      clock: state.updateClock,
    }),
  );
  await writeState(ctx, state);
  const index = await readIndex(ctx);
  return { ...state, documents: index.documents, activeDocumentId: state.id, folders: index.folders };
}

export async function deleteDocument(input: unknown, ctx: ExtensionBackendContext): Promise<StoredStateWithIndex> {
  const documentId = readDocumentId(input);
  if (!documentId) throw new Error('documentId is required.');
  const index = await readIndex(ctx);
  const remainingDocuments = index.documents.filter((doc) => doc.id !== documentId);
  await ctx.storage.delete(documentKey(documentId));
  if (remainingDocuments.length === 0) {
    const state = defaultState(randomUUID(), 'Untitled', '# Untitled\n\n', 'untitled.md', 'Drafts');
    state.events.push(event('yjs_update', 'user', markdownSnapshotPayload(state.markdown, { recreatedAfterDelete: true, clock: 0 })));
    await writeState(ctx, state);
    const nextIndex = await readIndex(ctx);
    return { ...state, documents: nextIndex.documents, activeDocumentId: state.id, folders: nextIndex.folders };
  }
  const activeDocumentId = index.activeDocumentId === documentId ? remainingDocuments[0].id : index.activeDocumentId;
  await writeIndex(ctx, { activeDocumentId, documents: remainingDocuments, folders: index.folders });
  return load({ documentId: activeDocumentId }, ctx);
}

export async function renameFolder(input: unknown, ctx: ExtensionBackendContext): Promise<DocumentIndex> {
  const payload = input as { folderPath?: string; nextFolderPath?: string };
  const folderPath = normalizeFolderPath(payload.folderPath);
  const nextFolderPath = normalizeFolderPath(payload.nextFolderPath);
  const index = await readIndex(ctx);
  const movedDocuments: DocumentSummary[] = [];
  for (const doc of index.documents) {
    if (doc.folderPath === folderPath || doc.folderPath.startsWith(`${folderPath}/`)) {
      const state = await readState(ctx, doc.id);
      state.folderPath = normalizeFolderPath(`${nextFolderPath}${state.folderPath.slice(folderPath.length)}`);
      state.events.push(event('yjs_update', 'user', markdownSnapshotPayload(state.markdown, { renamedFolder: true, from: folderPath, to: nextFolderPath })));
      await ctx.storage.put(documentKey(state.id), state);
      movedDocuments.push(summarize(state));
    } else {
      movedDocuments.push(doc);
    }
  }
  const folders = index.folders.filter((folder) => folder !== folderPath && !folder.startsWith(`${folderPath}/`)).concat(nextFolderPath);
  await writeIndex(ctx, { activeDocumentId: index.activeDocumentId, documents: movedDocuments, folders });
  return readIndex(ctx);
}

export async function deleteFolder(input: unknown, ctx: ExtensionBackendContext): Promise<DocumentIndex> {
  const payload = input as { folderPath?: string };
  const folderPath = normalizeFolderPath(payload.folderPath);
  const index = await readIndex(ctx);
  if (index.documents.some((doc) => doc.folderPath === folderPath || doc.folderPath.startsWith(`${folderPath}/`))) {
    throw new Error('Folder contains documents.');
  }
  await writeIndex(ctx, {
    ...index,
    folders: index.folders.filter((folder) => folder !== folderPath && !folder.startsWith(`${folderPath}/`)),
  });
  return readIndex(ctx);
}

export async function importDocument(input: unknown, ctx: ExtensionBackendContext): Promise<StoredStateWithIndex> {
  const payload = input as { title?: string; markdown?: string; fileName?: string; folderPath?: string };
  if (typeof payload.markdown !== 'string') throw new Error('markdown is required.');
  const title = titleFromMarkdown(payload.markdown, payload.title || 'Imported draft');
  const state = defaultState(
    randomUUID(),
    title,
    payload.markdown,
    payload.fileName || payload.title || title,
    payload.folderPath || 'Imports',
  );
  state.events.push(event('yjs_update', 'user', markdownSnapshotPayload(payload.markdown, { imported: true, clock: 0 })));
  await writeState(ctx, state);
  const index = await readIndex(ctx);
  return { ...state, documents: index.documents, activeDocumentId: state.id, folders: index.folders };
}

export async function saveDocument(input: unknown, ctx: ExtensionBackendContext): Promise<{ ok: true; document: DocumentSummary }> {
  const payload = input as { documentId?: string; markdown?: string; title?: string; fileName?: string; folderPath?: string };
  const state = await readState(ctx, payload.documentId);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  state.title =
    typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : titleFromMarkdown(state.markdown, state.title);
  if (typeof payload.fileName === 'string' && payload.fileName.trim()) state.fileName = slugFileName(payload.fileName);
  if (typeof payload.folderPath === 'string') state.folderPath = normalizeFolderPath(payload.folderPath);
  state.updateClock += 1;
  state.events.push(event('yjs_update', 'user', markdownSnapshotPayload(state.markdown, { manualSave: true, clock: state.updateClock })));
  await writeState(ctx, state);
  return { ok: true, document: summarize(state) };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInlineMarkdown(value: string): string {
  const imagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  let html = '';
  let lastIndex = 0;
  for (const match of value.matchAll(imagePattern)) {
    html += escapeHtml(value.slice(lastIndex, match.index));
    const [, alt = '', src = '', title] = match;
    html += `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''}>`;
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  html += escapeHtml(value.slice(lastIndex));
  return html;
}

function markdownToHtml(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim();
      if (!text) return '';
      const heading = text.match(/^(#{1,6})\s+(.+)$/);
      if (heading) return `<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`;
      return `<p>${renderInlineMarkdown(text).replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function documentHtml(title: string, markdown: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:48px auto;color:#111}h1,h2,h3{line-height:1.25}img{display:block;max-width:100%;height:auto;margin:1rem 0}</style></head><body>${markdownToHtml(markdown)}</body></html>`;
}

function rtfEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, '\\par\n');
}

function crc32(buffer: Buffer): number {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function zipStore(files: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const content = Buffer.from(file.content);
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, content);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function docx(title: string, markdown: string): string {
  const body = markdown
    .split(/\n{2,}/)
    .map((block) => `<w:p><w:r><w:t>${escapeHtml(block.replace(/^#+\s+/, '').trim())}</w:t></w:r></w:p>`)
    .join('');
  const zip = zipStore([
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: 'word/document.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`,
    },
    {
      name: 'docProps/core.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeHtml(title)}</dc:title></cp:coreProperties>`,
    },
  ]);
  return zip.toString('base64');
}

export async function exportDocument(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ fileName: string; mimeType: string; content: string; encoding: 'text' | 'base64' }> {
  const payload = input as { documentId?: string; format?: ExportFormat };
  const format = payload.format ?? 'markdown';
  const state = await readState(ctx, payload.documentId);
  const fileStem = slugFileName(state.fileName || state.title || 'draft').replace(/\.md$/i, '');
  if (format === 'html')
    return { fileName: `${fileStem}.html`, mimeType: 'text/html', content: documentHtml(state.title, state.markdown), encoding: 'text' };
  if (format === 'rtf')
    return {
      fileName: `${fileStem}.rtf`,
      mimeType: 'application/rtf',
      content: `{\\rtf1\\ansi\n${rtfEscape(state.markdown)}}`,
      encoding: 'text',
    };
  if (format === 'docx')
    return {
      fileName: `${fileStem}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: docx(state.title, state.markdown),
      encoding: 'base64',
    };
  return { fileName: `${fileStem}.md`, mimeType: 'text/markdown', content: state.markdown, encoding: 'text' };
}
