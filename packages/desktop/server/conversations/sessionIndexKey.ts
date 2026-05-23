export function buildSessionIndexKey(input: { sessionsDir: string; indexFile: string }): string {
  return `${input.sessionsDir}::${input.indexFile}`;
}

export function shouldReloadPersistentSessionIndex(input: { loadedIndexKey: string | null; nextIndexKey: string }): boolean {
  return input.loadedIndexKey !== input.nextIndexKey;
}
