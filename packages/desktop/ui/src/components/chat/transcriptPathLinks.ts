export interface TranscriptPathCandidate {
  text: string;
  targetPath: string;
}

const FILE_PATH_TRAILING_PUNCTUATION = /[),.;:!?\]}>]+$/;
const FILE_PATH_WITH_LINE_SUFFIX = /^(.+?)(?::\d+(?::\d+)?)?$/;
const PATH_TOKEN_REGEX =
  /\/[^\s`<>]*knowledge-base\/repo\/[^\s`<>]+|(?:~?\/|\.{1,2}\/)[^\s`<>]+|[A-Za-z0-9_.+-]+(?:\/[A-Za-z0-9_.+-]+)+(?::\d+(?::\d+)?)?/g;

export function trimTranscriptPathToken(value: string): string {
  return value.trim().replace(FILE_PATH_TRAILING_PUNCTUATION, '');
}

export function normalizeTranscriptPathTarget(value: string): string {
  const trimmed = trimTranscriptPathToken(value);
  return trimmed.match(FILE_PATH_WITH_LINE_SUFFIX)?.[1] ?? trimmed;
}

export function looksLikeTranscriptPath(value: string): boolean {
  const normalized = normalizeTranscriptPathTarget(value);
  if (!normalized || normalized.endsWith('/')) {
    return false;
  }

  if (/^(?:https?|file):\/\//i.test(normalized) || normalized.startsWith('//')) {
    return false;
  }

  if (/^(?:\/|~\/|\.{1,2}\/)/.test(normalized)) {
    return normalized.includes('/');
  }

  return /^[A-Za-z0-9_.+-]+(?:\/[A-Za-z0-9_.+-]+)+$/.test(normalized) && /\/[^/\s]+\.[A-Za-z0-9][A-Za-z0-9_-]*$/.test(normalized);
}

export function detectTranscriptPathCandidates(text: string): TranscriptPathCandidate[] {
  const candidates: TranscriptPathCandidate[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = PATH_TOKEN_REGEX.exec(text)) !== null) {
    const rawToken = match[0];
    if (readKnowledgeBaseFileIdFromPath(rawToken) || !looksLikeTranscriptPath(rawToken)) {
      continue;
    }

    const displayText = trimTranscriptPathToken(rawToken);
    const targetPath = normalizeTranscriptPathTarget(displayText);
    if (targetPath) {
      candidates.push({ text: displayText, targetPath });
    }
  }

  return candidates;
}

export function readKnowledgeBaseFileIdFromPath(value: string): string | null {
  const normalized = trimTranscriptPathToken(value);
  const marker = '/knowledge-base/repo/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0 || normalized.endsWith('/')) {
    return null;
  }

  const fileId = normalized.slice(markerIndex + marker.length);
  return fileId && !fileId.endsWith('/') ? fileId : null;
}
