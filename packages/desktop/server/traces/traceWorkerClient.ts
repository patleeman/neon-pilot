/**
 * Trace Worker Client
 *
 * Manages the singleton trace worker thread and routes all write calls
 * to it via fire-and-forget postMessage. The main thread never blocks
 * on trace writes.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import {
  writeTraceAutoMode,
  writeTraceCompaction,
  writeTraceContext,
  writeTraceContextPointerInspect,
  writeTraceStats,
  writeTraceSuggestedContext,
  writeTraceToolCall,
} from '@neon-pilot/core';

import type { TraceWorkerMessage } from './traceWorker.js';

let workerInstance: Worker | null = null;
let useDirectWrites = false;

function resolveTraceWorkerUrl(): URL {
  const candidates = [
    new URL('./traceWorker.js', import.meta.url),
    // Bundled backend children live under dist/backend or dist/chunks while the
    // worker is emitted under dist/server/traces.
    new URL('../server/traces/traceWorker.js', import.meta.url),
    new URL('../traces/traceWorker.js', import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      if (candidate.protocol === 'file:' && existsSync(fileURLToPath(candidate))) {
        return candidate;
      }
    } catch {
      // Try the next layout.
    }
  }
  return candidates[0];
}

function resolveTraceWorkerExecArgv(): string[] {
  return process.execArgv.filter((arg) => arg !== '--input-type=module' && arg !== '--input-type=commonjs');
}

function getOrCreateWorker(): Worker {
  if (workerInstance) {
    return workerInstance;
  }

  const worker = new Worker(resolveTraceWorkerUrl(), { execArgv: resolveTraceWorkerExecArgv() });

  worker.on('error', (error) => {
    console.error('[telemetry] trace worker failed; falling back to direct trace writes', error);
    workerInstance = null;
    useDirectWrites = true;
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error('[telemetry] trace worker exited unexpectedly; falling back to direct trace writes', { code });
      workerInstance = null;
      useDirectWrites = true;
    }
  });

  workerInstance = worker;
  return worker;
}

function writeDirect(msg: TraceWorkerMessage): void {
  setImmediate(() => {
    try {
      switch (msg.type) {
        case 'stats':
          writeTraceStats(msg);
          break;
        case 'tool_call':
          writeTraceToolCall(msg);
          break;
        case 'context':
          writeTraceContext(msg);
          break;
        case 'compaction':
          writeTraceCompaction(msg);
          break;
        case 'auto_mode':
          writeTraceAutoMode(msg);
          break;
        case 'suggested_context':
          writeTraceSuggestedContext(msg);
          break;
        case 'context_pointer_inspect':
          writeTraceContextPointerInspect(msg);
          break;
      }
    } catch (error) {
      console.error('[telemetry] direct trace write failed', error);
    }
  });
}

function send(msg: TraceWorkerMessage): void {
  if (useDirectWrites) {
    writeDirect(msg);
    return;
  }

  try {
    getOrCreateWorker().postMessage(msg);
  } catch (error) {
    console.error('[telemetry] trace worker unavailable; falling back to direct trace write', error);
    useDirectWrites = true;
    writeDirect(msg);
  }
}

export function traceWorkerStats(params: Omit<TraceWorkerMessage & { type: 'stats' }, 'type'>): void {
  send({ type: 'stats', ...params });
}

export function traceWorkerToolCall(params: Omit<TraceWorkerMessage & { type: 'tool_call' }, 'type'>): void {
  send({ type: 'tool_call', ...params });
}

export function traceWorkerContext(params: Omit<TraceWorkerMessage & { type: 'context' }, 'type'>): void {
  send({ type: 'context', ...params });
}

export function traceWorkerCompaction(params: Omit<TraceWorkerMessage & { type: 'compaction' }, 'type'>): void {
  send({ type: 'compaction', ...params });
}

export function traceWorkerAutoMode(params: Omit<TraceWorkerMessage & { type: 'auto_mode' }, 'type'>): void {
  send({ type: 'auto_mode', ...params });
}

export function traceWorkerSuggestedContext(params: Omit<TraceWorkerMessage & { type: 'suggested_context' }, 'type'>): void {
  send({ type: 'suggested_context', ...params });
}

export function traceWorkerContextPointerInspect(params: Omit<TraceWorkerMessage & { type: 'context_pointer_inspect' }, 'type'>): void {
  send({ type: 'context_pointer_inspect', ...params });
}

export function closeTraceWorker(): void {
  if (workerInstance) {
    void workerInstance.terminate();
    workerInstance = null;
  }
}
