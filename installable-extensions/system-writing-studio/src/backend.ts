import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { runAgentTask } from '@neon-pilot/extensions/backend/agent';

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
  'Keep the document in focus. Be useful, specific, and alive on the page. Prefer concrete edits, margin comments, and approved-edit suggestions over abstract writing advice.';

const defaultSettings: WritingSettings = {
  reviewIntervalSeconds: 12,
  reviewPrompt: defaultReviewPrompt,
  agentInstructions: defaultAgentInstructions,
};
const maxReviewAnnotations = 12;
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

function isUnavailableAgentModelError(error: unknown): boolean {
  return error instanceof Error && /Agent conversation model is not available/i.test(error.message);
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

async function runWritingStudioAgentTask(
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
        ...(input.tools ? { tools: input.tools } : {}),
        ...(input.allowedToolNames ? { allowedToolNames: input.allowedToolNames } : {}),
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      },
      ctx,
    );
    const text = readAgentTurnText(result);
    if (!text && input.tools === 'none') throw new Error('Agent review returned no text.');
    return { text };
  } catch (error) {
    if (!input.modelRef || !isUnavailableAgentModelError(error)) throw error;
    return runWritingStudioAgentTask({ ...input, modelRef: undefined }, ctx);
  }
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
const reviewChunkCharacterLimit = 2_400;
const reviewMaxChunks = 5;
const reviewChunksPerRun = 2;

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

function parseAgentAnnotations(text: string, markdown: string, runId: string): Annotation[] {
  const jsonText = text.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? text.match(/\[[\s\S]*\]/)?.[0] ?? text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed) && parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).annotations)) {
    parsed = (parsed as { annotations: unknown[] }).annotations;
  }
  if (!Array.isArray(parsed)) return [];
  const createdAt = nowIso();
  return parsed
    .map((item): Annotation | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const quote = typeof record.quote === 'string' ? record.quote.trim() : '';
      const body = typeof record.body === 'string' ? record.body.trim() : '';
      if (!quote || !body) return null;
      const from = markdown.indexOf(quote);
      if (from < 0) return null;
      const rawKind = typeof record.kind === 'string' ? record.kind : 'comment';
      const kind: AnnotationKind = rawKind === 'suggestion' || rawKind === 'reaction' || rawKind === 'warning' ? rawKind : 'comment';
      const emoji = typeof record.emoji === 'string' && record.emoji.trim() ? record.emoji.trim().slice(0, 8) : undefined;
      const suggestedReplacement =
        typeof record.suggestedReplacement === 'string' && record.suggestedReplacement.trim()
          ? record.suggestedReplacement.trim()
          : undefined;
      return {
        id: randomUUID(),
        kind,
        body,
        ...(emoji ? { emoji } : {}),
        ...(suggestedReplacement ? { suggestedReplacement } : {}),
        quote,
        anchor: textAnchorForQuote(markdown, from, quote),
        from,
        to: from + quote.length,
        status: 'open',
        createdAt,
        agentRunId: runId,
      };
    })
    .filter((annotation): annotation is Annotation => annotation !== null)
    .slice(0, maxReviewAnnotations);
}

function reviewDraftChunks(markdown: string): string[] {
  const paragraphs = markdown.split(/(\n{2,})/);
  const chunks: string[] = [];
  let chunk = '';
  for (let index = 0; index < paragraphs.length; index += 2) {
    const paragraph = paragraphs[index] ?? '';
    const separator = paragraphs[index + 1] ?? '\n\n';
    const next = chunk ? `${chunk}${separator}${paragraph}` : paragraph;
    if (next.length > reviewChunkCharacterLimit && chunk.trim()) {
      chunks.push(chunk.trim());
      chunk = paragraph;
    } else {
      chunk = next;
    }
    while (chunk.length > reviewChunkCharacterLimit) {
      const slice = chunk.slice(0, reviewChunkCharacterLimit);
      const sentenceBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '));
      const cut = sentenceBreak > 800 ? sentenceBreak + 1 : reviewChunkCharacterLimit;
      chunks.push(chunk.slice(0, cut).trim());
      chunk = chunk.slice(cut).trimStart();
    }
    if (chunks.length >= reviewMaxChunks) break;
  }
  if (chunk.trim() && chunks.length < reviewMaxChunks) chunks.push(chunk.trim());
  return chunks.filter(Boolean).slice(0, reviewMaxChunks);
}

