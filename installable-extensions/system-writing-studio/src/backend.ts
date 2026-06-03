import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { runAgentTask } from '@neon-pilot/extensions/backend/agent';

type EventType = 'yjs_update' | 'annotation_added' | 'annotation_resolved' | 'chat_message' | 'agent_run_started' | 'agent_run_completed';
type AnnotationKind = 'comment' | 'suggestion' | 'reaction' | 'warning';

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
  quote: string;
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

const defaultSettings: WritingSettings = {
  reviewIntervalSeconds: 12,
  reviewPrompt: defaultReviewPrompt,
};
const maxReviewAnnotations = 12;

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
    .map((part) => part.trim().replace(/[^a-z0-9 _.-]+/gi, '').replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('/');
  return clean || 'Drafts';
}

function documentPath(folderPath: string, fileName: string): string {
  return `${normalizeFolderPath(folderPath)}/${slugFileName(fileName)}`;
}

function defaultState(id = DEFAULT_DOCUMENT_ID, title = 'Draft', markdown = seedMarkdown, fileName = `${title}.md`, folderPath = 'Drafts'): StoredState {
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
    settings: defaultSettings,
  };
}

function wordCount(markdown: string): number {
  return markdown.trim().split(/\s+/).filter(Boolean).length;
}

function titleFromMarkdown(markdown: string, fallback = 'Draft'): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.slice(0, 80);
  const firstLine = markdown.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
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
    };
  }
  const legacy = await ctx.storage.get<StoredState>(legacyStateKey).catch(() => null);
  const state = legacy && typeof legacy === 'object' ? normalizeState(DEFAULT_DOCUMENT_ID, legacy) : defaultState();
  await ctx.storage.put(documentKey(state.id), state);
  const index = { activeDocumentId: state.id, documents: [summarize(state)] };
  await ctx.storage.put(INDEX_KEY, index);
  return index;
}

async function writeIndex(ctx: ExtensionBackendContext, index: DocumentIndex): Promise<void> {
  await ctx.storage.put(INDEX_KEY, index);
}

function normalizeSettings(value: unknown): WritingSettings {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const reviewIntervalSeconds =
    typeof record.reviewIntervalSeconds === 'number' && Number.isFinite(record.reviewIntervalSeconds)
      ? Math.min(Math.max(Math.round(record.reviewIntervalSeconds), 3), 300)
      : defaultSettings.reviewIntervalSeconds;
  const reviewPrompt = typeof record.reviewPrompt === 'string' && record.reviewPrompt.trim() ? record.reviewPrompt.trim() : defaultSettings.reviewPrompt;
  return { reviewIntervalSeconds, reviewPrompt };
}

