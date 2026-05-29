import type { DisplayBlock, SessionDetail } from './conversationTypes.js';

export interface TranscriptTraceClusterSummaryCategory {
  key: string;
  kind: 'thinking' | 'tool' | 'subagent' | 'error' | 'context';
  label: string;
  count: number;
  tool?: string;
}

export interface TranscriptTraceClusterSummary {
  stepCount: number;
  categories: TranscriptTraceClusterSummaryCategory[];
  durationMs: number | null;
  hasError: boolean;
  hasRunning: boolean;
}

type DisplayUserImages = Extract<DisplayBlock, { type: 'user' }>['images'];

type TranscriptMessageBlock =
  | {
      type: 'user';
      id?: string;
      ts: string;
      text: string;
      images?: DisplayUserImages;
    }
  | { type: 'text'; id?: string; ts: string; text: string; streaming?: boolean }
  | { type: 'context'; id?: string; ts: string; text: string; customType?: string }
  | { type: 'summary'; id?: string; ts: string; kind: 'compaction' | 'branch' | 'related'; title: string; text: string; detail?: string }
  | { type: 'thinking'; id?: string; ts: string; text: string }
  | {
      type: 'tool_use';
      id?: string;
      ts: string;
      tool: string;
      input: Record<string, unknown>;
      output: string;
      durationMs?: number;
      running?: boolean;
      status?: 'running' | 'ok' | 'error';
      error?: boolean;
      _toolCallId?: string;
      details?: unknown;
      outputDeferred?: boolean;
    }
  | {
      type: 'image';
      id?: string;
      ts: string;
      alt: string;
      src?: string;
      mimeType?: string;
      width?: number;
      height?: number;
      caption?: string;
      deferred?: boolean;
    }
  | { type: 'error'; id?: string; ts: string; tool?: string; message: string };

type ContextTranscriptBlock = Extract<TranscriptMessageBlock, { type: 'context' | 'summary' }>;
// This builder runs on persisted DisplayBlock data, not live-only MessageBlock
// stream data. Keep this type aligned with DisplayBlock so route bootstrap
// precompute cannot silently claim support for blocks it will never receive.
type TraceTranscriptBlock = Extract<TranscriptMessageBlock, { type: 'thinking' | 'tool_use' | 'error' }> | ContextTranscriptBlock;

export type TranscriptRenderItem =
  | { type: 'message'; block: TranscriptMessageBlock; index: number }
  | { type: 'context_cluster'; blocks: ContextTranscriptBlock[]; startIndex: number; endIndex: number }
  | {
      type: 'trace_cluster';
      blocks: TraceTranscriptBlock[];
      startIndex: number;
      endIndex: number;
      summary: TranscriptTraceClusterSummary;
      deferredBlockIds?: string[];
      deferredEntryIds?: string[];
    };

const TOPOLOGY_CUSTOM_TYPES = new Set(['child_conversation_topology', 'parent_conversation_backlink']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined;
}

function readToolExecutionWrapperLabels(value: Record<string, unknown> | null): string[] {
  const candidate = value?.executionWrappers;
  if (!Array.isArray(candidate)) return [];

  return candidate.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = readTrimmedString(item, 'id');
    if (!id) return [];
    return [readTrimmedString(item, 'label') ?? id];
  });
}

function readToolExecutionWrapperChain(block: Extract<TranscriptMessageBlock, { type: 'tool_use' }>): string | null {
  const details = isRecord(block.details) ? block.details : null;
  const input = isRecord(block.input) ? block.input : null;
  const labels = readToolExecutionWrapperLabels(details);

  for (const label of readToolExecutionWrapperLabels(input)) {
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }

  return labels.length > 0 ? labels.join(' → ') : null;
}

