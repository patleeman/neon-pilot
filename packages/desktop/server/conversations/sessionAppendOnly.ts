export interface AppendOnlyBlockLike {
  id: string;
  [key: string]: unknown;
}

export interface SessionDetailLike<TBlock extends AppendOnlyBlockLike = AppendOnlyBlockLike> {
  meta: unknown;
  blocks: TBlock[];
  blockOffset: number;
  totalBlocks: number;
  contextUsage?: unknown;
  signature?: string | null;
}

export interface SessionDetailAppendOnlyResponseLike<TBlock extends AppendOnlyBlockLike = AppendOnlyBlockLike> {
  appendOnly: true;
  meta: unknown;
  blocks: TBlock[];
  blockOffset: number;
  totalBlocks: number;
  contextUsage?: unknown;
  signature: string | null;
}

export function normalizeKnownBlockId(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function buildAppendOnlySessionDetailResponse<TBlock extends AppendOnlyBlockLike>(input: {
  detail: SessionDetailLike<TBlock>;
  knownBlockOffset?: number;
  knownTotalBlocks?: number;
  knownLastBlockId?: string;
}): SessionDetailAppendOnlyResponseLike<TBlock> | null {
  const knownBlockOffset =
    Number.isSafeInteger(input.knownBlockOffset) && typeof input.knownBlockOffset === 'number' ? Math.max(0, input.knownBlockOffset) : null;
  const knownTotalBlocks =
    Number.isSafeInteger(input.knownTotalBlocks) && typeof input.knownTotalBlocks === 'number' ? Math.max(0, input.knownTotalBlocks) : null;

  if (knownBlockOffset === null || knownTotalBlocks === null) {
    return null;
  }

  if (input.detail.totalBlocks <= knownTotalBlocks || input.detail.blockOffset < knownBlockOffset) {
    return null;
  }

  if (input.detail.blockOffset < knownTotalBlocks) {
    const knownLastVisibleIndex = knownTotalBlocks - input.detail.blockOffset - 1;
    const currentKnownLastBlock = knownLastVisibleIndex >= 0 ? input.detail.blocks[knownLastVisibleIndex] : undefined;
    const knownLastBlockId = normalizeKnownBlockId(input.knownLastBlockId);
    if (!knownLastBlockId || currentKnownLastBlock?.id !== knownLastBlockId) {
      return null;
    }
  }

  const appendedStartIndex = Math.max(0, knownTotalBlocks - input.detail.blockOffset);
  const appendedBlocks = input.detail.blocks.slice(appendedStartIndex);
  if (appendedBlocks.length === 0) {
    return null;
  }

  return {
    appendOnly: true,
    meta: input.detail.meta,
    blocks: appendedBlocks,
    blockOffset: input.detail.blockOffset,
    totalBlocks: input.detail.totalBlocks,
    contextUsage: input.detail.contextUsage,
    signature: input.detail.signature ?? null,
  };
}
