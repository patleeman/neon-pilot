import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

export type ParallelPromptJobStatus = 'running' | 'ready' | 'failed' | 'importing';

/**
 * Narrow, non-persona role for parallel prompt workers. Caller-provided job
 * metadata cannot override this: normalization always forces it to `worker`.
 */
export type ParallelPromptWorkerRole = 'worker';

export interface ParallelPromptPreview {
  id: string;
  prompt: string;
  childConversationId: string;
  status: ParallelPromptJobStatus;
  workerRole: ParallelPromptWorkerRole;
  workerName: string;
  ownerExtensionId?: string;
  purpose?: string;
  modelRef?: string;
  imageCount: number;
  attachmentRefs: string[];
  touchedFiles: string[];
  parentTouchedFiles: string[];
  overlapFiles: string[];
  sideEffects: string[];
  resultPreview?: string;
  error?: string;
}

export interface ParallelPromptJob {
  id: string;
  prompt: string;
  childConversationId: string;
  childSessionFile?: string;
  status: ParallelPromptJobStatus;
  /** Always `worker` for parallel prompt jobs; ignored from untrusted input. */
  workerRole?: ParallelPromptWorkerRole;
  /** Stable human-readable worker name. Generated if absent on persisted jobs. */
  workerName?: string;
  ownerExtensionId?: string;
  purpose?: string;
  modelRef?: string;
  metadata?: Record<string, unknown>;
  autoImport?: boolean;
  createdAt: string;
  updatedAt: string;
  imageCount: number;
  attachmentRefs: string[];
  touchedFiles: string[];
  parentTouchedFiles: string[];
  overlapFiles: string[];
  sideEffects: string[];
  forkEntryId?: string;
  repoRoot?: string;
  worktreeDirtyPathsAtStart: string[];
  resultText?: string;
  error?: string;
}

const PARALLEL_JOBS_FILE_SUFFIX = '.parallel.json';
const PARALLEL_PREVIEW_PATH_LIMIT = 5;
const PARALLEL_PREVIEW_ATTACHMENT_LIMIT = 4;
const PARALLEL_PREVIEW_SIDE_EFFECT_LIMIT = 3;
const MAX_PARALLEL_PROMPT_IMAGE_COUNT = 100;
const PARALLEL_WORKER_NAME_LABEL_MAX = 28;
const PARALLEL_WORKER_NAME_HASH_LENGTH = 5;
const PARALLEL_WORKER_NAME_FALLBACK = 'Worker';

export function resolveParallelJobsFile(sessionFile: string): string {
  return `${sessionFile}${PARALLEL_JOBS_FILE_SUFFIX}`;
}

function hashSeedToHex(seed: string, length: number): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').slice(0, length);
}

function deriveParallelWorkerLabel(input: { prompt: string; purpose?: string }): string {
  const source = (input.purpose && input.purpose.trim()) || input.prompt || '';
  const collapsed = source.replace(/\s+/g, ' ').trim();
  if (!collapsed) return PARALLEL_WORKER_NAME_FALLBACK;
  const words = collapsed.split(' ').slice(0, 4).join(' ');
  if (words.length <= PARALLEL_WORKER_NAME_LABEL_MAX) {
    return words || PARALLEL_WORKER_NAME_FALLBACK;
  }
  const trimmed = words.slice(0, PARALLEL_WORKER_NAME_LABEL_MAX - 1).trimEnd();
  return trimmed || PARALLEL_WORKER_NAME_FALLBACK;
}

/**
 * Deterministic, non-persona worker name for a parallel prompt job. Seeds on
 * `childConversationId`, `purpose`, `prompt`, and `id` so the same job always
 * produces the same name (stable across reload/re-normalization) while sibling
 * workers stay distinct via a short hash suffix.
 */
