/**
 * Trace Worker
 *
 * Runs all trace-db writes off the Electron main thread.
 * Receives fire-and-forget write messages via postMessage.
 * Never sends responses — callers don't await.
 */

import { parentPort } from 'node:worker_threads';

import type { DesktopRootLayout } from '@neon-pilot/core';
import {
  writeTraceAutoMode,
  writeTraceCompaction,
  writeTraceContext,
  writeTraceContextPointerInspect,
  writeTraceStats,
  writeTraceSuggestedContext,
  writeTraceToolCall,
} from '@neon-pilot/core';

export interface TraceWorkerMessageBase {
  layout?: DesktopRootLayout;
}

export type TraceWorkerMessage =
  | ({ type: 'stats'; layout?: DesktopRootLayout } & Omit<Parameters<typeof writeTraceStats>[0], 'layout'>)
  | ({ type: 'tool_call'; layout?: DesktopRootLayout } & Omit<Parameters<typeof writeTraceToolCall>[0], 'layout'>)
  | ({ type: 'context'; layout?: DesktopRootLayout } & Omit<Parameters<typeof writeTraceContext>[0], 'layout'>)
  | ({ type: 'compaction'; layout?: DesktopRootLayout } & Omit<Parameters<typeof writeTraceCompaction>[0], 'layout'>)
  | ({ type: 'auto_mode'; layout?: DesktopRootLayout } & Omit<Parameters<typeof writeTraceAutoMode>[0], 'layout'>)
  | ({ type: 'suggested_context'; layout?: DesktopRootLayout } & Omit<Parameters<typeof writeTraceSuggestedContext>[0], 'layout'>)
  | ({ type: 'context_pointer_inspect'; layout?: DesktopRootLayout } & Omit<
      Parameters<typeof writeTraceContextPointerInspect>[0],
      'layout'
    >);

if (!parentPort) {
  throw new Error('traceWorker must run as a worker thread.');
}

parentPort.on('message', (msg: TraceWorkerMessage) => {
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
  } catch {
    // Fire-and-forget: swallow all write failures
  }
});