async function buildAgentReviewAnnotations(
  markdown: string,
  runId: string,
  settings: WritingSettings,
  ctx: ExtensionBackendContext,
  modelRef?: string,
  cursorChunk = 0,
): Promise<{ annotations: Annotation[]; nextReviewCursorChunk: number }> {
  const chunks = reviewDraftChunks(markdown);
  const annotations: Annotation[] = [];
  const seenQuotes = new Set<string>();
  if (chunks.length === 0) return { annotations, nextReviewCursorChunk: 0 };

  const startIndex = cursorChunk % chunks.length;
  const chunkIndexes = Array.from({ length: Math.min(reviewChunksPerRun, chunks.length) }, (_, offset) => (startIndex + offset) % chunks.length);

  for (const index of chunkIndexes) {
    const reviewMarkdown = chunks[index];
    const remaining = maxReviewAnnotations - annotations.length;
    if (remaining <= 0) break;
    const targetCount = Math.min(5, Math.max(3, remaining));
    const prompt = `You are reviewing a markdown draft in Writing Studio.

Return only JSON: an array of ${targetCount}-${targetCount + 1} objects with keys quote, body, kind, optional emoji, and optional suggestedReplacement.
kind must be one of comment, suggestion, reaction, warning.
quote must be an exact substring from the draft.
Choose quotes by copying 8-30 consecutive words directly from the draft text. Do not paraphrase quotes.
When you are proposing a concrete rewrite, include suggestedReplacement as the exact replacement text for quote. Only include it when the user could approve it directly.
Write like a generous collaborator with personality. Avoid generic proofreading.
This is chunk ${index + 1} of ${chunks.length}. Review this chunk only, so the document gets useful margin coverage from top to bottom.

Review prompt:
${settings.reviewPrompt}

Agent instructions:
${settings.agentInstructions}

Draft chunk:
${reviewMarkdown}`;
    try {
      const result = await runWritingStudioAgentTask({ prompt, tools: 'none', timeoutMs: 45_000, modelRef }, ctx);
      for (const annotation of parseAgentAnnotations(result.text, markdown, runId)) {
        if (seenQuotes.has(annotation.quote)) continue;
        seenQuotes.add(annotation.quote);
        annotations.push(annotation);
        if (annotations.length >= maxReviewAnnotations) break;
      }
    } catch (error) {
      throw new Error(`Writing Studio review failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { annotations, nextReviewCursorChunk: (startIndex + chunkIndexes.length) % chunks.length };
}

async function ensureHostChatConversation(state: StoredState, ctx: ExtensionBackendContext, modelRef?: string): Promise<string> {
  if (!ctx.conversations?.create) {
    throw new Error('Writing Studio chat requires the host conversation capability.');
  }
  const applyConversationContext = async (conversationId: string): Promise<boolean> => {
    if (ctx.conversations?.setActiveTools) {
      try {
        await ctx.conversations.setActiveTools(conversationId, writingStudioAgentToolNames);
      } catch {
        return false;
      }
    }
    await Promise.resolve(
      ctx.conversations?.appendCustomEntry?.(conversationId, 'writing_studio_agent_context', {
        documentId: state.id,
        fileName: state.fileName,
        instructions: state.settings.agentInstructions,
        createdAt: nowIso(),
      }),
    ).catch(() => undefined);
    return true;
  };
  if (state.chatConversationId) {
    try {
      const ensured = await ctx.conversations.ensureLive?.(
        state.chatConversationId,
        ctx.toolContext?.cwd ? { cwd: ctx.toolContext.cwd } : undefined,
      );
      if (ensured?.conversationId) state.chatConversationId = ensured.conversationId;
      if (await applyConversationContext(state.chatConversationId)) return state.chatConversationId;
      state.chatConversationId = undefined;
    } catch {
      state.chatConversationId = undefined;
    }
  }

  const cwd = ctx.toolContext?.cwd;
  const conversation = await ctx.conversations.create({
    ...(cwd ? { cwd } : {}),
    live: true,
    title: `Writing Studio: ${state.fileName}`,
    model: modelRef ?? null,
    allowedToolNames: writingStudioAgentToolNames,
  });
  state.chatConversationId = conversation.conversationId;
  await applyConversationContext(conversation.conversationId);
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
  const reviewDocumentChunk = state.markdown.length > 1800 ? state.markdown.slice(0, 1800) : state.markdown;
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
${selectedText}`
    : `Review the first pass of the active Writing Studio document.

Use the Writing Studio tools, not JSON. Do not call writing_studio_get_canvas; the document excerpt is included below. Do not describe annotations in prose. Emit raw function calls only, using this shape:
<function_calls><invoke name="writing_studio_add_annotation"><parameter name="quote">exact quote from the excerpt</parameter><parameter name="body">your comment</parameter><parameter name="kind">comment</parameter></invoke></function_calls>
Call writing_studio_add_annotation once, anchored to an exact quote from this excerpt. Pick the highest-value comment near the top of the excerpt. If you suggest a concrete replacement, include a suggestedReplacement parameter. Your task is not complete until the writing_studio_add_annotation tool call succeeds.

Review prompt:
${reviewPrompt}

Agent instructions:
${agentInstructions}

Document excerpt:
${reviewDocumentChunk}`;

  let resultText = '';
  try {
    const result = await runWritingStudioToolTask(
      {
        prompt,
        timeoutMs: selectedText ? 45_000 : 60_000,
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
  refreshed.annotations = refreshed.annotations.map((annotation) =>
    annotations.some((added) => added.id === annotation.id) ? { ...annotation, agentRunId: input.runId } : annotation,
  );
  refreshed.lastAgentRunAt = nowIso();
  refreshed.events.push(event('agent_run_completed', 'agent', { runId: input.runId, trigger: input.trigger, annotationCount: annotations.length }));
  await writeState(ctx, refreshed);
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
    await ensureHostChatConversation(state, ctx);
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
  state.events.push(
    event('yjs_update', 'agent', { agentEditedCanvas: true, markdownLength: state.markdown.length, clock: state.updateClock }),
  );
  await writeState(ctx, state);
  return { ok: true, document: summarize(state) };
}

export async function addAnnotation(
  input: unknown,
  ctx: ExtensionBackendContext,
): Promise<{ annotation: Annotation; annotations: Annotation[]; terminate: true }> {
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
  return { annotation, annotations: state.annotations, terminate: true };
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
  state.events.push(event('yjs_update', 'user', { imported: false, markdownLength: markdown.length, clock: 0 }));
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
    state.events.push(event('yjs_update', 'user', { recreatedAfterDelete: true, markdownLength: state.markdown.length, clock: 0 }));
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
      state.events.push(event('yjs_update', 'user', { renamedFolder: true, from: folderPath, to: nextFolderPath }));
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
  state.events.push(event('yjs_update', 'user', { imported: true, markdownLength: payload.markdown.length, clock: 0 }));
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
  state.events.push(event('yjs_update', 'user', { manualSave: true, markdownLength: state.markdown.length, clock: state.updateClock }));
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
