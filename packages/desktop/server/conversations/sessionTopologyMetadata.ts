import { relative } from 'node:path';

export interface SessionMetaWithParentFile {
  id: string;
  file: string;
  parentSessionFile?: string;
  parentSessionId?: string;
  [key: string]: unknown;
}

export function readSourceRunIdFromSessionFilePath(input: { sessionsDir: string; filePath: string }): string | undefined {
  const relativePath = relative(input.sessionsDir, input.filePath).replace(/\\/g, '/');
  const segments = relativePath.split('/').filter((segment) => segment.length > 0);
  if (segments.length < 3 || segments[0] !== '__runs') {
    return undefined;
  }

  return segments[1];
}

export function decorateSessionParentIds<TMeta extends SessionMetaWithParentFile>(
  metas: TMeta[],
  normalizeOptionalPath: (value: string | undefined) => string | undefined,
): TMeta[] {
  const sessionIdByFile = new Map(metas.map((meta) => [meta.file, meta.id] as const));

  return metas.map((meta) => {
    const parentSessionFile = normalizeOptionalPath(meta.parentSessionFile);
    const parentSessionId = parentSessionFile ? sessionIdByFile.get(parentSessionFile) : undefined;

    if (meta.parentSessionFile === parentSessionFile && meta.parentSessionId === parentSessionId) {
      return meta;
    }

    return {
      ...meta,
      ...(parentSessionFile ? { parentSessionFile } : {}),
      ...(parentSessionId ? { parentSessionId } : {}),
    };
  });
}

export function resolveSessionIdByFile(input: {
  filePath: string;
  sessionFileById: Map<string, string>;
  normalizeOptionalPath: (value: string | undefined) => string | undefined;
}): string | undefined {
  const normalizedFilePath = input.normalizeOptionalPath(input.filePath);
  if (!normalizedFilePath) {
    return undefined;
  }

  for (const [sessionId, sessionFile] of input.sessionFileById.entries()) {
    if (input.normalizeOptionalPath(sessionFile) === normalizedFilePath) {
      return sessionId;
    }
  }

  return undefined;
}
