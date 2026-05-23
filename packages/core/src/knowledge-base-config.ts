import { DEFAULT_MACHINE_KNOWLEDGE_BASE_BRANCH } from './machine-config.js';

export function normalizeKnowledgeBaseRepoUrl(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeKnowledgeBaseBranch(value: string | null | undefined): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || DEFAULT_MACHINE_KNOWLEDGE_BASE_BRANCH;
}

export function safeKnowledgeBaseSlug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'knowledge-base'
  );
}
