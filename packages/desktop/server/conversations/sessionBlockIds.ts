export type RebasableDisplayBlock =
  | { type: 'context' | 'thinking' | 'text' | 'tool_use' | 'error'; id: string; [key: string]: unknown }
  | { type: 'image'; id: string; alt?: string; [key: string]: unknown }
  | { type: string; id?: string; [key: string]: unknown };

export function rewriteIndexedBlockId(blockId: string, kind: 'm' | 't' | 'x' | 'c' | 'e' | 'i', absoluteIndex: number): string {
  return blockId.replace(new RegExp(`-${kind}\\d+$`), `-${kind}${absoluteIndex}`);
}

export function rebaseDisplayBlockIds<T extends RebasableDisplayBlock>(blocks: T[], blockOffset: number): T[] {
  if (blockOffset <= 0) {
    return blocks;
  }

  return blocks.map((block, index) => {
    const absoluteIndex = blockOffset + index;

    switch (block.type) {
      case 'context':
        return { ...block, id: rewriteIndexedBlockId(block.id, 'm', absoluteIndex) };
      case 'thinking':
        return { ...block, id: rewriteIndexedBlockId(block.id, 't', absoluteIndex) };
      case 'text':
        return { ...block, id: rewriteIndexedBlockId(block.id, 'x', absoluteIndex) };
      case 'tool_use':
        return { ...block, id: rewriteIndexedBlockId(block.id, 'c', absoluteIndex) };
      case 'error':
        return { ...block, id: rewriteIndexedBlockId(block.id, 'e', absoluteIndex) };
      case 'image':
        return block.alt === 'Injected context image' ? { ...block, id: rewriteIndexedBlockId(block.id, 'i', absoluteIndex) } : block;
      default:
        return block;
    }
  }) as T[];
}
