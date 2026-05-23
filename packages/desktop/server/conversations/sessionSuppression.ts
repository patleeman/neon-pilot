export interface SuppressibleMessageEntryLike {
  id: string;
  parentId?: string | null;
  message: { role?: string; [key: string]: unknown };
}

export function shouldSuppressTranscriptDescendants(_message: SuppressibleMessageEntryLike['message']): boolean {
  return false;
}

export function collectSuppressedTranscriptEntryIds<T extends SuppressibleMessageEntryLike>(
  messages: T[],
  shouldSuppress: (message: T['message']) => boolean = shouldSuppressTranscriptDescendants,
): Set<string> {
  const suppressedRoots = new Set(messages.filter((message) => shouldSuppress(message.message)).map((message) => message.id));
  if (suppressedRoots.size === 0) {
    return new Set();
  }

  const parentById = new Map(messages.map((message) => [message.id, message.parentId ?? null] as const));
  const messageById = new Map(messages.map((message) => [message.id, message.message] as const));
  const suppressedById = new Map<string, boolean>();

  const isSuppressed = (id: string | undefined): boolean => {
    if (!id) {
      return false;
    }
    if (suppressedById.has(id)) {
      return suppressedById.get(id) ?? false;
    }

    const message = messageById.get(id);
    if (message?.role === 'user') {
      suppressedById.set(id, false);
      return false;
    }

    if (suppressedRoots.has(id)) {
      suppressedById.set(id, true);
      return true;
    }

    const parentId = parentById.get(id) ?? null;
    const suppressed = parentId ? isSuppressed(parentId) : false;
    suppressedById.set(id, suppressed);
    return suppressed;
  };

  return new Set(messages.filter((message) => isSuppressed(message.id)).map((message) => message.id));
}

export function buildSuppressedTranscriptError(count: number): Error {
  return new Error(
    `Transcript transparency violation: ${count} persisted transcript entr${count === 1 ? 'y was' : 'ies were'} suppressed from chat rendering.`,
  );
}
