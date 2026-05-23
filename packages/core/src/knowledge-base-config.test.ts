import { describe, expect, it } from 'vitest';

import { normalizeKnowledgeBaseBranch, normalizeKnowledgeBaseRepoUrl, safeKnowledgeBaseSlug } from './knowledge-base-config';

describe('knowledge-base-config', () => {
  it('normalizes repository URLs and branches', () => {
    expect(normalizeKnowledgeBaseRepoUrl(' git@example.com:kb.git ')).toBe('git@example.com:kb.git');
    expect(normalizeKnowledgeBaseRepoUrl(null)).toBe('');
    expect(normalizeKnowledgeBaseBranch(' docs ')).toBe('docs');
    expect(normalizeKnowledgeBaseBranch('   ')).toBe('main');
    expect(normalizeKnowledgeBaseBranch(undefined)).toBe('main');
  });

  it('builds safe knowledge base slugs', () => {
    expect(safeKnowledgeBaseSlug(' My KB Repo! ')).toBe('my-kb-repo');
    expect(safeKnowledgeBaseSlug('my.repo_name')).toBe('my-repo-name');
    expect(safeKnowledgeBaseSlug('a'.repeat(60))).toHaveLength(48);
    expect(safeKnowledgeBaseSlug('  !!!  ')).toBe('knowledge-base');
  });
});
