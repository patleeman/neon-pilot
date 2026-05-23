export interface HeavyDisplayImageLike {
  src?: string;
  deferred?: boolean;
  [key: string]: unknown;
}

export type HeavyDisplayBlockLike =
  | { type: 'user'; images?: HeavyDisplayImageLike[]; [key: string]: unknown }
  | { type: 'tool_use'; output: string; outputDeferred?: boolean; [key: string]: unknown }
  | { type: 'image'; src?: string; deferred?: boolean; [key: string]: unknown }
  | { type: string; [key: string]: unknown };

export function findLastBlockIndex<TBlock>(blocks: TBlock[], predicate: (block: TBlock) => boolean): number {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (predicate(blocks[index]!)) {
      return index;
    }
  }
  return -1;
}

export function resolveTailBlockLimit(tailBlocks: number | undefined, totalBlocks: number): number | null {
  if (!Number.isSafeInteger(tailBlocks) || typeof tailBlocks !== 'number' || tailBlocks <= 0) {
    return null;
  }

  return Math.min(tailBlocks, totalBlocks);
}

export function buildDeferredToolOutputPreview(output: string, previewLength: number): string {
  const trimmed = output.trim();
  if (trimmed.length <= previewLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, previewLength - 1)).trimEnd()}…`;
}

export function deferHeavyBlockContent<TBlock extends HeavyDisplayBlockLike>(input: {
  blocks: TBlock[];
  blockOffset: number;
  totalBlocks: number;
  recentHeavyContentBlockCount: number;
  deferredToolOutputPreviewLength: number;
}): TBlock[] {
  return input.blocks.map((block, index) => {
    const absoluteIndex = input.blockOffset + index;
    if (absoluteIndex >= Math.max(0, input.totalBlocks - input.recentHeavyContentBlockCount)) {
      return block;
    }

    if (block.type === 'user' && block.images?.some((image) => image.src)) {
      return {
        ...block,
        images: block.images.map((image) => (image.src ? { ...image, src: undefined, deferred: true } : image)),
      } as TBlock;
    }

    if (block.type === 'tool_use' && block.output.trim().length > input.deferredToolOutputPreviewLength) {
      return {
        ...block,
        output: buildDeferredToolOutputPreview(block.output, input.deferredToolOutputPreviewLength),
        outputDeferred: true,
      } as TBlock;
    }

    if (block.type === 'image' && block.src) {
      return {
        ...block,
        src: undefined,
        deferred: true,
      } as TBlock;
    }

    return block;
  });
}
