import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getDurableMemoryRoot, getKnowledgeRoot } from '@neon-pilot/core';
import { parseDocument, stringify as stringifyYaml } from 'yaml';

import { readConversationSessionMeta } from '../conversations/conversationService.js';
import { readConversationSummary } from '../conversations/conversationSummaries.js';
import { type LiveSessionLifecycleEvent, registerLiveSessionLifecycleHandler } from '../conversations/liveSessionLifecycle.js';
import type { SessionMeta } from '../conversations/sessions.js';
import { logError } from '../shared/logging.js';
import { writeMemoryFile } from './memoryStore.js';

export type MemoryReflectionTrigger = 'turn_end' | 'auto_compaction_end' | 'close' | 'archive';

export interface MemoryReflectionEvent {
  conversationId: string;
  title?: string;
  cwd?: string;
  trigger: MemoryReflectionTrigger;
}

interface MemoryReflectionJob extends MemoryReflectionEvent {
  queuedAtMs: number;
}

const TURN_END_COOLDOWN_MS = 30 * 60 * 1000;

const pending = new Map<string, MemoryReflectionJob>();
const recentTurnEndQueues = new Map<string, number>();
let activeJob: Promise<void> | null = null;
let lifecycleRegistered = false;

function memoryRoot(): string {
  return getDurableMemoryRoot(getKnowledgeRoot());
}

function reflectionPathForConversation(conversationId: string): string {
  const slug =
    conversationId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96) || 'conversation';
  return `reflections/${slug}.md`;
}

function readStoredFingerprint(relativePath: string): string | null {
  const filePath = join(memoryRoot(), relativePath);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const document = parseDocument(match[1] ?? '', { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) return null;
  const data = document.toJS() as unknown;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const fingerprint = (data as { fingerprint?: unknown }).fingerprint;
  return typeof fingerprint === 'string' && fingerprint.trim() ? fingerprint.trim() : null;
}

function stringifyMarkdown(data: Record<string, unknown>, body: string): string {
  const frontmatter = stringifyYaml(data, { lineWidth: 0, indent: 2, minContentWidth: 0 }).trimEnd();
  return `---\n${frontmatter}\n---\n\n${body.trim()}\n`;
}

function fallbackFingerprint(meta: SessionMeta): string {
  return [meta.file, meta.messageCount, meta.lastActivityAt ?? meta.timestamp].filter(Boolean).join(':');
}

function buildReflectionBody(input: {
  event: MemoryReflectionJob;
  meta: SessionMeta;
  summary: ReturnType<typeof readConversationSummary>;
}): string {
  const title = input.summary?.title || input.meta.title || input.event.title || input.event.conversationId;
  const lines = [
    `# Reflection Draft: ${title}`,
    '',
    `- Conversation: ${input.event.conversationId}`,
    `- Trigger: ${input.event.trigger}`,
    `- Working directory: ${input.summary?.cwd || input.meta.cwd || input.event.cwd || 'unknown'}`,
  ];

  if (input.summary) {
    lines.push(
      '',
      '## Conversation Summary',
      '',
      input.summary.displaySummary || input.summary.promptSummary || 'No summary text available.',
      '',
      '## Outcome',
      '',
      input.summary.outcome || 'No outcome recorded.',
      '',
      '## Candidate Memory Updates',
      '',
      '- Review whether any stable user preference belongs in `memory/system.md`.',
      '- Review whether any repository-specific behavior belongs in an active scope.',
      '- Keep reference-only material out of injected memory.',
    );
    if (input.summary.keyTerms.length > 0) {
      lines.push('', `Key terms: ${input.summary.keyTerms.join(', ')}`);
    }
    if (input.summary.filesTouched.length > 0) {
      lines.push('', `Files touched: ${input.summary.filesTouched.join(', ')}`);
    }
  } else {
    lines.push(
      '',
      '## Candidate Memory Updates',
      '',
      'No conversation summary was available when reflection ran. Re-run reflection after summary indexing if this conversation contains durable preferences or project facts.',
    );
  }

  return lines.join('\n');
}

async function runReflectionJob(job: MemoryReflectionJob): Promise<void> {
  const meta = readConversationSessionMeta(job.conversationId);
  if (!meta) return;
  const summary = readConversationSummary(job.conversationId);
  const fingerprint = summary?.fingerprint || fallbackFingerprint(meta);
  if (!fingerprint) return;

  const relativePath = reflectionPathForConversation(job.conversationId);
  if (readStoredFingerprint(relativePath) === fingerprint) return;

  const content = stringifyMarkdown(
    {
      conversationId: job.conversationId,
      title: summary?.title || meta.title || job.title || job.conversationId,
      cwd: summary?.cwd || meta.cwd || job.cwd || '',
      trigger: job.trigger,
      fingerprint,
      inject: false,
      reflectedAt: new Date().toISOString(),
    },
    buildReflectionBody({ event: job, meta, summary }),
  );

  await writeMemoryFile({
    relativePath,
    content,
    reason: `Reflect on ${summary?.title || meta.title || job.conversationId}`,
  });
}

function drain(): void {
  if (activeJob || pending.size === 0) return;
  const [key, job] = pending.entries().next().value as [string, MemoryReflectionJob];
  pending.delete(key);
  activeJob = runReflectionJob(job)
    .catch((error) => {
      logError('memory reflection job failed', {
        conversationId: job.conversationId,
        trigger: job.trigger,
        message: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      activeJob = null;
      drain();
    });
}

export function queueMemoryReflection(event: MemoryReflectionEvent, nowMs = Date.now()): boolean {
  const conversationId = event.conversationId.trim();
  if (!conversationId) return false;
  if (event.trigger === 'turn_end') {
    const lastQueuedAt = recentTurnEndQueues.get(conversationId);
    if (lastQueuedAt !== undefined && nowMs - lastQueuedAt < TURN_END_COOLDOWN_MS) return false;
    recentTurnEndQueues.set(conversationId, nowMs);
  }

  pending.set(conversationId, { ...event, conversationId, queuedAtMs: nowMs });
  drain();
  return true;
}

export function queueMemoryReflectionForConversationOperation(input: { conversationId?: unknown; operation?: unknown }): boolean {
  if (input.operation !== 'close' && input.operation !== 'archive') return false;
  if (typeof input.conversationId !== 'string') return false;
  const meta = readConversationSessionMeta(input.conversationId);
  return queueMemoryReflection({
    conversationId: input.conversationId,
    title: meta?.title,
    cwd: meta?.cwd,
    trigger: input.operation,
  });
}

export function registerMemoryReflectionLifecycleHandler(): void {
  if (lifecycleRegistered) return;
  lifecycleRegistered = true;
  registerLiveSessionLifecycleHandler((event: LiveSessionLifecycleEvent) => {
    queueMemoryReflection({
      conversationId: event.conversationId,
      title: event.title,
      cwd: event.cwd,
      trigger: event.trigger,
    });
  });
}

export async function drainMemoryReflectionQueueForTests(): Promise<void> {
  while (activeJob || pending.size > 0) {
    if (activeJob) await activeJob;
    drain();
  }
}

export function resetMemoryReflectionQueueForTests(): void {
  pending.clear();
  recentTurnEndQueues.clear();
  activeJob = null;
  lifecycleRegistered = false;
}
