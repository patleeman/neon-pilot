import type { DisplayBlock, MessageBlock, TranscriptRenderItem } from '../shared/types';

const DEFERRED_ENTRY_HYDRATION_PREFIX = 'entries:';

export function buildDeferredEntryHydrationId(entryIds: string[]): string | null {
  const normalizedEntryIds = [...new Set(entryIds.map((entryId) => entryId.trim()).filter(Boolean))];
  return normalizedEntryIds.length > 0 ? `${DEFERRED_ENTRY_HYDRATION_PREFIX}${JSON.stringify(normalizedEntryIds)}` : null;
}

export function parseDeferredEntryHydrationId(blockId: string): string[] | null {
  if (!blockId.startsWith(DEFERRED_ENTRY_HYDRATION_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(blockId.slice(DEFERRED_ENTRY_HYDRATION_PREFIX.length));
    return Array.isArray(parsed)
      ? parsed.filter((entryId): entryId is string => typeof entryId === 'string' && entryId.trim().length > 0)
      : null;
  } catch {
    return null;
  }
}

export function normalizeHistoricalBlockId(blockId: string): string | null {
  const normalized = blockId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function addHydratingHistoricalBlockId(current: string[], blockId: string): string[] {
  const normalized = normalizeHistoricalBlockId(blockId);
  if (!normalized || current.includes(normalized)) {
    return current;
  }

  return [...current, normalized];
}

export function removeHydratingHistoricalBlockId(current: string[], blockId: string): string[] {
  const normalized = normalizeHistoricalBlockId(blockId);
  if (!normalized) {
    return current;
  }

  return current.filter((candidate) => candidate !== normalized);
}

export function buildHydratingHistoricalBlockIdSet(blockIds: string[]): ReadonlySet<string> {
  return new Set(blockIds);
}

export function displayBlockToMessageBlock(block: DisplayBlock): MessageBlock {
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

export function mergeHydratedHistoricalBlocks(blocks: DisplayBlock[], hydratedBlocks: Record<string, MessageBlock>): MessageBlock[] {
  return blocks.map((block) => hydratedBlocks[block.id] ?? displayBlockToMessageBlock(block));
}

export function transcriptRenderItemsToMessageBlocks(
  renderItems: TranscriptRenderItem[],
  hydratedBlocks: Record<string, MessageBlock> = {},
  hydratedEntryClusters: Record<string, MessageBlock[]> = {},
): MessageBlock[] {
  const messages: MessageBlock[] = [];
  for (const item of renderItems) {
    if (item.type === 'message') {
      messages.push(item.block);
    } else if (item.type === 'trace_cluster' && item.deferredEntryIds?.length) {
      const hydrationId = buildDeferredEntryHydrationId(item.deferredEntryIds);
      messages.push(...(hydrationId ? (hydratedEntryClusters[hydrationId] ?? []) : []));
      messages.push(...item.blocks);
    } else if (item.type === 'trace_cluster' && item.deferredBlockIds?.length) {
      messages.push(...item.deferredBlockIds.flatMap((blockId) => hydratedBlocks[blockId] ?? []));
      messages.push(...item.blocks);
    } else {
      messages.push(...item.blocks);
    }
  }
  return messages;
}

export function hydrateTranscriptRenderItems(
  renderItems: TranscriptRenderItem[],
  hydratedBlocks: Record<string, MessageBlock>,
  hydratedEntryClusters: Record<string, MessageBlock[]> = {},
): TranscriptRenderItem[] {
  if (Object.keys(hydratedBlocks).length === 0 && Object.keys(hydratedEntryClusters).length === 0) {
    return renderItems;
  }

  return renderItems.map((item) => {
    if (item.type === 'trace_cluster' && item.deferredEntryIds?.length) {
      const hydrationId = buildDeferredEntryHydrationId(item.deferredEntryIds);
      const hydratedTraceBlocks = hydrationId ? (hydratedEntryClusters[hydrationId] ?? []) : [];
      return hydratedTraceBlocks.length > 0 ? { ...item, blocks: hydratedTraceBlocks } : item;
    }

    if (item.type !== 'trace_cluster' || !item.deferredBlockIds?.length) {
      return item;
    }

    const hydratedTraceBlocks = item.deferredBlockIds.flatMap((blockId) => {
      const block = hydratedBlocks[blockId];
      return block &&
        (block.type === 'thinking' ||
          block.type === 'tool_use' ||
          block.type === 'error' ||
          block.type === 'context' ||
          block.type === 'summary')
        ? [block]
        : [];
    });
    if (hydratedTraceBlocks.length === 0) {
      return item;
    }

    return { ...item, blocks: [...hydratedTraceBlocks, ...item.blocks] };
  });
}

export function mergeHydratedStreamBlocks(blocks: MessageBlock[], hydratedBlocks: Record<string, MessageBlock>): MessageBlock[] {
  return blocks.map((block) => {
    const normalizedId = typeof block.id === 'string' ? block.id.trim() : '';
    return normalizedId ? (hydratedBlocks[normalizedId] ?? block) : block;
  });
}

export function mergeHistoricalAndStreamBlocks(historicalBlocks: MessageBlock[], streamBlocks: MessageBlock[]): MessageBlock[] {
  if (historicalBlocks.length === 0) return streamBlocks;
  if (streamBlocks.length === 0) return historicalBlocks;

  const historicalIds = new Set(
    historicalBlocks.map((block) => (typeof block.id === 'string' ? block.id.trim() : '')).filter((id): id is string => id.length > 0),
  );
  if (historicalIds.size === 0) {
    return [...historicalBlocks, ...streamBlocks];
  }

  return [
    ...historicalBlocks,
    ...streamBlocks.filter((block) => {
      const normalizedId = typeof block.id === 'string' ? block.id.trim() : '';
      return !normalizedId || !historicalIds.has(normalizedId);
    }),
  ];
}
