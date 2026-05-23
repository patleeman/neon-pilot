export function normalizeTailBlockRequest(input: { tailBlocks: number | undefined; maxTailBlocks: number }): number | undefined {
  return typeof input.tailBlocks === 'number' && Number.isSafeInteger(input.tailBlocks) && input.tailBlocks > 0
    ? Math.min(input.maxTailBlocks, input.tailBlocks)
    : undefined;
}

export function buildSessionDetailCacheKey(filePath: string, tailBlocks?: number): string {
  return `${filePath}::${tailBlocks ?? 'all'}`;
}

export function trimSessionDetailCache<TKey, TValue>(cache: Map<TKey, TValue>, maxEntries: number): void {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    cache.delete(oldestKey);
  }
}