function displayBlockToTranscriptMessageBlock(block: DisplayBlock): TranscriptMessageBlock {
  switch (block.type) {
    case 'user':
      return { type: 'user', id: block.id, text: block.text, images: block.images, ts: block.ts };
    case 'text':
      return { type: 'text', id: block.id, text: block.text, ts: block.ts };
    case 'context':
      return { type: 'context', id: block.id, text: block.text, customType: block.customType, ts: block.ts };
    case 'thinking':
      return { type: 'thinking', id: block.id, text: block.text, ts: block.ts };
    case 'summary':
      return { type: 'summary', id: block.id, kind: block.kind, title: block.title, text: block.text, detail: block.detail, ts: block.ts };
    case 'tool_use':
      return {
        type: 'tool_use',
        id: block.id,
        tool: block.tool,
        input: block.input,
        output: block.output,
        durationMs: block.durationMs,
        details: block.details,
        outputDeferred: block.outputDeferred,
        ts: block.ts,
        _toolCallId: block.toolCallId,
      };
    case 'image':
      return {
        type: 'image',
        id: block.id,
        alt: block.alt,
        src: block.src,
        mimeType: block.mimeType,
        width: block.width,
        height: block.height,
        caption: block.caption,
        deferred: block.deferred,
        ts: block.ts,
      };
    case 'error':
      return { type: 'error', id: block.id, tool: block.tool, message: block.message, ts: block.ts };
  }
}

function isTopologyBlock(block: TranscriptMessageBlock): boolean {
  return block.type === 'context' && TOPOLOGY_CUSTOM_TYPES.has(block.customType ?? '');
}

function isContextTranscriptBlock(block: TranscriptMessageBlock): block is ContextTranscriptBlock {
  return (block.type === 'context' || (block.type === 'summary' && block.kind !== 'compaction')) && !isTopologyBlock(block);
}

function isTerminalBashToolBlock(block: TranscriptMessageBlock): boolean {
  if (block.type !== 'tool_use' || block.tool !== 'bash') return false;
  const input = isRecord(block.input) ? block.input : null;
  const details = isRecord(block.details) ? block.details : null;
  const backgroundStart =
    input?.background === true || details?.background === true || input?.action === 'start' || details?.action === 'start';
  if (backgroundStart) return false;
  const terminalMode = input?.displayMode === 'terminal' || details?.displayMode === 'terminal';
  const command = typeof input?.command === 'string' && input.command.trim() ? input.command : details?.command;
  return terminalMode && typeof command === 'string' && command.trim().length > 0;
}

function isTraceTranscriptBlock(block: TranscriptMessageBlock): block is TraceTranscriptBlock {
  switch (block.type) {
    case 'thinking':
    case 'error':
      return true;
    case 'tool_use':
      return !isTerminalBashToolBlock(block);
    default:
      return false;
  }
}

function addSummaryCategory(
  categories: Map<string, TranscriptTraceClusterSummaryCategory>,
  category: Omit<TranscriptTraceClusterSummaryCategory, 'count'>,
): void {
  const current = categories.get(category.key);
  if (current) {
    current.count += 1;
    return;
  }
  categories.set(category.key, { ...category, count: 1 });
}

function isBackgroundShellStart(block: Extract<TranscriptMessageBlock, { type: 'tool_use' }>): boolean {
  const input = isRecord(block.input) ? block.input : null;
  const details = isRecord(block.details) ? block.details : null;
  return (
    block.tool === 'bash' &&
    (input?.background === true || details?.background === true || input?.action === 'start' || details?.action === 'start')
  );
}

