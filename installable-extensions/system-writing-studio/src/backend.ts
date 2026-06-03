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

function nowIso(): string {
  return new Date().toISOString();
}

function defaultState(id = DEFAULT_DOCUMENT_ID, title = 'Draft', markdown = seedMarkdown): StoredState {
  return {
    id,
    title,
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
  return { id: state.id, title: state.title || titleFromMarkdown(state.markdown), updatedAt: updated, wordCount: wordCount(state.markdown) };
}

async function readIndex(ctx: ExtensionBackendContext): Promise<DocumentIndex> {
  const stored = await ctx.storage.get<DocumentIndex>(INDEX_KEY).catch(() => null);
  if (stored && typeof stored === 'object' && Array.isArray(stored.documents) && typeof stored.activeDocumentId === 'string') {
    return {
      activeDocumentId: stored.activeDocumentId || DEFAULT_DOCUMENT_ID,
      documents: stored.documents.filter((doc) => doc && typeof doc.id === 'string' && typeof doc.title === 'string'),
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
  return {
    ...defaultState(id),
    ...stored,
    id,
    title: typeof stored.title === 'string' && stored.title.trim() ? stored.title.trim() : titleFromMarkdown(stored.markdown ?? seedMarkdown),
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

function findSentence(text: string, predicate: (sentence: string) => boolean): { quote: string; from: number; to: number } | null {
  const matches = text.matchAll(/[^.!?\n]+[.!?]?/g);
  for (const match of matches) {
    const sentence = match[0].trim();
    if (!sentence) continue;
    if (predicate(sentence)) {
      const from = match.index ?? 0;
      return { quote: sentence, from, to: from + match[0].length };
    }
  }
  return null;
}

function buildReviewAnnotations(markdown: string, runId: string, settings: WritingSettings): Annotation[] {
  const createdAt = nowIso();
  const annotations: Annotation[] = [];
  const withoutHeading = markdown.replace(/^# .+$/m, '').trim();
  const longSentence = findSentence(withoutHeading, (sentence) => sentence.split(/\s+/).length > 28);
  const hedge = findSentence(withoutHeading, (sentence) => /\b(maybe|probably|basically|kind of|sort of)\b/i.test(sentence));
  const strongLine = findSentence(withoutHeading, (sentence) => sentence.split(/\s+/).length >= 8 && !/\b(maybe|probably|basically)\b/i.test(sentence));

  if (longSentence) {
    annotations.push({
      id: randomUUID(),
      kind: 'suggestion',
      body: 'This sentence is doing a brave amount of work. I would split it and let the second beat arrive with more oxygen.',
      quote: longSentence.quote,
      from: longSentence.from,
      to: longSentence.to,
      status: 'open',
      createdAt,
      agentRunId: runId,
    });
  }

  if (hedge) {
    annotations.push({
      id: randomUUID(),
      kind: 'warning',
      body: 'This phrase pulls the punch a little. Keep the softness if it is emotionally true; otherwise let the claim stand up straighter.',
      quote: hedge.quote,
      from: hedge.from,
      to: hedge.to,
      status: 'open',
      createdAt,
      agentRunId: runId,
    });
  }

  if (strongLine) {
    annotations.push({
      id: randomUUID(),
      kind: 'reaction',
      body: 'There is a pulse here. This feels like a sentence the rest of the piece can gather around.',
      emoji: '✦',
      quote: strongLine.quote,
      from: strongLine.from,
      to: strongLine.to,
      status: 'open',
      createdAt,
      agentRunId: runId,
    });
  }

  if (annotations.length === 0 && withoutHeading) {
    const quote = withoutHeading.slice(0, 140);
    annotations.push({
      id: randomUUID(),
      kind: 'comment',
      body: `I am early in the room with this draft, but I can feel what it wants: a sharper promise to the reader. ${settings.reviewPrompt ? 'I will keep reading for texture, stakes, and the places where the voice gets most alive.' : ''}`,
      quote,
      from: markdown.indexOf(quote),
      to: markdown.indexOf(quote) + quote.length,
      status: 'open',
      createdAt,
      agentRunId: runId,
    });
  }

  return annotations.slice(0, 3);
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
    .slice(0, 5);
}

async function buildAgentReviewAnnotations(
  markdown: string,
  runId: string,
  settings: WritingSettings,
  ctx: ExtensionBackendContext,
  modelRef?: string,
): Promise<Annotation[]> {
  const prompt = `You are reviewing a markdown draft in Writing Studio.

Return only JSON: an array of 1-5 objects with keys quote, body, kind, and optional emoji.
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
  } catch {
    return [];
  }
}

function chatReply(message: string, markdown: string): string {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  if (/rewrite|revise|improve/i.test(message)) {
    return `I would start by finding the sentence with the most charge in this ${words}-word draft, then write toward it. The piece should feel discovered, not merely corrected.`;
  }
  if (/title|headline/i.test(message)) return 'A stronger title should name the concrete promise of the piece, not the process of writing it.';
  return `I read the current ${words}-word draft. Give me a paragraph or a mood you want protected, and I can mark the canvas with comments or help write into it.`;
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
  if (typeof payload.reviewPrompt === 'string') state.settings = normalizeSettings({ ...state.settings, reviewPrompt: payload.reviewPrompt });
  const runId = randomUUID();
  state.events.push(event('agent_run_started', 'agent', { runId, trigger: payload.trigger ?? 'manual' }));
  const modelRef = typeof payload.modelRef === 'string' && payload.modelRef.trim() ? payload.modelRef.trim() : undefined;
  const agentAnnotations = await buildAgentReviewAnnotations(state.markdown, runId, state.settings, ctx, modelRef);
  const annotations = agentAnnotations.length > 0 ? agentAnnotations : buildReviewAnnotations(state.markdown, runId, state.settings);
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
  markdown: string;
  annotations: Annotation[];
  documents: DocumentSummary[];
}> {
  const state = await readState(ctx, readDocumentId(input));
  const index = await readIndex(ctx);
  return { documentId: state.id, title: state.title, markdown: state.markdown, annotations: state.annotations, documents: index.documents };
}

export async function updateCanvas(input: unknown, ctx: ExtensionBackendContext): Promise<{ ok: true; document: DocumentSummary }> {
  const payload = input as { documentId?: string; markdown?: string; title?: string };
  if (typeof payload.markdown !== 'string') throw new Error('markdown is required.');
  const state = await readState(ctx, payload.documentId);
  state.markdown = payload.markdown;
  state.title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : titleFromMarkdown(state.markdown, state.title);
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
  const payload = input as { body?: string; markdown?: string; documentId?: string };
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!body) throw new Error('Chat message is required.');
  const state = await readState(ctx, payload.documentId);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  const userMessage: ChatMessage = { id: randomUUID(), role: 'user', body, createdAt: nowIso() };
  const agentMessage: ChatMessage = { id: randomUUID(), role: 'agent', body: chatReply(body, state.markdown), createdAt: nowIso() };
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
  const payload = input as { title?: string; markdown?: string };
  const markdown = typeof payload.markdown === 'string' ? payload.markdown : `# ${typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : 'Untitled'}\n\n`;
  const state = defaultState(randomUUID(), titleFromMarkdown(markdown, payload.title || 'Untitled'), markdown);
  state.events.push(event('yjs_update', 'user', { imported: false, markdownLength: markdown.length, clock: 0 }));
  await writeState(ctx, state);
  const index = await readIndex(ctx);
  return { ...state, documents: index.documents, activeDocumentId: state.id };
}

export async function importDocument(input: unknown, ctx: ExtensionBackendContext): Promise<StoredState & { documents: DocumentSummary[]; activeDocumentId: string }> {
  const payload = input as { title?: string; markdown?: string };
  if (typeof payload.markdown !== 'string') throw new Error('markdown is required.');
  const state = defaultState(randomUUID(), titleFromMarkdown(payload.markdown, payload.title || 'Imported draft'), payload.markdown);
  state.events.push(event('yjs_update', 'user', { imported: true, markdownLength: payload.markdown.length, clock: 0 }));
  await writeState(ctx, state);
  const index = await readIndex(ctx);
  return { ...state, documents: index.documents, activeDocumentId: state.id };
}

export async function saveDocument(input: unknown, ctx: ExtensionBackendContext): Promise<{ ok: true; document: DocumentSummary }> {
  const payload = input as { documentId?: string; markdown?: string; title?: string };
  const state = await readState(ctx, payload.documentId);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  state.title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : titleFromMarkdown(state.markdown, state.title);
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
  const safeTitle = (state.title || 'draft').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'draft';
  if (format === 'html') return { fileName: `${safeTitle}.html`, mimeType: 'text/html', content: documentHtml(state.title, state.markdown), encoding: 'text' };
  if (format === 'rtf') return { fileName: `${safeTitle}.rtf`, mimeType: 'application/rtf', content: `{\\rtf1\\ansi\n${rtfEscape(state.markdown)}}`, encoding: 'text' };
  if (format === 'docx') return { fileName: `${safeTitle}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: docx(state.title, state.markdown), encoding: 'base64' };
  return { fileName: `${safeTitle}.md`, mimeType: 'text/markdown', content: state.markdown, encoding: 'text' };
}
