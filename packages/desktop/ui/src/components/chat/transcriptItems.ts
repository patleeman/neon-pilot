import type { AssistantMessageVariationSet, MessageBlock } from '../../shared/types';
import { isTerminalBashToolBlock } from '../../transcript/terminalBashBlock';
import { formatToolExecutionWrapperChain, readToolExecutionWrappers } from '../../transcript/toolExecutionWrappers.js';
import { isBackgroundShellStart } from './toolPresentation.js';

type ContextConversationBlock = Extract<MessageBlock, { type: 'context' | 'summary' }>;
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
  | { type: 'message'; block: MessageBlock; index: number; arenaVariationSet?: AssistantMessageVariationSet }
  | { type: 'context_cluster'; blocks: ContextConversationBlock[]; startIndex: number; endIndex: number }
  | {
      type: 'trace_cluster';
      blocks: TraceConversationBlock[];
      startIndex: number;
      endIndex: number;
      summary: TraceClusterSummary;
      deferredBlockIds?: string[];
      deferredEntryIds?: string[];
    };

const TOPOLOGY_CUSTOM_TYPES = new Set(['child_conversation_topology', 'parent_conversation_backlink']);
const STANDALONE_CONTEXT_CUSTOM_TYPES = new Set(['model_arena_duel']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isTopologyBlock(block: MessageBlock): boolean {
  return block.type === 'context' && TOPOLOGY_CUSTOM_TYPES.has((block as { customType?: string }).customType ?? '');
}

function isStandaloneContextBlock(block: MessageBlock): block is ContextConversationBlock {
  return block.type === 'context' && STANDALONE_CONTEXT_CUSTOM_TYPES.has(block.customType ?? '');
}

function readModelArenaDuelDetails(block: MessageBlock): {
  sourceBlockId: string;
  status: string;
  sideA: { role: string; text: string };
  sideB: { role: string; text: string };
  models: { a?: string; b?: string; primary?: string; challenger?: string } | null;
  vote?: string | null;
} | null {
  if (block.type !== 'context' || block.customType !== 'model_arena_duel' || !isRecord(block.details)) return null;
  const sourceBlockId = readString(block.details.sourceBlockId);
  const sideA = isRecord(block.details.sideA) ? block.details.sideA : {};
  const sideB = isRecord(block.details.sideB) ? block.details.sideB : {};
  const models = isRecord(block.details.models) ? block.details.models : null;
  return {
    sourceBlockId,
    status: readString(block.details.status),
    sideA: { role: readString(sideA.role), text: readString(sideA.text) },
    sideB: { role: readString(sideB.role), text: readString(sideB.text) },
    models: models
      ? {
          a: readString(models.a) || undefined,
          b: readString(models.b) || undefined,
          primary: readString(models.primary) || undefined,
          challenger: readString(models.challenger) || undefined,
        }
      : null,
    vote: typeof block.details.vote === 'string' ? block.details.vote : null,
  };
}

function buildModelArenaVariationSet(
  sourceBlock: Extract<MessageBlock, { type: 'text' }>,
  duelBlock: Extract<MessageBlock, { type: 'context' }>,
): AssistantMessageVariationSet | null {
  const details = readModelArenaDuelDetails(duelBlock);
  if (!details || details.status !== 'voted') return null;
  const sourceBlockId = sourceBlock.id?.trim();
  if (
    !sourceBlockId ||
    (details.sourceBlockId &&
      !sourceBlockIdAliases(details.sourceBlockId).some((alias) => sourceBlockIdAliases(sourceBlockId).includes(alias)))
  ) {
    return null;
  }
  const challengerSide =
    details.sideA.role === 'challenger'
      ? details.sideA
      : details.sideB.role === 'challenger'
        ? details.sideB
        : details.sideA.text === sourceBlock.text
          ? details.sideB
          : details.sideB.text === sourceBlock.text
            ? details.sideA
            : null;
  const challengerText = challengerSide?.text.trim();
  if (!challengerText) return null;
  return {
    sourceBlockId,
    duelBlockId: duelBlock.id ?? `model-arena:${sourceBlockId}`,
    vote: details.vote,
    variations: [
      {
        id: `${sourceBlockId}:original`,
        label: details.models?.primary ? `Current model · ${details.models.primary}` : 'Current model',
        text: sourceBlock.text,
        modelRef: details.models?.primary,
      },
      {
        id: `${duelBlock.id ?? sourceBlockId}:challenger`,
        label: details.models?.challenger ? `Challenger · ${details.models.challenger}` : 'Challenger',
        text: challengerText,
        modelRef: details.models?.challenger,
      },
    ],
  };
}

function findLegacyModelArenaSourceBlockId(
  messages: MessageBlock[],
  duelIndex: number,
  details: NonNullable<ReturnType<typeof readModelArenaDuelDetails>>,
): string {
  for (let index = duelIndex - 1; index >= 0; index -= 1) {
    const block = messages[index];
    if (block?.type !== 'text' || !block.id) continue;
    if (block.text === details.sideA.text || block.text === details.sideB.text) return block.id;
  }
  for (let index = duelIndex + 1; index < messages.length; index += 1) {
    const block = messages[index];
    if (block?.type !== 'text' || !block.id) continue;
    if (block.text === details.sideA.text || block.text === details.sideB.text) return block.id;
  }
  for (let index = duelIndex - 1; index >= 0; index -= 1) {
    const block = messages[index];
    if (block?.type === 'text' && block.id) return block.id;
  }
  return '';
}

function sourceBlockIdAliases(sourceBlockId: string): string[] {
  const normalized = sourceBlockId.trim();
  if (!normalized) return [];
  const aliases = [normalized];
  const entryId = normalized.replace(/-x\d+$/, '');
  if (entryId && entryId !== normalized) aliases.push(entryId);
  return aliases;
}

function canonicalArenaSourceBlockId(sourceBlockId: string): string {
  return sourceBlockId.trim().replace(/-x\d+$/, '');
}

function arenaStatusIsActive(status: string): boolean {
  return status !== 'cancelled' && status !== 'voted';
}

function modelArenaDuelHasBothAnswers(details: { sideA: { text: string }; sideB: { text: string } }): boolean {
  return Boolean(details.sideA.text.trim() && details.sideB.text.trim());
}

function findAssistantBlockByArenaSourceId(
  assistantById: Map<string, Extract<MessageBlock, { type: 'text' }>>,
  sourceBlockId: string,
): Extract<MessageBlock, { type: 'text' }> | undefined {
  for (const alias of sourceBlockIdAliases(sourceBlockId)) {
    const exact = assistantById.get(alias);
    if (exact) return exact;
  }
  for (const alias of sourceBlockIdAliases(sourceBlockId)) {
    const prefixed = assistantById.get(`${alias}-x0`) ?? [...assistantById.values()].find((block) => block.id?.startsWith(`${alias}-x`));
    if (prefixed) return prefixed;
  }
  return undefined;
}

function addArenaSourceHiddenId(hiddenAssistantBlockIds: Set<string>, sourceBlockId: string) {
  for (const alias of sourceBlockIdAliases(sourceBlockId)) {
    hiddenAssistantBlockIds.add(alias);
  }
}

function deleteArenaSourceHiddenId(hiddenAssistantBlockIds: Set<string>, sourceBlockId: string) {
  for (const alias of sourceBlockIdAliases(sourceBlockId)) {
    hiddenAssistantBlockIds.delete(alias);
  }
}

function collectModelArenaPresentation(messages: MessageBlock[]): {
  hiddenAssistantBlockIds: Set<string>;
  hiddenDuelBlockIds: Set<string>;
  variationSetsBySourceBlockId: Map<string, AssistantMessageVariationSet>;
} {
  const assistantById = new Map<string, Extract<MessageBlock, { type: 'text' }>>();
  for (const block of messages) {
    if (block.type === 'text' && block.id) assistantById.set(block.id, block);
  }

  const hiddenAssistantBlockIds = new Set<string>();
  const hiddenDuelBlockIds = new Set<string>();
  const variationSetsBySourceBlockId = new Map<string, AssistantMessageVariationSet>();
  const activeDuelBySourceBlockId = new Map<
    string,
    { block: Extract<MessageBlock, { type: 'context' }>; sourceBlockId: string; replacesSource: boolean }
  >();
  const votedDuelBySourceBlockId = new Map<string, { block: Extract<MessageBlock, { type: 'context' }>; sourceBlockId: string }>();
  for (const [index, block] of messages.entries()) {
    if (block.type !== 'context') continue;
    const details = readModelArenaDuelDetails(block);
    if (!details) continue;
    const sourceBlockId = details.sourceBlockId || findLegacyModelArenaSourceBlockId(messages, index, details);
    if (!sourceBlockId) continue;
    const duelBlockId = block.id ?? sourceBlockId;
    const sourceKey = canonicalArenaSourceBlockId(sourceBlockId);
    if (arenaStatusIsActive(details.status)) {
      if (!modelArenaDuelHasBothAnswers(details) && votedDuelBySourceBlockId.has(sourceKey)) {
        hiddenDuelBlockIds.add(duelBlockId);
        continue;
      }
      const previousActiveDuel = activeDuelBySourceBlockId.get(sourceKey);
      if (previousActiveDuel?.block.id) hiddenDuelBlockIds.add(previousActiveDuel.block.id);
      activeDuelBySourceBlockId.set(sourceKey, { block, sourceBlockId, replacesSource: modelArenaDuelHasBothAnswers(details) });
    } else {
      hiddenDuelBlockIds.add(duelBlockId);
      const previousActiveDuel = activeDuelBySourceBlockId.get(sourceKey);
      if (previousActiveDuel?.block.id) hiddenDuelBlockIds.add(previousActiveDuel.block.id);
      activeDuelBySourceBlockId.delete(sourceKey);
      if (details.status === 'voted') {
        votedDuelBySourceBlockId.set(sourceKey, { block, sourceBlockId });
      }
    }
  }
  for (const { block, sourceBlockId, replacesSource } of activeDuelBySourceBlockId.values()) {
    const duelBlockId = block.id ?? sourceBlockId;
    hiddenDuelBlockIds.delete(duelBlockId);
    if (replacesSource) {
      addArenaSourceHiddenId(hiddenAssistantBlockIds, sourceBlockId);
      const source = findAssistantBlockByArenaSourceId(assistantById, sourceBlockId);
      if (source?.id) hiddenAssistantBlockIds.add(source.id);
    }
  }
  for (const [sourceKey, { block, sourceBlockId }] of votedDuelBySourceBlockId.entries()) {
    if (activeDuelBySourceBlockId.has(sourceKey)) continue;
    deleteArenaSourceHiddenId(hiddenAssistantBlockIds, sourceBlockId);
    const source = findAssistantBlockByArenaSourceId(assistantById, sourceBlockId);
    if (source?.id) {
      hiddenAssistantBlockIds.delete(source.id);
      const variationSet = buildModelArenaVariationSet(source, block);
      if (variationSet) variationSetsBySourceBlockId.set(source.id, variationSet);
    }
  }
  return { hiddenAssistantBlockIds, hiddenDuelBlockIds, variationSetsBySourceBlockId };
}

function isContextConversationBlock(block: MessageBlock): block is ContextConversationBlock {
  return (block.type === 'context' || (block.type === 'summary' && block.kind !== 'compaction')) && !isTopologyBlock(block);
}

function addSummaryCategory(categories: Map<string, TraceClusterSummaryCategory>, category: Omit<TraceClusterSummaryCategory, 'count'>) {
  const current = categories.get(category.key);
  if (current) {
    current.count += 1;
    return;
  }

  categories.set(category.key, { ...category, count: 1 });
}

function isTraceConversationBlock(block: MessageBlock, _standaloneTools: Set<string>): block is TraceConversationBlock {
  switch (block.type) {
    case 'thinking':
    case 'subagent':
    case 'error':
      return true;
    case 'tool_use':
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

function getChatRenderItemStartIndex(item: ChatRenderItem): number {
  return item.type === 'message' ? item.index : item.startIndex;
}

function getChatRenderItemEndIndex(item: ChatRenderItem): number {
  return item.type === 'message' ? item.index : item.endIndex;
}

function shiftChatRenderItemIndex(item: ChatRenderItem, offset: number): ChatRenderItem {
  if (offset === 0) {
    return item;
  }
  if (item.type === 'message') {
    return { ...item, index: item.index + offset };
  }
  return { ...item, startIndex: item.startIndex + offset, endIndex: item.endIndex + offset };
}

function shouldRebuildPreviousClusterForAppend(
  previousLastItem: ChatRenderItem | undefined,
  nextBlock: MessageBlock | undefined,
  standaloneTools: Set<string>,
): boolean {
  if (!previousLastItem || !nextBlock) {
    return false;
  }
  if (previousLastItem.type !== 'trace_cluster' && previousLastItem.type !== 'context_cluster') {
    return false;
  }

  return (
    isTraceConversationBlock(nextBlock, standaloneTools) || (isContextConversationBlock(nextBlock) && !isStandaloneContextBlock(nextBlock))
  );
}

function modelArenaRebuildStartIndex(messages: MessageBlock[], changedIndex: number): number | null {
  const changedBlock = messages[changedIndex];
  const details = changedBlock ? readModelArenaDuelDetails(changedBlock) : null;
  if (!details) return null;
  const sourceBlockId = details.sourceBlockId || findLegacyModelArenaSourceBlockId(messages, changedIndex, details);
  if (!sourceBlockId) return changedIndex;
  const aliases = new Set(sourceBlockIdAliases(sourceBlockId));
  const sourceIndex = messages.findIndex((block) => block.type === 'text' && block.id && aliases.has(block.id));
  return sourceIndex >= 0 ? Math.min(sourceIndex, changedIndex) : changedIndex;
}

export function buildChatRenderItems(messages: MessageBlock[], standaloneTools: Set<string> = new Set()): ChatRenderItem[] {
  const items: ChatRenderItem[] = [];
  const arenaPresentation = collectModelArenaPresentation(messages);
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
    if (block.type === 'text' && block.id && arenaPresentation.hiddenAssistantBlockIds.has(block.id)) {
      continue;
    }
    if (block.type === 'context' && block.customType === 'model_arena_duel') {
      const blockId = block.id ?? readModelArenaDuelDetails(block)?.sourceBlockId;
      if (blockId && arenaPresentation.hiddenDuelBlockIds.has(blockId)) {
        continue;
      }
    }

    if (isStandaloneContextBlock(block)) {
      flushTraceBlocks();
      flushContextBlocks();
      items.push({ type: 'context_cluster', blocks: [block], startIndex: index, endIndex: index });
      continue;
    }

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
    items.push({
      type: 'message',
      block,
      index,
      arenaVariationSet: block.type === 'text' && block.id ? arenaPresentation.variationSetsBySourceBlockId.get(block.id) : undefined,
    });
  }

  flushTraceBlocks();
  flushContextBlocks();
  return items;
}

export function buildChatRenderItemsIncremental(input: {
  messages: MessageBlock[];
  standaloneTools?: Set<string>;
  previousMessages?: MessageBlock[];
  previousRenderItems?: ChatRenderItem[];
}): ChatRenderItem[] {
  const standaloneTools = input.standaloneTools ?? new Set<string>();
  const previousMessages = input.previousMessages;
  const previousRenderItems = input.previousRenderItems;

  if (!previousMessages || !previousRenderItems || input.messages.length < previousMessages.length) {
    return buildChatRenderItems(input.messages, standaloneTools);
  }

  let firstChangedIndex = -1;
  const comparableLength = Math.min(previousMessages.length, input.messages.length);
  for (let index = 0; index < comparableLength; index += 1) {
    if (previousMessages[index] !== input.messages[index]) {
      firstChangedIndex = index;
      break;
    }
  }

  if (firstChangedIndex < 0) {
    firstChangedIndex = previousMessages.length;
  }

  if (firstChangedIndex === input.messages.length) {
    return previousRenderItems;
  }

  if (firstChangedIndex === 0) {
    return buildChatRenderItems(input.messages, standaloneTools);
  }

  const arenaRebuildStartIndex = modelArenaRebuildStartIndex(input.messages, firstChangedIndex);
  if (arenaRebuildStartIndex !== null) {
    return [
      ...previousRenderItems.filter((item) => getChatRenderItemEndIndex(item) < arenaRebuildStartIndex),
      ...buildChatRenderItems(input.messages.slice(arenaRebuildStartIndex), standaloneTools).map((item) =>
        shiftChatRenderItemIndex(item, arenaRebuildStartIndex),
      ),
    ];
  }

  const previousLastItem = previousRenderItems.at(-1);
  let rebuildStartIndex = firstChangedIndex;
  if (
    firstChangedIndex === previousMessages.length &&
    shouldRebuildPreviousClusterForAppend(previousLastItem, input.messages[firstChangedIndex], standaloneTools)
  ) {
    rebuildStartIndex = previousLastItem ? getChatRenderItemStartIndex(previousLastItem) : firstChangedIndex;
  } else {
    const containingItem = previousRenderItems.find(
      (item) => getChatRenderItemStartIndex(item) <= firstChangedIndex && getChatRenderItemEndIndex(item) >= firstChangedIndex,
    );
    if (containingItem) {
      rebuildStartIndex = getChatRenderItemStartIndex(containingItem);
    }
  }

  if (rebuildStartIndex <= 0) {
    return buildChatRenderItems(input.messages, standaloneTools);
  }

  const keptItems = previousRenderItems.filter((item) => getChatRenderItemEndIndex(item) < rebuildStartIndex);
  const rebuiltItems = buildChatRenderItems(input.messages.slice(rebuildStartIndex), standaloneTools).map((item) =>
    shiftChatRenderItemIndex(item, rebuildStartIndex),
  );
  return [...keptItems, ...rebuiltItems];
}
