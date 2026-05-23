export interface SearchTextEntryLike {
  type: string;
  message?: unknown;
}

export function normalizeSearchSegment(text: string, maxLength = 360): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : normalized;
}

export function appendSessionSearchSegment(segments: string[], segment: string, remaining: number): number {
  if (remaining <= 0) {
    return 0;
  }

  const normalizedSegment = normalizeSearchSegment(segment);
  if (!normalizedSegment) {
    return remaining;
  }

  const limitedSegment =
    normalizedSegment.length > remaining ? `${normalizedSegment.slice(0, Math.max(0, remaining - 1)).trimEnd()}…` : normalizedSegment;

  if (!limitedSegment) {
    return remaining;
  }

  segments.push(limitedSegment);
  return Math.max(0, remaining - limitedSegment.length - 1);
}

export function buildSessionSearchTextFromEntries<T extends SearchTextEntryLike>(
  entries: T[],
  maxCharacters: number,
  extractSearchText: (message: NonNullable<T['message']>) => string,
): string {
  const segments: string[] = [];
  let remaining = Math.max(0, maxCharacters);

  for (let index = entries.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const entry = entries[index];
    if (!entry || entry.type !== 'message' || entry.message === undefined || entry.message === null) {
      continue;
    }

    remaining = appendSessionSearchSegment(segments, extractSearchText(entry.message as NonNullable<T['message']>), remaining);
  }

  return segments.reverse().join('\n');
}
