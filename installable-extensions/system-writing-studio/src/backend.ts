import { randomUUID } from 'node:crypto';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

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

interface StoredState {
  title: string;
  markdown: string;
  updateClock: number;
  events: WritingEvent[];
  annotations: Annotation[];
  chat: ChatMessage[];
  lastAgentRunAt: string | null;
}

const STATE_KEY = 'documents/default';

const seedMarkdown = `# Draft

Start writing here. The agent will keep the document in focus and add comments, suggestions, or reactions in the margin.
`;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultState(): StoredState {
  return {
    title: 'Draft',
    markdown: seedMarkdown,
    updateClock: 0,
    events: [],
    annotations: [],
    chat: [],
    lastAgentRunAt: null,
  };
}

async function readState(ctx: ExtensionBackendContext): Promise<StoredState> {
  const stored = await ctx.storage.get<StoredState>(STATE_KEY).catch(() => null);
  if (!stored || typeof stored !== 'object') return defaultState();
  return {
    ...defaultState(),
    ...stored,
    events: Array.isArray(stored.events) ? stored.events : [],
    annotations: Array.isArray(stored.annotations) ? stored.annotations : [],
    chat: Array.isArray(stored.chat) ? stored.chat : [],
  };
}

async function writeState(ctx: ExtensionBackendContext, state: StoredState): Promise<void> {
  await ctx.storage.put(STATE_KEY, state);
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

function buildReviewAnnotations(markdown: string, runId: string): Annotation[] {
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
      body: 'This sentence is carrying a lot. Consider splitting it so the argument lands in two clean beats.',
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
      body: 'This wording softens the claim. Keep it only if uncertainty is intentional.',
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
      body: 'This line has momentum.',
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
      body: 'The draft is still short. Add the specific reader outcome you want this section to create.',
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

function chatReply(message: string, markdown: string): string {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  if (/rewrite|revise|improve/i.test(message)) {
    return `I would start by tightening the current ${words}-word draft around one claim, then turn the supporting detail into a separate paragraph.`;
  }
  if (/title|headline/i.test(message)) return 'A stronger title should name the concrete promise of the piece, not the process of writing it.';
  return `I read the current ${words}-word draft. The next useful move is to make the main claim explicit, then ask me to review a specific paragraph.`;
}

export async function load(_input: unknown, ctx: ExtensionBackendContext): Promise<StoredState> {
  return readState(ctx);
}

export async function appendUpdate(input: unknown, ctx: ExtensionBackendContext): Promise<{ ok: true; clock: number }> {
  const payload = input as { updateBase64?: string; markdown?: string; actorId?: string };
  if (!payload.updateBase64 || typeof payload.updateBase64 !== 'string') throw new Error('updateBase64 is required.');
  if (typeof payload.markdown !== 'string') throw new Error('markdown is required.');
  const state = await readState(ctx);
  state.markdown = payload.markdown;
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
  const payload = input as { markdown?: string; trigger?: string };
  const state = await readState(ctx);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  const runId = randomUUID();
  state.events.push(event('agent_run_started', 'agent', { runId, trigger: payload.trigger ?? 'manual' }));
  const annotations = buildReviewAnnotations(state.markdown, runId).filter(
    (candidate) => !state.annotations.some((existing) => existing.status === 'open' && existing.quote === candidate.quote && existing.body === candidate.body),
  );
  state.annotations.unshift(...annotations);
  for (const annotation of annotations) state.events.push(event('annotation_added', 'agent', { annotation }));
  state.lastAgentRunAt = nowIso();
  state.events.push(event('agent_run_completed', 'agent', { runId, annotationCount: annotations.length }));
  await writeState(ctx, state);
  return { annotations, runId };
}

export async function sendChat(input: unknown, ctx: ExtensionBackendContext): Promise<{ messages: ChatMessage[] }> {
  const payload = input as { body?: string; markdown?: string };
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!body) throw new Error('Chat message is required.');
  const state = await readState(ctx);
  if (typeof payload.markdown === 'string') state.markdown = payload.markdown;
  const userMessage: ChatMessage = { id: randomUUID(), role: 'user', body, createdAt: nowIso() };
  const agentMessage: ChatMessage = { id: randomUUID(), role: 'agent', body: chatReply(body, state.markdown), createdAt: nowIso() };
  state.chat.push(userMessage, agentMessage);
  state.events.push(event('chat_message', 'user', { message: userMessage }), event('chat_message', 'agent', { message: agentMessage }));
  await writeState(ctx, state);
  return { messages: state.chat };
}

export async function resolveAnnotation(input: unknown, ctx: ExtensionBackendContext): Promise<{ annotations: Annotation[] }> {
  const payload = input as { id?: string };
  if (!payload.id) throw new Error('Annotation id is required.');
  const state = await readState(ctx);
  state.annotations = state.annotations.map((annotation) =>
    annotation.id === payload.id ? { ...annotation, status: 'resolved' as const } : annotation,
  );
  state.events.push(event('annotation_resolved', 'user', { annotationId: payload.id }));
  await writeState(ctx, state);
  return { annotations: state.annotations };
}
