import { createHash } from 'node:crypto';

const SKIPPED_RECOVERY_PATH_SEGMENTS = new Set(['', '.', '..']);

export function computeKnowledgeBaseRecoveryEntryId(relativePath: string, timestamp: string): string {
  return createHash('sha1').update(`${timestamp}:${relativePath}`).digest('hex');
}

export function sanitizeKnowledgeBaseRecoveryRelativePath(relativePath: string): string {
  const segments = relativePath.split('/').filter((segment) => !SKIPPED_RECOVERY_PATH_SEGMENTS.has(segment));
  return segments.length > 0 ? segments.join('/') : 'recovered-file';
}
