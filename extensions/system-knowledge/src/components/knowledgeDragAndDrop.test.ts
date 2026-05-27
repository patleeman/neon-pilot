import { describe, expect, it } from 'vitest';

import { canDropKnowledgeEntry, getKnowledgeEntryParentDir, normalizeKnowledgeDir } from './knowledgeDragAndDrop';

describe('knowledgeDragAndDrop', () => {
  it('normalizes knowledge directory ids', () => {
    expect(normalizeKnowledgeDir('')).toBe('');
    expect(normalizeKnowledgeDir('notes')).toBe('notes/');
    expect(normalizeKnowledgeDir('notes/sub/')).toBe('notes/sub/');
  });

  it('derives parent directories for files and folders', () => {
    expect(getKnowledgeEntryParentDir({ id: 'notes/demo.md', kind: 'file' } as const)).toBe('notes/');
    expect(getKnowledgeEntryParentDir({ id: 'notes/archive/', kind: 'folder' } as const)).toBe('notes/');
    expect(getKnowledgeEntryParentDir({ id: 'top-level.md', kind: 'file' } as const)).toBe('');
  });

  it('prevents invalid self and descendant drops', () => {
    expect(canDropKnowledgeEntry({ id: 'notes/demo.md', kind: 'file' } as const, 'notes/')).toBe(false);
    expect(canDropKnowledgeEntry({ id: 'notes/demo.md', kind: 'file' } as const, 'projects/')).toBe(true);
    expect(canDropKnowledgeEntry({ id: 'notes/archive/', kind: 'folder' } as const, 'notes/archive/')).toBe(false);
    expect(canDropKnowledgeEntry({ id: 'notes/archive/', kind: 'folder' } as const, 'notes/archive/nested/')).toBe(false);
    expect(canDropKnowledgeEntry({ id: 'notes/archive/', kind: 'folder' } as const, 'projects/')).toBe(true);
  });
});
