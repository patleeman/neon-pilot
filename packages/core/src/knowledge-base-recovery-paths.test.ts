import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { computeKnowledgeBaseRecoveryEntryId, sanitizeKnowledgeBaseRecoveryRelativePath } from './knowledge-base-recovery-paths';

describe('knowledge-base-recovery-paths', () => {
  it('computes stable recovery entry ids from timestamp and path', () => {
    expect(computeKnowledgeBaseRecoveryEntryId('notes/a.md', '2026-05-23T00:00:00.000Z')).toBe(
      createHash('sha1').update('2026-05-23T00:00:00.000Z:notes/a.md').digest('hex'),
    );
  });

  it('sanitizes unsafe or empty recovery relative paths', () => {
    expect(sanitizeKnowledgeBaseRecoveryRelativePath('../notes/./a.md')).toBe('notes/a.md');
    expect(sanitizeKnowledgeBaseRecoveryRelativePath('/')).toBe('recovered-file');
    expect(sanitizeKnowledgeBaseRecoveryRelativePath('../../..')).toBe('recovered-file');
  });
});