export function generateParallelWorkerName(input: { id: string; prompt: string; childConversationId: string; purpose?: string }): string {
  const seed = `${input.childConversationId}|${input.purpose ?? ''}|${input.prompt}|${input.id}`;
  const hash = hashSeedToHex(seed, PARALLEL_WORKER_NAME_HASH_LENGTH);
  const label = deriveParallelWorkerLabel(input);
  return `${label} ${hash}`;
}

function resolveWorkerName(job: {
  id: string;
  prompt: string;
  childConversationId: string;
  purpose?: string;
  workerName?: string;
}): string {
  const existing = typeof job.workerName === 'string' ? job.workerName.trim() : '';
  if (existing) return existing;
  return generateParallelWorkerName(job);
}

function normalizeParallelPromptJobStatus(value: unknown): ParallelPromptJobStatus {
  return value === 'ready' || value === 'failed' || value === 'importing' ? value : 'running';
}

function normalizeParallelPromptImageCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_PARALLEL_PROMPT_IMAGE_COUNT ? value : 0;
}

export function normalizeParallelPromptList(value: unknown, limit = 32): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const next: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const normalized = candidate.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    next.push(normalized);
    if (next.length >= limit) {
      break;
    }
  }

  return next;
}

function normalizeParallelPromptJob(candidate: unknown): ParallelPromptJob | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const job = candidate as Partial<ParallelPromptJob>;
  const id = typeof job.id === 'string' ? job.id.trim() : '';
  const prompt = typeof job.prompt === 'string' ? job.prompt : '';
  const childConversationId = typeof job.childConversationId === 'string' ? job.childConversationId.trim() : '';
  if (!id || !childConversationId) {
    return null;
  }

  const createdAt = typeof job.createdAt === 'string' && job.createdAt.trim().length > 0 ? job.createdAt.trim() : new Date().toISOString();
  const updatedAt = typeof job.updatedAt === 'string' && job.updatedAt.trim().length > 0 ? job.updatedAt.trim() : createdAt;
  const childSessionFile =
    typeof job.childSessionFile === 'string' && job.childSessionFile.trim().length > 0 ? job.childSessionFile.trim() : undefined;
  const forkEntryId = typeof job.forkEntryId === 'string' && job.forkEntryId.trim().length > 0 ? job.forkEntryId.trim() : undefined;
  const repoRoot = typeof job.repoRoot === 'string' && job.repoRoot.trim().length > 0 ? job.repoRoot.trim() : undefined;
  const ownerExtensionId =
    typeof job.ownerExtensionId === 'string' && job.ownerExtensionId.trim().length > 0 ? job.ownerExtensionId.trim() : undefined;
  const purpose = typeof job.purpose === 'string' && job.purpose.trim().length > 0 ? job.purpose.trim() : undefined;
  const modelRef = typeof job.modelRef === 'string' && job.modelRef.trim().length > 0 ? job.modelRef.trim() : undefined;
  const metadata =
    job.metadata && typeof job.metadata === 'object' && !Array.isArray(job.metadata)
      ? (job.metadata as Record<string, unknown>)
      : undefined;

  return {
    id,
    prompt,
    childConversationId,
    ...(childSessionFile ? { childSessionFile } : {}),
    status: normalizeParallelPromptJobStatus(job.status),
    // Caller metadata cannot spoof persona vs worker: always force `worker`.
    workerRole: 'worker',
    workerName: resolveWorkerName({ id, prompt, childConversationId, purpose, workerName: job.workerName }),
    ...(ownerExtensionId ? { ownerExtensionId } : {}),
    ...(purpose ? { purpose } : {}),
    ...(modelRef ? { modelRef } : {}),
    ...(metadata ? { metadata } : {}),
    autoImport: job.autoImport === false ? false : true,
    createdAt,
    updatedAt,
    imageCount: normalizeParallelPromptImageCount(job.imageCount),
    attachmentRefs: normalizeParallelPromptList(job.attachmentRefs, 12),
    touchedFiles: normalizeParallelPromptList(job.touchedFiles, 24),
    parentTouchedFiles: normalizeParallelPromptList(job.parentTouchedFiles, 24),
    overlapFiles: normalizeParallelPromptList(job.overlapFiles, 24),
    sideEffects: normalizeParallelPromptList(job.sideEffects, 12),
    ...(forkEntryId ? { forkEntryId } : {}),
    ...(repoRoot ? { repoRoot } : {}),
    worktreeDirtyPathsAtStart: normalizeParallelPromptList(job.worktreeDirtyPathsAtStart, 128),
    ...(typeof job.resultText === 'string' && job.resultText.trim().length > 0 ? { resultText: job.resultText } : {}),
    ...(typeof job.error === 'string' && job.error.trim().length > 0 ? { error: job.error.trim() } : {}),
  };
}

