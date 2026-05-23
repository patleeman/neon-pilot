export function shouldPersistSessionIndex(input: { sessionCacheDirty: boolean }): boolean {
  return input.sessionCacheDirty;
}

export function didSessionIndexJsonChange(input: { nextJson: string; persistedIndexJson: string | null }): boolean {
  return input.nextJson !== input.persistedIndexJson;
}
