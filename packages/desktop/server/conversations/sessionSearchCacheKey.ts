export function normalizeSessionSearchMaxCharacters(maxCharacters: number): number {
  return Math.max(0, maxCharacters);
}

export function buildSessionSearchTextCacheKey(filePath: string, maxCharacters: number): string {
  return `${filePath}:${normalizeSessionSearchMaxCharacters(maxCharacters)}`;
}