export function readPersistedParallelJobs(sessionFile: string): ParallelPromptJob[] {
  const jobsFile = resolveParallelJobsFile(sessionFile);
  if (!existsSync(jobsFile)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(jobsFile, 'utf-8')) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((candidate): ParallelPromptJob[] => {
      const normalized = normalizeParallelPromptJob(candidate);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
}

export function writePersistedParallelJobs(sessionFile: string, jobs: ParallelPromptJob[]): void {
  const jobsFile = resolveParallelJobsFile(sessionFile);
  if (jobs.length === 0) {
    if (existsSync(jobsFile)) {
      unlinkSync(jobsFile);
    }
    return;
  }

  writeFileSync(jobsFile, `${JSON.stringify(jobs, null, 2)}\n`);
}

export function truncateParallelPreviewText(text: string, maxLength = 240): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : normalized;
}

function buildParallelPromptPreview(job: ParallelPromptJob): ParallelPromptPreview {
  const attachmentRefs = Array.isArray(job.attachmentRefs) ? job.attachmentRefs : [];
  const touchedFiles = Array.isArray(job.touchedFiles) ? job.touchedFiles : [];
  const parentTouchedFiles = Array.isArray(job.parentTouchedFiles) ? job.parentTouchedFiles : [];
  const overlapFiles = Array.isArray(job.overlapFiles) ? job.overlapFiles : [];
  const sideEffects = Array.isArray(job.sideEffects) ? job.sideEffects : [];
  return {
    id: job.id,
    prompt: truncateParallelPreviewText(job.prompt),
    childConversationId: job.childConversationId,
    status: job.status,
    workerRole: 'worker',
    workerName: resolveWorkerName(job),
    ...(job.ownerExtensionId ? { ownerExtensionId: job.ownerExtensionId } : {}),
    ...(job.purpose ? { purpose: job.purpose } : {}),
    ...(job.modelRef ? { modelRef: job.modelRef } : {}),
    imageCount: normalizeParallelPromptImageCount(job.imageCount),
    attachmentRefs: attachmentRefs.slice(0, PARALLEL_PREVIEW_ATTACHMENT_LIMIT),
    touchedFiles: touchedFiles.slice(0, PARALLEL_PREVIEW_PATH_LIMIT),
    parentTouchedFiles: parentTouchedFiles.slice(0, PARALLEL_PREVIEW_PATH_LIMIT),
    overlapFiles: overlapFiles.slice(0, PARALLEL_PREVIEW_PATH_LIMIT),
    sideEffects: sideEffects.slice(0, PARALLEL_PREVIEW_SIDE_EFFECT_LIMIT),
    ...(job.resultText ? { resultPreview: truncateParallelPreviewText(job.resultText) } : {}),
    ...(job.error ? { error: truncateParallelPreviewText(job.error) } : {}),
  };
}

export function readParallelState(jobs: ParallelPromptJob[] | undefined): ParallelPromptPreview[] {
  return (Array.isArray(jobs) ? jobs : []).map((job) => buildParallelPromptPreview(job));
}
