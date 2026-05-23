export function normalizeSessionName(name: unknown): string | null {
  if (typeof name !== 'string') {
    return null;
  }

  const normalized = name.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

export function buildSessionInfoRecord(name: string, timestamp = new Date().toISOString()): string {
  return JSON.stringify({
    type: 'session_info',
    timestamp,
    name,
  });
}

export function buildUserMessageTitle(input: { text: string; imageCount: number }): string | null {
  if (input.text) {
    return input.text.slice(0, 80).replace(/\n/g, ' ').trim();
  }
  if (input.imageCount > 0) {
    return input.imageCount === 1 ? '(image attachment)' : `(${input.imageCount} image attachments)`;
  }

  return null;
}
