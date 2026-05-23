export interface RawContentBlockLike {
  type: 'text' | 'thinking' | 'toolCall' | 'image';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  data?: string;
  mimeType?: string;
  mediaType?: string;
}

const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|[+-]\d{2}:\d{2})$/;

export function normalizeContent<TBlock extends RawContentBlockLike = RawContentBlockLike>(content: unknown): TBlock[] {
  if (Array.isArray(content)) {
    return content as TBlock[];
  }
  if (typeof content === 'string' && content.length > 0) {
    return [{ type: 'text', text: content } as TBlock];
  }
  return [];
}

export function normalizeTimestamp(timestamp: string | number | undefined): string {
  if (typeof timestamp === 'string' && timestamp.trim()) {
    const normalized = timestamp.trim();
    const match = normalized.match(ISO_TIMESTAMP_PATTERN);
    const parsed = match && hasValidIsoDateParts(match) ? Date.parse(normalized) : Number.NaN;
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
  }
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
  }
  return new Date(0).toISOString();
}

export function hasValidIsoDateParts(match: RegExpMatchArray): boolean {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = match[7] ? Number(match[7].slice(0, 3).padEnd(3, '0')) : 0;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second &&
    date.getUTCMilliseconds() === millisecond
  );
}
