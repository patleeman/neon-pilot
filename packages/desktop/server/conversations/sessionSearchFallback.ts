export function shouldUseSessionSearchFallback(indexedText: string | null): indexedText is null {
  return indexedText === null;
}

export function resolveSessionSearchTextResult(input: { indexedText: string | null; fallbackText: string | null }): string | null {
  return input.indexedText !== null ? input.indexedText : input.fallbackText;
}
