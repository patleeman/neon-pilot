import { existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

import type { SessionDetailRouteReadResult } from './conversationService.js';

type TranscriptReadResult = SessionDetailRouteReadResult;

interface WorkerRequest {
  id: number;
  conversationId: string;
  sessionFile?: string;
  tailBlocks?: number;
}

interface WorkerSuccess {
  id: number;
  ok: true;
  result: TranscriptReadResult;
}

interface WorkerError {
  id: number;
  ok: false;
  error: string;
}

type WorkerResponse = WorkerSuccess | WorkerError;

interface TranscriptReadJob {
  id: number;
  key: string;
  request: WorkerRequest;
  signal?: AbortSignal;
  resolve: (value: TranscriptReadResult) => void;
  reject: (error: Error) => void;
  abortListener?: () => void;
  settled: boolean;
}

const MAX_CONCURRENT_TRANSCRIPT_READS = 1;
let workerInstance: Worker | null = null;
let workerError: Error | null = null;
let nextRequestId = 0;
const queuedJobs: TranscriptReadJob[] = [];
const activeJobs = new Map<number, TranscriptReadJob>();

function createAbortError(): Error {
  const error = new Error('Transcript load cancelled');
  error.name = 'AbortError';
  return error;
}

function renderWorkerExitError(code: number | null): Error {
  return new Error(`Conversation transcript read worker exited unexpectedly${code === null ? '' : ` (code ${code})`}.`);
}

export function resolveConversationTranscriptReadWorkerUrlFrom(importMetaUrl: string): URL {
  const currentDir = dirname(fileURLToPath(importMetaUrl));
  const isTranspiledServerClient = currentDir.includes(`${sep}packages${sep}desktop${sep}dist${sep}server${sep}`);
  const relativeUrl = new URL('../conversations/conversationTranscriptReadWorker.js', importMetaUrl);

  if (!isTranspiledServerClient) {
    try {
      if (existsSync(fileURLToPath(relativeUrl))) {
        return relativeUrl;
      }
    } catch {
      // Keep walking fallbacks below.
    }
  }

  const packagedCandidates =
    typeof process.resourcesPath === 'string'
      ? [
          resolve(process.resourcesPath, 'app.asar.unpacked/server/dist/conversations/conversationTranscriptReadWorker.js'),
          resolve(process.resourcesPath, 'app/server/dist/conversations/conversationTranscriptReadWorker.js'),
          resolve(process.resourcesPath, 'server/dist/conversations/conversationTranscriptReadWorker.js'),
          resolve(process.resourcesPath, 'app.asar/server/dist/conversations/conversationTranscriptReadWorker.js'),
        ]
      : [];

  const candidates = [
    ...packagedCandidates,
    ...(process.env.NEON_PILOT_REPO_ROOT
      ? [resolve(process.env.NEON_PILOT_REPO_ROOT, 'packages/desktop/server/dist/conversations/conversationTranscriptReadWorker.js')]
      : []),
    resolve(process.cwd(), 'packages/desktop/server/dist/conversations/conversationTranscriptReadWorker.js'),
    resolve(currentDir, '../../packages/desktop/server/dist/conversations/conversationTranscriptReadWorker.js'),
    resolve(currentDir, '../../../packages/desktop/server/dist/conversations/conversationTranscriptReadWorker.js'),
    resolve(currentDir, '../server/dist/conversations/conversationTranscriptReadWorker.js'),
    resolve(currentDir, 'server/dist/conversations/conversationTranscriptReadWorker.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return pathToFileURL(candidate);
    }
  }

  return relativeUrl;
}

function resolveConversationTranscriptReadWorkerUrl(): URL {
  return resolveConversationTranscriptReadWorkerUrlFrom(import.meta.url);
}

function getOrCreateWorker(): Worker {
  if (workerInstance) {
    return workerInstance;
  }

  workerError = null;
  const worker = new Worker(resolveConversationTranscriptReadWorkerUrl(), { execArgv: [] });
  worker.on('message', handleWorkerMessage);
  worker.on('error', handleWorkerError);
  worker.on('exit', handleWorkerExit);
  workerInstance = worker;
  return worker;
}

function settleJob(job: TranscriptReadJob, callback: () => void): void {
  if (job.settled) {
    return;
  }

  job.settled = true;
  if (job.abortListener && job.signal) {
    job.signal.removeEventListener('abort', job.abortListener);
  }
  callback();
}

function rejectJob(job: TranscriptReadJob, error: Error): void {
  settleJob(job, () => job.reject(error));
}

function resolveJob(job: TranscriptReadJob, value: TranscriptReadResult): void {
  settleJob(job, () => job.resolve(value));
}

function handleWorkerMessage(response: WorkerResponse): void {
  const job = activeJobs.get(response.id);
  if (!job) {
    return;
  }

  activeJobs.delete(response.id);
  if (response.ok) {
    resolveJob(job, response.result);
  } else {
    rejectJob(job, new Error(response.error));
  }
  processQueue();
}

function handleWorkerError(error: Error): void {
  workerError = error;
  const active = [...activeJobs.values()];
  activeJobs.clear();
  for (const job of active) {
    rejectJob(job, error);
  }
  workerInstance = null;
  processQueue();
}

function handleWorkerExit(code: number): void {
  if (code !== 0) {
    const error = workerError ?? renderWorkerExitError(code);
    workerError = error;
    const active = [...activeJobs.values()];
    activeJobs.clear();
    for (const job of active) {
      rejectJob(job, error);
    }
  }
  workerInstance = null;
  processQueue();
}

async function terminateWorkerForAbort(): Promise<void> {
  const worker = workerInstance;
  workerInstance = null;
  if (worker) {
    worker.off('message', handleWorkerMessage);
    worker.off('error', handleWorkerError);
    worker.off('exit', handleWorkerExit);
    await worker.terminate().catch(() => undefined);
  }
}

function abortJob(job: TranscriptReadJob): void {
  const queuedIndex = queuedJobs.findIndex((candidate) => candidate.id === job.id);
  if (queuedIndex >= 0) {
    queuedJobs.splice(queuedIndex, 1);
    rejectJob(job, createAbortError());
    return;
  }

  if (!activeJobs.has(job.id)) {
    rejectJob(job, createAbortError());
    return;
  }

  activeJobs.delete(job.id);
  rejectJob(job, createAbortError());
  void terminateWorkerForAbort().finally(() => {
    processQueue();
  });
}

function processQueue(): void {
  if (activeJobs.size >= MAX_CONCURRENT_TRANSCRIPT_READS) {
    return;
  }

  while (queuedJobs.length > 0 && activeJobs.size < MAX_CONCURRENT_TRANSCRIPT_READS) {
    const job = queuedJobs.shift()!;
    if (job.signal?.aborted) {
      rejectJob(job, createAbortError());
      continue;
    }

    try {
      const worker = getOrCreateWorker();
      activeJobs.set(job.id, job);
      worker.postMessage(job.request);
    } catch (error) {
      activeJobs.delete(job.id);
      rejectJob(job, error instanceof Error ? error : new Error(String(error)));
    }
  }
}

function buildTranscriptReadKey(input: { conversationId: string; sessionFile?: string; tailBlocks?: number }): string {
  return `${input.sessionFile?.trim() || input.conversationId.trim()}::${input.tailBlocks ?? 'all'}`;
}

export function readConversationTranscriptDetailInWorker(input: {
  conversationId: string;
  sessionFile?: string;
  tailBlocks?: number;
  signal?: AbortSignal;
}): Promise<TranscriptReadResult> {
  if (input.signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  if (workerError && workerInstance) {
    return Promise.reject(new Error(`Conversation transcript read worker is unavailable: ${workerError.message}`));
  }

  const key = buildTranscriptReadKey(input);
  const existing = [...activeJobs.values(), ...queuedJobs].find((job) => job.key === key && !job.settled);
  if (existing) {
    return new Promise<TranscriptReadResult>((resolve, reject) => {
      const joinedJob: TranscriptReadJob = {
        id: existing.id,
        key,
        request: existing.request,
        signal: input.signal,
        resolve,
        reject,
        settled: false,
      };
      const abortListener = () => rejectJob(joinedJob, createAbortError());
      joinedJob.abortListener = abortListener;
      input.signal?.addEventListener('abort', abortListener, { once: true });
      existing.resolve = ((previousResolve) => (value) => {
        previousResolve(value);
        resolveJob(joinedJob, value);
      })(existing.resolve);
      existing.reject = ((previousReject) => (error) => {
        previousReject(error);
        rejectJob(joinedJob, error);
      })(existing.reject);
    });
  }

  return new Promise<TranscriptReadResult>((resolve, reject) => {
    const id = ++nextRequestId;
    const job: TranscriptReadJob = {
      id,
      key,
      request: {
        id,
        conversationId: input.conversationId,
        ...(input.sessionFile ? { sessionFile: input.sessionFile } : {}),
        ...(input.tailBlocks ? { tailBlocks: input.tailBlocks } : {}),
      },
      signal: input.signal,
      resolve,
      reject,
      settled: false,
    };
    const abortListener = () => abortJob(job);
    job.abortListener = abortListener;
    input.signal?.addEventListener('abort', abortListener, { once: true });
    queuedJobs.push(job);
    processQueue();
  });
}

export async function closeConversationTranscriptReadWorker(): Promise<void> {
  const abortError = createAbortError();
  const pending = [...queuedJobs, ...activeJobs.values()];
  queuedJobs.length = 0;
  activeJobs.clear();
  for (const job of pending) {
    rejectJob(job, abortError);
  }
  await terminateWorkerForAbort();
  workerError = null;
}
