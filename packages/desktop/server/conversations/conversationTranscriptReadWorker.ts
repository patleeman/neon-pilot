import { existsSync } from 'node:fs';
import { parentPort } from 'node:worker_threads';

import { readSessionBlocksByFileWithTelemetry, readSessionBlocksWithTelemetry } from './sessions.js';

interface WorkerRequest {
  id: number;
  conversationId: string;
  sessionFile?: string;
  tailBlocks?: number;
}

interface WorkerSuccess {
  id: number;
  ok: true;
  result: ReturnType<typeof readSessionBlocksWithTelemetry>;
}

interface WorkerError {
  id: number;
  ok: false;
  error: string;
}

function normalizeTailBlocks(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function readTranscriptDetail(input: WorkerRequest): ReturnType<typeof readSessionBlocksWithTelemetry> {
  const tailBlocks = normalizeTailBlocks(input.tailBlocks);
  const options = tailBlocks ? { tailBlocks } : undefined;
  const sessionFile = input.sessionFile?.trim();

  if (sessionFile && existsSync(sessionFile)) {
    const sessionRead = readSessionBlocksByFileWithTelemetry(sessionFile, options);
    if (tailBlocks && sessionRead.detail && sessionRead.detail.totalBlocks > 0 && sessionRead.detail.blocks.length === 0) {
      return readSessionBlocksByFileWithTelemetry(sessionFile);
    }
    return sessionRead;
  }

  const sessionRead = readSessionBlocksWithTelemetry(input.conversationId, options);
  if (tailBlocks && sessionRead.detail && sessionRead.detail.totalBlocks > 0 && sessionRead.detail.blocks.length === 0) {
    return readSessionBlocksWithTelemetry(input.conversationId);
  }
  return sessionRead;
}

if (!parentPort) {
  throw new Error('conversationTranscriptReadWorker must run as a worker thread.');
}

parentPort.on('message', (request: WorkerRequest) => {
  try {
    parentPort!.postMessage({
      id: request.id,
      ok: true,
      result: readTranscriptDetail(request),
    } satisfies WorkerSuccess);
  } catch (error) {
    parentPort!.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerError);
  }
});
