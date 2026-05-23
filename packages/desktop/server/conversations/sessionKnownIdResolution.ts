export function resolveKnownSessionIdFromCache(cachedSessionId: unknown): string | null {
  return typeof cachedSessionId === 'string' && cachedSessionId.trim().length > 0 ? cachedSessionId.trim() : null;
}

export function resolveKnownSessionId(input: {
  cachedSessionId?: unknown;
  fileExists: boolean;
  recordSessionId?: string | null;
  metaSessionId?: string | null;
}): string | null {
  const cached = resolveKnownSessionIdFromCache(input.cachedSessionId);
  if (cached) {
    return cached;
  }

  if (!input.fileExists) {
    return null;
  }

  return input.recordSessionId ?? input.metaSessionId ?? null;
}
