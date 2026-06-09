import type { SessionDetail, SessionDetailAppendOnlyResponse } from '../shared/types';

export interface SessionDetailKnownParams {
  knownSessionSignature?: string;
  knownBlockOffset?: number;
  knownTotalBlocks?: number;
  knownLastBlockId?: string;
}

export function readSessionDetailSignature(detail: SessionDetail | null | undefined): string | undefined {
  const signature = detail?.signature?.trim();
  return signature && signature.length > 0 ? signature : undefined;
}

function readSessionDetailLastBlockId(detail: SessionDetail | null | undefined): string | undefined {
  const blockId = detail?.blocks.at(-1)?.id?.trim();
  return blockId && blockId.length > 0 ? blockId : undefined;
}

export function buildSessionDetailKnownParams(detail: SessionDetail | null | undefined): SessionDetailKnownParams {
  const knownSessionSignature = readSessionDetailSignature(detail);
  const knownLastBlockId = readSessionDetailLastBlockId(detail);
  return {
    ...(knownSessionSignature ? { knownSessionSignature } : {}),
    ...(typeof detail?.blockOffset === 'number' ? { knownBlockOffset: detail.blockOffset } : {}),
    ...(typeof detail?.totalBlocks === 'number' ? { knownTotalBlocks: detail.totalBlocks } : {}),
    ...(knownLastBlockId ? { knownLastBlockId } : {}),
  };
}

export function mergeAppendOnlySessionDetail(cached: SessionDetail, result: SessionDetailAppendOnlyResponse): SessionDetail | null {
  const dropCount = Math.max(0, result.blockOffset - cached.blockOffset);
  const retainedBlocks = cached.blocks.slice(dropCount);
  const nextVisibleLength = Math.max(0, result.totalBlocks - result.blockOffset);
  const retainedCount = Math.max(0, nextVisibleLength - result.blocks.length);
  if (retainedCount > retainedBlocks.length) {
    return null;
  }

  return {
    meta: result.meta,
    blocks: [...retainedBlocks.slice(retainedBlocks.length - retainedCount), ...result.blocks],
    blockOffset: result.blockOffset,
    totalBlocks: result.totalBlocks,
    contextUsage: result.contextUsage,
    signature: result.signature ?? cached.signature,
    ...(result.renderItems ? { renderItems: result.renderItems } : {}),
  };
}
