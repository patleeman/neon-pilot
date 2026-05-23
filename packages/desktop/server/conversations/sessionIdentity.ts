import { closeSync, openSync, readFileSync, readSync } from 'node:fs';

export interface SessionIdentityLineLike {
  type?: string;
  id?: string;
}

export function readCurrentSessionLeafIdFromFile(
  filePath: string,
  parseJsonLine: (rawLine: string) => SessionIdentityLineLike | null,
): string | null {
  try {
    let leafId: string | null = null;
    for (const rawLine of readFileSync(filePath, 'utf-8').split('\n')) {
      if (!rawLine.trim()) {
        continue;
      }

      const line = parseJsonLine(rawLine);
      if (!line || line.type === 'session') {
        continue;
      }

      const id = typeof line.id === 'string' && line.id.trim().length > 0 ? line.id.trim() : null;
      if (id) {
        leafId = id;
      }
    }
    return leafId;
  } catch {
    return null;
  }
}

export function readSessionIdFromSessionRecordFile(
  filePath: string,
  parseJsonLine: (rawLine: string) => SessionIdentityLineLike | null,
): string | null {
  let fd: number | null = null;

  try {
    fd = openSync(filePath, 'r');
    const buffer = Buffer.alloc(4096);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    if (bytesRead <= 0) {
      return null;
    }

    const firstLine = buffer.subarray(0, bytesRead).toString('utf-8').split(/\r?\n/, 1)[0]?.trim();
    if (!firstLine) {
      return null;
    }

    const parsed = parseJsonLine(firstLine);
    if (!parsed || parsed.type !== 'session') {
      return null;
    }

    const sessionId = parsed.id?.trim();
    return sessionId && sessionId.length > 0 ? sessionId : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }
}