function summarizeTraceCluster(blocks: TraceTranscriptBlock[]): TranscriptTraceClusterSummary {
  const categories = new Map<string, TranscriptTraceClusterSummaryCategory>();
  let durationMs = 0;
  let hasDuration = false;
  let hasError = false;
  let hasRunning = false;

  for (const block of blocks) {
    switch (block.type) {
      case 'thinking':
        addSummaryCategory(categories, { key: 'thinking', kind: 'thinking', label: 'thinking' });
        break;
      case 'error':
        addSummaryCategory(categories, { key: 'error', kind: 'error', label: 'error' });
        hasError = true;
        break;
      case 'context':
      case 'summary':
        addSummaryCategory(categories, { key: 'context', kind: 'context', label: 'context' });
        break;
      case 'tool_use': {
        const backgroundShellStart = isBackgroundShellStart(block);
        const wrapperChain = readToolExecutionWrapperChain(block);
        const toolLabel = backgroundShellStart ? 'bash · background task' : block.tool;
        const label = wrapperChain ? `${wrapperChain} · ${toolLabel}` : toolLabel;
        const key = `${backgroundShellStart ? 'tool:bash:background' : `tool:${block.tool}`}${wrapperChain ? `:wrappers:${wrapperChain}` : ''}`;
        addSummaryCategory(categories, { key, kind: 'tool', label, tool: backgroundShellStart ? 'bash' : block.tool });
        if (block.status === 'running' || block.running) hasRunning = true;
        if (block.status === 'error' || block.error) hasError = true;
        if (typeof block.durationMs === 'number' && Number.isFinite(block.durationMs) && block.durationMs > 0) {
          durationMs += block.durationMs;
          hasDuration = true;
        }
        break;
      }
    }
  }

  return {
    stepCount: blocks.length,
    categories: [...categories.values()],
    durationMs: hasDuration ? durationMs : null,
    hasError,
    hasRunning,
  };
}

export function buildTranscriptRenderItemsFromDisplayBlocks(blocks: DisplayBlock[]): TranscriptRenderItem[] {
  const messages = blocks.map(displayBlockToTranscriptMessageBlock);
  const items: TranscriptRenderItem[] = [];
  let pendingTraceBlocks: TraceTranscriptBlock[] = [];
  let traceStartIndex = -1;
  let pendingContextBlocks: ContextTranscriptBlock[] = [];
  let contextStartIndex = -1;

  function flushTraceBlocks() {
    if (pendingTraceBlocks.length === 0 || traceStartIndex < 0) {
      pendingTraceBlocks = [];
      traceStartIndex = -1;
      return;
    }

    items.push({
      type: 'trace_cluster',
      blocks: pendingTraceBlocks,
      startIndex: traceStartIndex,
      endIndex: traceStartIndex + pendingTraceBlocks.length - 1,
      summary: summarizeTraceCluster(pendingTraceBlocks),
    });
    pendingTraceBlocks = [];
    traceStartIndex = -1;
  }

  function flushContextBlocks() {
    if (pendingContextBlocks.length === 0 || contextStartIndex < 0) {
      pendingContextBlocks = [];
      contextStartIndex = -1;
      return;
    }

    items.push({
      type: 'context_cluster',
      blocks: pendingContextBlocks,
      startIndex: contextStartIndex,
      endIndex: contextStartIndex + pendingContextBlocks.length - 1,
    });
    pendingContextBlocks = [];
    contextStartIndex = -1;
  }

  for (const [index, block] of messages.entries()) {
    if (isTraceTranscriptBlock(block)) {
      if (pendingTraceBlocks.length === 0) {
        if (pendingContextBlocks.length > 0 && contextStartIndex >= 0) {
          traceStartIndex = contextStartIndex;
          pendingTraceBlocks.push(...pendingContextBlocks);
          pendingContextBlocks = [];
          contextStartIndex = -1;
        } else {
          traceStartIndex = index;
        }
      }
      pendingTraceBlocks.push(block);
      continue;
    }

    if (isContextTranscriptBlock(block)) {
      if (pendingTraceBlocks.length > 0) {
        pendingTraceBlocks.push(block);
      } else if (pendingContextBlocks.length === 0) {
        contextStartIndex = index;
        pendingContextBlocks.push(block);
      } else {
        pendingContextBlocks.push(block);
      }
      continue;
    }

    flushTraceBlocks();
    flushContextBlocks();
    items.push({ type: 'message', block, index });
  }

  flushTraceBlocks();
  flushContextBlocks();
  return items;
}

export function attachTranscriptRenderItems<T extends SessionDetail | null>(detail: T): T {
  if (!detail || Array.isArray((detail as SessionDetail & { renderItems?: unknown }).renderItems)) {
    return detail;
  }

  return {
    ...detail,
    renderItems: buildTranscriptRenderItemsFromDisplayBlocks(detail.blocks),
  } as T;
}
