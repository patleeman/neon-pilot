export function toKnowledgeBaseIsoTimestamp(value: number | Date = Date.now()): string {
  return new Date(value).toISOString();
}

export function parseKnowledgeBaseTimestampMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
