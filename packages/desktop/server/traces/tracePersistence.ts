/**
 * Trace Persistence Hooks
 *
 * Wires trace-db writes into live session events.
 * All writes are dispatched to the trace worker thread — never blocks the session loop.
 */

import type { DesktopRootLayout } from '@neon-pilot/core';

import {
  traceWorkerAutoMode,
  traceWorkerCompaction,
  traceWorkerContext,
  traceWorkerContextPointerInspect,
  traceWorkerStats,
  traceWorkerSuggestedContext,
  traceWorkerToolCall,
} from './traceWorkerClient.js';

// ── Stats hook ────────────────────────────────────────────────────────────────

export function persistTraceStats(params: {
  sessionId: string;
  runId?: string;
  modelId?: string;
  tokensInput: number;
  tokensOutput: number;
  tokensCachedInput?: number;
  tokensCachedWrite?: number;
  cost: number;
  turnCount?: number;
  stepCount?: number;
  durationMs?: number;
  layout?: DesktopRootLayout;
}): void {
  traceWorkerStats(params);
}

// ── Context usage hook ────────────────────────────────────────────────────────

export function persistTraceContext(params: {
  sessionId: string;
  modelId?: string;
  totalTokens: number;
  contextWindow: number;
  pct: number;
  segSystem?: number;
  segUser?: number;
  segAssistant?: number;
  segTool?: number;
  segSummary?: number;
  systemPromptTokens?: number;
  layout?: DesktopRootLayout;
}): void {
  traceWorkerContext(params);
}

// ── Tool call hook ────────────────────────────────────────────────────────────

export function persistTraceToolCall(params: {
  sessionId: string;
  runId?: string;
  toolName: string;
  toolInput?: unknown;
  bashCommand?: string;
  durationMs?: number;
  status: 'ok' | 'error';
  errorMessage?: string;
  conversationTitle?: string;
  layout?: DesktopRootLayout;
}): void {
  traceWorkerToolCall(params);
}

// ── Compaction hook ───────────────────────────────────────────────────────────

export function persistTraceCompaction(params: {
  sessionId: string;
  reason: 'overflow' | 'threshold' | 'manual';
  tokensBefore?: number;
  tokensAfter?: number;
  tokensSaved?: number;
  layout?: DesktopRootLayout;
}): void {
  traceWorkerCompaction({
    sessionId: params.sessionId,
    reason: params.reason,
    tokensBefore: params.tokensBefore ?? 0,
    tokensAfter: params.tokensAfter ?? 0,
    tokensSaved: params.tokensSaved ?? 0,
    layout: params.layout,
  });
}

// ── Auto mode hook ────────────────────────────────────────────────────────────

export function persistTraceAutoMode(params: {
  sessionId: string;
  enabled: boolean;
  stopReason?: string | null;
  layout?: DesktopRootLayout;
}): void {
  traceWorkerAutoMode(params);
}

// ── Suggested context hook ────────────────────────────────────────────────────

export function persistTraceSuggestedContext(params: { sessionId: string; pointerIds: string[]; layout?: DesktopRootLayout }): void {
  traceWorkerSuggestedContext(params);
}

// ── Context pointer inspect hook ──────────────────────────────────────────────

export function persistTraceContextPointerInspect(params: {
  sessionId: string;
  inspectedConversationId: string;
  wasSuggested: boolean;
  layout?: DesktopRootLayout;
}): void {
  traceWorkerContextPointerInspect(params);
}
