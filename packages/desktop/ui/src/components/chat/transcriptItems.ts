import type { MessageBlock } from '../../shared/types';
import { isTerminalBashToolBlock } from '../../transcript/terminalBashBlock';
import { formatToolExecutionWrapperChain, readToolExecutionWrappers } from '../../transcript/toolExecutionWrappers.js';
import { isBackgroundShellStart } from './toolPresentation.js';

export type ContextConversationBlock = Extract<MessageBlock, { type: 'context' | 'summary' }>;
export type TraceConversationBlock =
  | Extract<MessageBlock, { type: 'thinking' | 'tool_use' | 'subagent' | 'error' }>
  | ContextConversationBlock;

export interface TraceClusterSummaryCategory {
  key: string;
  kind: 'thinking' | 'tool' | 'subagent' | 'error' | 'context';
  label: string;
  count: number;
  tool?: string;
}

export interface TraceClusterSummary {
  stepCount: number;
  categories: TraceClusterSummaryCategory[];
  durationMs: number | null;
  hasError: boolean;
  hasRunning: boolean;
}

export type ChatRenderItem =
  | { type: 'message'; block: MessageBlock; index: number }
  | { type: 'context_cluster'; blocks: ContextConversationBlock[]; startIndex: number; endIndex: number }
  | { type: 'trace_cluster'; blocks: TraceConversationBlock[]; startIndex: number; endIndex: number; summary: TraceClusterSummary };

const TOPOLOGY_CUSTOM_TYPES = new Set(['child_conversation_topology', 'parent_conversation_backlink']);

export function isTopologyBlock(block: MessageBlock): boolean {
  return block.type === 'context' && TOPOLOGY_CUSTOM_TYPES.has((block as { customType?: string }).customType ?? '');
}

function isContextConversationBlock(block: MessageBlock): block is ContextConversationBlock {
  return (block.type === 'context' || block.type === 'summary') && !isTopologyBlock(block);
}

function addSummaryCategory(categories: Map<string, TraceClusterSummaryCategory>, category: Omit<TraceClusterSummaryCategory, 'count'>) {
  const current = categories.get(category.key);
  if (current) {
    current.count += 1;
    return;
  }

  categories.set(category.key, { ...category, count: 1 });
}

function isTraceConversationBlock(block: MessageBlock, standaloneTools: Set<string>): block is TraceConversationBlock {
  switch (block.type) {
    case 'thinking':
    case 'subagent':
    case 'error':
      return true;
    case 'tool_use':
      if (block.tool === 'ask_user' && standaloneTools.has(block.tool)) {
        return false;
      }
      return !isTerminalBashToolBlock(block);
    default:
      return false;
  }
}

function summarizeTraceCluster(blocks: TraceConversationBlock[]): TraceClusterSummary {
  const categories = new Map<string, TraceClusterSummaryCategory>();
  let durationMs = 0;
  let hasDuration = false;
  let hasError = false;
  let hasRunning = false;

  for (const block of blocks) {
    switch (block.type) {
      case 'thinking':
        addSummaryCategory(categories, { key: 'thinking', kind: 'thinking', label: 'thinking' });
        break;
      case 'subagent':
        addSummaryCategory(categories, { key: 'subagent', kind: 'subagent', label: 'subagent' });
        if (block.status === 'running') {
          hasRunning = true;
        }
        if (block.status === 'failed') {
          hasError = true;
        }
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
        const wrapperChain = formatToolExecutionWrapperChain(readToolExecutionWrappers(block));
        const toolLabel = backgroundShellStart ? 'bash · background task' : block.tool;
        const label = wrapperChain ? `${wrapperChain} · ${toolLabel}` : toolLabel;
        const key = `${backgroundShellStart ? 'tool:bash:background' : `tool:${block.tool}`}${wrapperChain ? `:wrappers:${wrapperChain}` : ''}`;
        addSummaryCategory(categories, {
          key,
          kind: 'tool',
          label,
          tool: backgroundShellStart ? 'bash' : block.tool,
        });
        if (block.status === 'running' || block.running) {
          hasRunning = true;
        }
        if (block.status === 'error' || block.error) {
          hasError = true;
        }
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

export function buildChatRenderItems(messages: MessageBlock[], standaloneTools: Set<string> = new Set()): ChatRenderItem[] {
  const items: ChatRenderItem[] = [];
  let pendingTraceBlocks: TraceConversationBlock[] = [];
  let traceStartIndex = -1;
  let pendingContextBlocks: ContextConversationBlock[] = [];
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
    if (isTraceConversationBlock(block, standaloneTools)) {
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

    if (isContextConversationBlock(block)) {
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