function normalizeState(id: string, stored: Partial<StoredState>): StoredState {
  const title = typeof stored.title === 'string' && stored.title.trim() ? stored.title.trim() : titleFromMarkdown(stored.markdown ?? seedMarkdown);
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
    annotations: Array.isArray(stored.annotations) ? stored.annotations : [],
    chat: Array.isArray(stored.chat) ? stored.chat : [],
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
  const documents = [summary, ...index.documents.filter((doc) => doc.id !== state.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  await writeIndex(ctx, { activeDocumentId: state.id, documents });
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
      return {
        id: randomUUID(),
        kind,
        body,
        ...(emoji ? { emoji } : {}),
        quote,
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

async function buildAgentReviewAnnotations(
  markdown: string,
  runId: string,
  settings: WritingSettings,
  ctx: ExtensionBackendContext,
  modelRef?: string,
): Promise<Annotation[]> {
  const prompt = `You are reviewing a markdown draft in Writing Studio.

Return only JSON: an array of 1-${maxReviewAnnotations} objects with keys quote, body, kind, and optional emoji.
kind must be one of comment, suggestion, reaction, warning.
quote must be an exact substring from the draft.
Write like a generous collaborator with personality. Avoid generic proofreading.

Review prompt:
${settings.reviewPrompt}

Draft:
${markdown}`;
  try {
    const result = await runAgentTask({ prompt, tools: 'default', timeoutMs: 45_000, modelRef }, ctx);
    return parseAgentAnnotations(result.text, markdown, runId);
  } catch (error) {
    throw new Error(`Writing Studio review failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function buildAgentChatReply(message: string, state: StoredState, ctx: ExtensionBackendContext, modelRef?: string): Promise<string> {
  const openAnnotations = state.annotations
    .filter((annotation) => annotation.status === 'open')
    .slice(0, 12)
    .map((annotation) => `- ${annotation.kind}: "${annotation.quote}" — ${annotation.body}`)
    .join('\n');
  const recentChat = state.chat
    .slice(-8)
    .map((chatMessage) => `${chatMessage.role === 'agent' ? 'assistant' : 'user'}: ${chatMessage.body}`)
    .join('\n\n');
  const prompt = `You are the Writing Studio collaborator inside Neon Pilot.

The user is chatting beside a markdown draft. Keep the document in focus: answer the user's request, discuss selected passages, suggest concrete edits, or use tools when useful.

If you need to change the document, use the Writing Studio canvas tool instead of only describing the edit.
If you want to leave margin feedback, use the Writing Studio annotation tool with an exact quote from the draft.
Do not mention hidden implementation details or that you are an extension backend.

Document:
${state.markdown}

Open comments:
${openAnnotations || '(none)'}

Recent chat:
${recentChat || '(none)'}

User message:
${message}`;
  const result = await runAgentTask({ prompt, tools: 'default', timeoutMs: 60_000, modelRef }, ctx);
  const text = result.text.trim();
  if (!text) throw new Error('Writing Studio agent returned an empty response.');
  return text;
}

function readDocumentId(input: unknown): string | undefined {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>).documentId : undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function listDocuments(_input: unknown, ctx: ExtensionBackendContext): Promise<DocumentIndex> {
  return readIndex(ctx);
}

export async function load(input: unknown, ctx: ExtensionBackendContext): Promise<StoredState & { documents: DocumentSummary[]; activeDocumentId: string }> {
  const state = await readState(ctx, readDocumentId(input));
  const index = await readIndex(ctx);
  if (index.activeDocumentId !== state.id) await writeIndex(ctx, { ...index, activeDocumentId: state.id });
  const refreshed = await readIndex(ctx);
  return { ...state, documents: refreshed.documents, activeDocumentId: state.id };
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
  state.events.push(event('agent_run_started', 'agent', { runId, trigger: payload.trigger ?? 'manual' }));
  const modelRef = typeof payload.modelRef === 'string' && payload.modelRef.trim() ? payload.modelRef.trim() : undefined;
  const annotations = await buildAgentReviewAnnotations(state.markdown, runId, reviewSettings, ctx, modelRef);
  if (annotations.length === 0) throw new Error('Writing Studio review returned no valid annotations.');
  const refreshedQuotes = new Set(annotations.map((annotation) => annotation.quote));
  state.annotations = state.annotations.filter(
    (annotation) => annotation.status !== 'open' || (annotation.quote && state.markdown.includes(annotation.quote) && !refreshedQuotes.has(annotation.quote)),
  );
  state.annotations.unshift(...annotations);
  for (const annotation of annotations) state.events.push(event('annotation_added', 'agent', { annotation }));
  state.lastAgentRunAt = nowIso();
  state.events.push(event('agent_run_completed', 'agent', { runId, annotationCount: annotations.length }));
  await writeState(ctx, state);
  return { annotations, runId };
}

export async function getCanvas(input: unknown, ctx: ExtensionBackendContext): Promise<{
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
  state.title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : titleFromMarkdown(state.markdown, state.title);
  if (typeof payload.fileName === 'string' && payload.fileName.trim()) state.fileName = slugFileName(payload.fileName);
  if (typeof payload.folderPath === 'string') state.folderPath = normalizeFolderPath(payload.folderPath);
  state.updateClock += 1;
  state.events.push(event('yjs_update', 'agent', { agentEditedCanvas: true, markdownLength: state.markdown.length, clock: state.updateClock }));
  await writeState(ctx, state);
  return { ok: true, document: summarize(state) };
}

export async function addAnnotation(input: unknown, ctx: ExtensionBackendContext): Promise<{ annotation: Annotation; annotations: Annotation[] }> {
  const payload = input as { documentId?: string; quote?: string; body?: string; kind?: AnnotationKind; emoji?: string };
  const quote = typeof payload.quote === 'string' ? payload.quote.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!quote) throw new Error('quote is required.');
  if (!body) throw new Error('body is required.');
  const state = await readState(ctx, payload.documentId);
  const from = state.markdown.indexOf(quote);
  if (from < 0) throw new Error('quote must exactly match text in the current canvas.');
  const kind: AnnotationKind =
    payload.kind === 'suggestion' || payload.kind === 'reaction' || payload.kind === 'warning' || payload.kind === 'comment' ? payload.kind : 'comment';
  const annotation: Annotation = {
    id: randomUUID(),
    kind,
    body,
    ...(typeof payload.emoji === 'string' && payload.emoji.trim() ? { emoji: payload.emoji.trim().slice(0, 8) } : {}),
    quote,
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

export async function sendChat(input: unknown, ctx: ExtensionBackendContext): Promise<{ messages: ChatMessage[] }> {
  const payload = input as { body?: string; markdown?: string; documentId?: string; modelRef?: string };
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!body) throw new Error('Chat message is required.');
  const state = await readState(ctx, payload.documentId);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  const userMessage: ChatMessage = { id: randomUUID(), role: 'user', body, createdAt: nowIso() };
  const modelRef = typeof payload.modelRef === 'string' && payload.modelRef.trim() ? payload.modelRef.trim() : undefined;
  const reply = await buildAgentChatReply(body, { ...state, chat: [...state.chat, userMessage] }, ctx, modelRef);
  const agentMessage: ChatMessage = { id: randomUUID(), role: 'agent', body: reply, createdAt: nowIso() };
  state.chat.push(userMessage, agentMessage);
  state.events.push(event('chat_message', 'user', { message: userMessage }), event('chat_message', 'agent', { message: agentMessage }));
  await writeState(ctx, state);
  return { messages: state.chat };
}

export async function saveSettings(input: unknown, ctx: ExtensionBackendContext): Promise<{ settings: WritingSettings }> {
  const state = await readState(ctx, readDocumentId(input));
  state.settings = normalizeSettings({ ...state.settings, ...(input && typeof input === 'object' ? (input as Record<string, unknown>) : {}) });
  await writeState(ctx, state);
  return { settings: state.settings };
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

export async function createDocument(input: unknown, ctx: ExtensionBackendContext): Promise<StoredState & { documents: DocumentSummary[]; activeDocumentId: string }> {
  const payload = input as { title?: string; markdown?: string; fileName?: string; folderPath?: string };
  const markdown = typeof payload.markdown === 'string' ? payload.markdown : `# ${typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : 'Untitled'}\n\n`;
  const title = titleFromMarkdown(markdown, payload.title || 'Untitled');
  const state = defaultState(randomUUID(), title, markdown, payload.fileName || title, payload.folderPath || 'Drafts');
  state.events.push(event('yjs_update', 'user', { imported: false, markdownLength: markdown.length, clock: 0 }));
  await writeState(ctx, state);
  const index = await readIndex(ctx);
  return { ...state, documents: index.documents, activeDocumentId: state.id };
}

export async function importDocument(input: unknown, ctx: ExtensionBackendContext): Promise<StoredState & { documents: DocumentSummary[]; activeDocumentId: string }> {
  const payload = input as { title?: string; markdown?: string; fileName?: string; folderPath?: string };
  if (typeof payload.markdown !== 'string') throw new Error('markdown is required.');
  const title = titleFromMarkdown(payload.markdown, payload.title || 'Imported draft');
  const state = defaultState(randomUUID(), title, payload.markdown, payload.fileName || payload.title || title, payload.folderPath || 'Imports');
  state.events.push(event('yjs_update', 'user', { imported: true, markdownLength: payload.markdown.length, clock: 0 }));
  await writeState(ctx, state);
  const index = await readIndex(ctx);
  return { ...state, documents: index.documents, activeDocumentId: state.id };
}

export async function saveDocument(input: unknown, ctx: ExtensionBackendContext): Promise<{ ok: true; document: DocumentSummary }> {
  const payload = input as { documentId?: string; markdown?: string; title?: string; fileName?: string; folderPath?: string };
  const state = await readState(ctx, payload.documentId);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  state.title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : titleFromMarkdown(state.markdown, state.title);
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

function markdownToHtml(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim();
      if (!text) return '';
      const heading = text.match(/^(#{1,6})\s+(.+)$/);
      if (heading) return `<h${heading[1].length}>${escapeHtml(heading[2])}</h${heading[1].length}>`;
      return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function documentHtml(title: string, markdown: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:48px auto;color:#111}h1,h2,h3{line-height:1.25}</style></head><body>${markdownToHtml(markdown)}</body></html>`;
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
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', content: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>` },
    { name: 'docProps/core.xml', content: `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeHtml(title)}</dc:title></cp:coreProperties>` },
  ]);
  return zip.toString('base64');
}

export async function exportDocument(input: unknown, ctx: ExtensionBackendContext): Promise<{ fileName: string; mimeType: string; content: string; encoding: 'text' | 'base64' }> {
  const payload = input as { documentId?: string; format?: ExportFormat };
  const format = payload.format ?? 'markdown';
  const state = await readState(ctx, payload.documentId);
  const fileStem = slugFileName(state.fileName || state.title || 'draft').replace(/\.md$/i, '');
  if (format === 'html') return { fileName: `${fileStem}.html`, mimeType: 'text/html', content: documentHtml(state.title, state.markdown), encoding: 'text' };
  if (format === 'rtf') return { fileName: `${fileStem}.rtf`, mimeType: 'application/rtf', content: `{\\rtf1\\ansi\n${rtfEscape(state.markdown)}}`, encoding: 'text' };
  if (format === 'docx') return { fileName: `${fileStem}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: docx(state.title, state.markdown), encoding: 'base64' };
  return { fileName: `${fileStem}.md`, mimeType: 'text/markdown', content: state.markdown, encoding: 'text' };
}
